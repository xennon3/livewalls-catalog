#!/usr/bin/env python3
"""LiveWalls catalog tool.

  python tools/lw.py new my-wallpaper            start a new wallpaper from a template
  python tools/lw.py test my-wallpaper           push it to your phone over USB and open it in the app
  python tools/lw.py test my-wallpaper --watch   ...and re-push every time you save
  python tools/lw.py check                       validate every wallpaper
  python tools/lw.py build                       regenerate catalog.json
  python tools/lw.py publish                     check + build + commit + push -> live in the app
  python tools/lw.py export rainglass            write Control Room dashboard docs to .dashboard/
  python tools/lw.py import .dashboard/x.json    recreate a wallpaper folder from a dashboard doc

Folder names become wallpaper ids: lowercase letters, digits and dashes.
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WALLS = ROOT / "wallpapers"
CATALOG = ROOT / "catalog.json"
PACKAGE = "com.pulsa.livewalls"
DEV_DIR = f"/sdcard/Android/data/{PACKAGE}/files/dev"

SHADER = "scene.frag"
META = "meta.json"
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
FILE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
MAX_BYTES = 8 << 20

# Must match ShaderProgram.HEADER / FOOTER in the app.
HEADER = """#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec4 iDate;
uniform vec2 iOffset;
uniform vec3 iChannelResolution[4];
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
out vec4 lw_FragColor;
#line 1
"""
FOOTER = """
void main() {
    vec4 c = vec4(0.0, 0.0, 0.0, 1.0);
    mainImage(c, gl_FragCoord.xy);
    lw_FragColor = vec4(c.rgb, 1.0);
}
"""

TEMPLATE_SHADER = """// {name}
//
// Write mainImage like on shadertoy.com. Available inputs:
//   iResolution  vec3   screen size in pixels
//   iTime        float  seconds (wraps at meta.json "loop", if set)
//   iTimeDelta   float  seconds since last frame
//   iFrame       int    frame counter
//   iDate        vec4   year, month, day, seconds of day
//   iOffset      vec2   home-screen swipe position, 0..1 (0.5 = middle page)
//   iChannel0-3  sampler2D  images listed in meta.json "channels"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {{
    vec2 uv = fragCoord / iResolution.xy;
    vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0.0, 2.0, 4.0));
    fragColor = vec4(col, 1.0);
}}
"""


def fail(msg):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def wallpaper_dirs():
    return sorted(p for p in WALLS.iterdir() if p.is_dir() and not p.name.startswith("."))


def resolve(name):
    p = Path(name)
    if not p.is_dir():
        p = WALLS / name
    if not p.is_dir():
        fail(f"no wallpaper folder '{name}' (looked in {WALLS})")
    return p.resolve()


def load_meta(d):
    f = d / META
    if not f.exists():
        return {}
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ValueError(f"{f.relative_to(ROOT)}: invalid JSON ({e})")


# ------------------------------------------------------------------------------------- check

def problems(d, glslang=None):
    out = []
    if not ID_RE.match(d.name):
        out.append("folder name must be lowercase letters, digits and dashes")
    shader = d / SHADER
    if not shader.is_file():
        return out + [f"missing {SHADER}"]
    src = shader.read_text(encoding="utf-8")
    if "mainImage" not in src:
        out.append(f"{SHADER} has no mainImage function")
    try:
        meta = load_meta(d)
    except ValueError as e:
        return out + [str(e)]
    if not isinstance(meta.get("name", ""), str):
        out.append('"name" must be text')
    for key in ("fps", "scale", "loop", "thumbTime"):
        if key in meta and not isinstance(meta[key], (int, float)):
            out.append(f'"{key}" must be a number')
    channels = meta.get("channels", [])
    if not isinstance(channels, list) or len(channels) > 4:
        out.append('"channels" must be a list of up to 4 image files')
        channels = []
    for c in channels:
        f = d / str(c)
        if not FILE_RE.match(str(c)) or f.suffix.lower() not in IMAGE_EXT:
            out.append(f"channel '{c}' must be a .png/.jpg/.webp file name")
        elif not f.is_file():
            out.append(f"channel image '{c}' not found")
    for f in [shader] + [d / str(c) for c in channels]:
        if f.is_file() and f.stat().st_size > MAX_BYTES:
            out.append(f"{f.name} is larger than 8 MB")
    if glslang and not out:
        with tempfile.TemporaryDirectory() as tmp:
            wrapped = Path(tmp) / "scene.frag"
            wrapped.write_text(HEADER + src + FOOTER, encoding="utf-8")
            r = subprocess.run([glslang, "-S", "frag", str(wrapped)], capture_output=True, text=True)
            if r.returncode != 0:
                log = (r.stdout + r.stderr).replace(str(wrapped), SHADER).strip()
                out.append("shader does not compile:\n      " + log.replace("\n", "\n      "))
    return out


def cmd_check(args):
    glslang = None
    if args.glslang:
        glslang = shutil.which("glslangValidator")
        if not glslang:
            fail("glslangValidator not found (install glslang-tools)")
    bad = 0
    for d in wallpaper_dirs():
        p = problems(d, glslang)
        if p:
            bad += 1
            print(f"x {d.name}")
            for line in p:
                print(f"    - {line}")
        else:
            print(f"ok {d.name}")
    if bad:
        fail(f"{bad} wallpaper(s) need fixing")
    if not glslang:
        print("(compile check runs on GitHub; use `test` to try a shader on your phone)")


# ------------------------------------------------------------------------------------- build

def version_of(d, meta):
    channels = [str(c) for c in meta.get("channels", [])]
    files = [SHADER] + channels
    h = hashlib.sha256()
    for name in files:
        h.update(name.encode())
        data = (d / name).read_bytes()
        if name == SHADER:
            data = data.replace(b"\r\n", b"\n")  # same hash on Windows and in CI
        h.update(data)
    return files, channels, h.hexdigest()[:12]


def entry(d):
    meta = load_meta(d)
    if "added" not in meta:
        # Stamp the publish date once so it never changes afterwards.
        meta["added"] = datetime.date.today().isoformat()
        (d / META).write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    files, channels, version = version_of(d, meta)
    e = {
        "id": d.name,
        "name": meta.get("name") or d.name.replace("-", " ").title(),
        "author": meta.get("author", ""),
        "description": meta.get("description", ""),
        "version": version,
        "added": meta["added"],
        "files": files,
        "channels": channels,
    }
    for key in ("fps", "scale", "loop", "thumbTime", "minApp"):
        if key in meta:
            e[key] = meta[key]
    return e


def cmd_build(args=None):
    entries = []
    for d in wallpaper_dirs():
        if problems(d):
            print(f"skipping {d.name} (run `check`)")
            continue
        entries.append(entry(d))
    entries.sort(key=lambda e: e["name"].lower())
    entries.sort(key=lambda e: e["added"], reverse=True)  # newest first
    text = json.dumps({"schema": 1, "wallpapers": entries}, indent=2, ensure_ascii=False) + "\n"
    old = CATALOG.read_text(encoding="utf-8") if CATALOG.exists() else ""
    if text != old:
        CATALOG.write_text(text, encoding="utf-8")
        print(f"catalog.json updated ({len(entries)} wallpapers)")
    else:
        print(f"catalog.json already up to date ({len(entries)} wallpapers)")


# ------------------------------------------------------------------------- Control Room dashboard
# The dashboard (see CLAUDE.md) keeps one document per wallpaper in its `wallpapers` collection.
# `export` writes those documents as JSON files for ArtifactData; `import` turns one back into a
# folder, which is how a fresh session publishes a wallpaper that only exists in the dashboard.

DASH_DIR = ROOT / ".dashboard"


def dash_doc(d, live, glslang):
    meta = load_meta(d)
    _, channels, version = version_of(d, meta)
    probs = problems(d, glslang)
    published = live.get(d.name)
    if not published:
        status = "pending"
    elif published["version"] != version:
        status = "changed"
    else:
        status = "live"
    return {
        "id": d.name,
        "name": meta.get("name") or d.name.replace("-", " ").title(),
        "author": meta.get("author", ""),
        "description": meta.get("description", ""),
        "status": status,
        "added": (published or {}).get("added") or meta.get("added", ""),
        "fps": meta.get("fps", 60),
        "scale": meta.get("scale", 1),
        "loop": meta.get("loop", 3600),
        "thumbTime": meta.get("thumbTime", 0),
        "version": version,
        "compiles": "yes" if not probs and glslang else ("no" if probs else "unchecked"),
        "problems": "; ".join(probs),
        "images": channels,
        "files": {
            SHADER: (d / SHADER).read_text(encoding="utf-8"),
            META: (d / META).read_text(encoding="utf-8") if (d / META).exists() else "{}\n",
        },
        "exportedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    }


def cmd_export(args):
    glslang = shutil.which("glslangValidator")
    if not glslang:
        print("note: glslangValidator not found, so compiles = 'unchecked'")
    # What is live is what main's catalog.json lists, not this working copy's.
    r = git("show", "origin/main:catalog.json", check=False)
    text = r.stdout if r.returncode == 0 else (CATALOG.read_text(encoding="utf-8") if CATALOG.exists() else "{}")
    live = {w["id"]: w for w in json.loads(text or "{}").get("wallpapers", [])}
    dirs = [resolve(i) for i in args.ids] if args.ids else wallpaper_dirs()
    DASH_DIR.mkdir(exist_ok=True)
    for d in dirs:
        doc = dash_doc(d, live, glslang)
        out = DASH_DIR / f"{d.name}.json"
        out.write_text(json.dumps(doc, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"{doc['status']:8} {d.name} -> {out.relative_to(ROOT)}")
    if not args.ids:
        gone = sorted(set(live) - {d.name for d in dirs})
        for i in gone:
            print(f"retired  {i} (in main's catalog.json but no folder here)")


def cmd_import(args):
    doc = json.loads(Path(args.file).read_text(encoding="utf-8"))
    wid = doc.get("id", "")
    if not ID_RE.match(wid):
        fail(f"bad wallpaper id {wid!r}")
    files = doc.get("files") or {}
    if SHADER not in files:
        fail(f"the document has no {SHADER}")
    d = WALLS / wid
    if d.exists() and not args.force:
        fail(f"{d.relative_to(ROOT)} already exists (use --force to overwrite)")
    d.mkdir(parents=True, exist_ok=True)
    for name, text in files.items():
        if name not in (SHADER, META):
            fail(f"unexpected file {name!r} in the document")
        (d / name).write_text(text, encoding="utf-8")
    missing = [i for i in doc.get("images", []) if not (d / i).is_file()]
    print(f"wrote {d.relative_to(ROOT)}")
    if missing:
        print("still needed (download from the dashboard's assets): " + ", ".join(missing))


# ------------------------------------------------------------------------------------- new

def cmd_new(args):
    if not ID_RE.match(args.id):
        fail("use lowercase letters, digits and dashes, e.g. 'ocean-waves'")
    d = WALLS / args.id
    if d.exists():
        fail(f"{d.relative_to(ROOT)} already exists")
    d.mkdir(parents=True)
    name = args.id.replace("-", " ").title()
    (d / SHADER).write_text(TEMPLATE_SHADER.format(name=name), encoding="utf-8")
    meta = {"name": name, "author": "Prux Tech", "description": ""}
    (d / META).write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"created {d.relative_to(ROOT)}/  ->  edit {SHADER}, then: python tools/lw.py test {args.id} --watch")


# ------------------------------------------------------------------------------------- test

def find_adb():
    candidates = [os.environ.get("ADB"), shutil.which("adb")]
    for env in ("ANDROID_HOME", "ANDROID_SDK_ROOT"):
        if os.environ.get(env):
            candidates.append(str(Path(os.environ[env]) / "platform-tools" / "adb"))
    if os.environ.get("LOCALAPPDATA"):
        candidates.append(str(Path(os.environ["LOCALAPPDATA"]) / "Android/Sdk/platform-tools/adb.exe"))
    for c in candidates:
        if c and (Path(c).is_file() or Path(c + ".exe").is_file() or shutil.which(c)):
            return c
    fail("adb not found; set the ADB environment variable to its path")


def push(adb, d):
    p = problems(d)
    if p:
        print("x " + "\n  - ".join([d.name] + p))
        return
    target = f"{DEV_DIR}/{d.name}"
    subprocess.run([adb, "shell", "rm", "-rf", target], check=True)
    subprocess.run([adb, "shell", "mkdir", "-p", target], check=True)
    for f in d.iterdir():
        if f.is_file():
            subprocess.run([adb, "push", str(f), f"{target}/{f.name}"], check=True, capture_output=True)
    subprocess.run([adb, "shell", "am", "start", "-n", f"{PACKAGE}/.ui.MainActivity",
                    "--es", "open", f"dev:{d.name}"], check=True, capture_output=True)
    print(f"{time.strftime('%H:%M:%S')}  pushed {d.name} -> phone (shown under 'Testing on this phone')")


def snapshot(d):
    return {f.name: (f.stat().st_mtime, f.stat().st_size) for f in d.iterdir() if f.is_file()}


def cmd_test(args):
    adb = find_adb()
    d = resolve(args.id)
    push(adb, d)
    if not args.watch:
        print(f"remove it from the phone with: python tools/lw.py test {d.name} --remove")
        return
    print("watching for changes, Ctrl+C to stop")
    last = snapshot(d)
    try:
        while True:
            time.sleep(0.7)
            now = snapshot(d)
            if now != last:
                last = now
                push(adb, d)
    except KeyboardInterrupt:
        pass


def cmd_untest(args):
    adb = find_adb()
    subprocess.run([adb, "shell", "rm", "-rf", f"{DEV_DIR}/{args.id}"], check=True)
    print(f"removed {args.id} from the phone")


# ------------------------------------------------------------------------------------- publish

def git(*a, check=True):
    return subprocess.run(["git", *a], cwd=ROOT, check=check, capture_output=True, text=True)


def git_user():
    try:
        return git("config", "user.name").stdout.strip()
    except Exception:
        return None


def cmd_publish(args):
    cmd_check(argparse.Namespace(glslang=False))
    cmd_build()
    git("add", "-A", "wallpapers", "catalog.json")
    staged = git("diff", "--cached", "--name-only").stdout.split()
    if not staged:
        print("nothing new to publish")
        return
    names = sorted({Path(f).parts[1] for f in staged if f.startswith("wallpapers/")})
    msg = args.message or ("Publish " + ", ".join(names) if names else "Update catalog")
    git("commit", "-m", msg)
    r = git("push", check=False)
    if r.returncode != 0:
        fail("git push failed:\n" + r.stderr)
    print(f"published: {msg}\nIt shows up in the app within a few minutes (pull down to refresh).")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("new", help="start a new wallpaper")
    p.add_argument("id")
    p.set_defaults(fn=cmd_new)
    p = sub.add_parser("test", help="push a wallpaper to your phone over USB")
    p.add_argument("id")
    p.add_argument("--watch", action="store_true", help="re-push on every save")
    p.add_argument("--remove", action="store_true", help="remove it from the phone instead")
    p.set_defaults(fn=lambda a: cmd_untest(a) if a.remove else cmd_test(a))
    p = sub.add_parser("check", help="validate all wallpapers")
    p.add_argument("--glslang", action="store_true", help="also compile shaders with glslangValidator")
    p.set_defaults(fn=cmd_check)
    p = sub.add_parser("build", help="regenerate catalog.json")
    p.set_defaults(fn=cmd_build)
    p = sub.add_parser("export", help="write Control Room dashboard documents to .dashboard/")
    p.add_argument("ids", nargs="*", help="wallpaper ids (default: all)")
    p.set_defaults(fn=cmd_export)
    p = sub.add_parser("import", help="recreate a wallpaper folder from a dashboard document")
    p.add_argument("file")
    p.add_argument("--force", action="store_true")
    p.set_defaults(fn=cmd_import)
    p = sub.add_parser("publish", help="build, commit and push")
    p.add_argument("-m", "--message")
    p.set_defaults(fn=cmd_publish)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
