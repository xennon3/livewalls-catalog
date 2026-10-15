# LiveWalls catalog: guide for new sessions

Read this first when you're asked to make, change or publish a LiveWalls wallpaper. README.md has
the user-facing reference for the shader inputs and `meta.json` fields. This file covers how the
pieces fit together and the rules to follow.

## What this is

- **The app:** LiveWalls (`com.pulsa.livewalls`, source in `C:\Users\pulsa\Desktop\APPS\LiveWalls`)
  is a live-wallpaper app on Google Play. It has two built-in Canvas scenes, Sunset Flyby and
  Rocket Launch. Everything else comes from this repo.
- **This repo:** `github.com/xennon3/livewalls-catalog` is public, and its `main` branch is live.
  The app downloads `catalog.json` plus each wallpaper's files from
  `https://raw.githubusercontent.com/xennon3/livewalls-catalog/main/`.
- **Adding a wallpaper:** one folder in `wallpapers/`, pushed to `main`, shows up in every
  user's app. **New wallpapers never need an app update or a Play release.**
- Anything pushed here reaches real users within minutes. Treat a push as publishing.
- **Control Room:** https://claude.ai/artifact/EEv1GKcprRAgLxaYDdyrYM is the owner's dashboard. It
  previews every wallpaper live, and its Publish and Retire buttons are how the owner decides what
  goes live. Every new or changed wallpaper goes there before it can be pushed. See
  [Control Room](#control-room) below.

## A wallpaper

```
wallpapers/<id>/        id = folder name: lowercase letters, digits, dashes (e.g. ocean-waves)
  scene.frag            GLSL ES 3.00 fragment shader with a Shadertoy-style mainImage (required)
  meta.json             name, author, description, options (optional, but always write one)
  *.png/.jpg/.webp      optional textures, listed in meta.json "channels" (max 4, 8 MB each)
```

- **`scene.frag`:** write only `void mainImage(out vec4 fragColor, in vec2 fragCoord)` and its
  helper functions. The app adds the `#version 300 es`, precision, uniforms and `main()`, so don't
  declare any of them yourself. The exact header is `HEADER` in `tools/lw.py`, which must stay
  identical to `ShaderProgram.HEADER` in the app.
- **Inputs:** `iResolution`, `iTime`, `iTimeDelta`, `iFrame`, `iDate`, `iOffset` (home-screen
  swipe position, 0..1, 0.5 = centre, good for parallax), `iChannel0-3` and
  `iChannelResolution`. `iMouse` is always 0. Alpha is ignored, because the output is forced
  opaque.
- **Not supported:** Shadertoy multipass, Buffer A-D, sound, keyboard and cubemaps. Use a single
  pass only.
- **`meta.json` fields:**
  - `name`, `author`, `description`: shown in the app. The existing wallpapers use
    `"author": "Prux Tech"`.
  - `fps`: frame-rate cap. Use 30 for slow scenes, or leave it out for 60.
  - `scale`: render resolution, 0.25-1. Use it for heavy shaders. Safe to use: the app renders into an
    offscreen buffer and upscales it (fixed 2026-10-14; earlier dev builds crashed on scale < 1).
  - `loop`: `iTime` wraps after this many seconds. Without it, `iTime` wraps at 3600 s.
  - `thumbTime`: the second of the animation the app captures as the thumbnail. Pick a moment
    that looks good.
  - `added`: stamped automatically on first build. Never edit it, because it drives the "NEW"
    badge, which shows for 14 days.
  - `minApp`: hides the wallpaper from apps older than this shader-contract version. The current
    app is 1, so you don't need it.
- **Look of the existing set:** see `aurora`, `lava-lamp` and `neon-grid`. The app's style is dark
  with synthwave pink (#FF4FD8) and violet (#7C5CFF), but wallpapers can use any palette.

## Workflow

Run these from this repo's root (`C:\Users\pulsa\Desktop\APPS\livewalls-catalog`):

```bash
python tools/lw.py new ocean-waves              # scaffold wallpapers/ocean-waves/
python tools/lw.py check                        # validate folders and meta.json (no compile locally)
python tools/lw.py test ocean-waves             # push to the phone and open it in the app
python tools/lw.py test ocean-waves --watch     # re-push on every save
python tools/lw.py test ocean-waves --remove    # remove the test copy from the phone
python tools/lw.py export ocean-waves           # write its Control Room document to .dashboard/
python tools/lw.py import .dashboard/x.json     # recreate a folder from a Control Room document
python tools/lw.py publish                      # check + build catalog.json + commit + push = LIVE
```

The normal path for a new wallpaper is: write it, run `check --glslang`, **add it to the Control
Room** (see below), give the owner the link, and stop. The owner publishes it with the button.

- **`test`:** copies the folder to the phone's `Android/data/com.pulsa.livewalls/files/dev/<id>/`.
  The wallpaper then appears in the app under "Testing on this phone", with id `dev:<id>`. This
  works with the Play/release build of the app too.
- **Compile errors:** these show up on the wallpaper's page in the app ("Shader didn't compile")
  and in `adb logcat`. glslangValidator isn't installed on this PC, so the real compile check is
  the phone plus the GitHub Action.
- **The GitHub Action** (`.github/workflows/catalog.yml`) runs on every push that touches
  `wallpapers/**`:
  - It compiles every shader with glslang.
  - It regenerates `catalog.json`, then commits and pushes it as github-actions[bot].
  - After it runs, `git pull` before you push again.
- **Wallpaper ids:** `catalog.json` is generated, so never hand-edit it. Each entry's `version` is
  a hash of its files, and changing a shader makes the app re-download it and re-render its
  thumbnail. Don't rename a published folder: the id is how users' applied wallpapers find it.
- **Removing a wallpaper:** delete its folder and publish. It leaves the gallery on the next sync.
  Users who have it applied keep their copy until they switch away.

## Rules

1. **Never push a wallpaper to `main` unless the owner approved that exact wallpaper.** Approval
   is either a Control Room request you were asked to carry out (see below), or the owner saying
   so in chat after seeing it in the Control Room. A push to `main` goes live to every user right
   away. Every new or changed wallpaper must be in the Control Room before any push, so the owner
   can see what they are approving. Pushes that touch no wallpaper (docs, `tools/`) still need the
   owner's OK in chat.
2. **Licensing:** only publish shaders written in this session, or ones the user owns or has
   permission for. Don't copy shaders from shadertoy.com: they default to CC BY-NC-SA, which a
   commercial app can't use.
3. **Shaders only, never code:** Play policy forbids downloading executable code. Wallpapers stay
   GLSL plus images plus JSON. Don't add scripts or anything the app would execute in other ways.
4. **Performance:** this is a mid-range phone (Moto G Stylus 5G) running all day as a wallpaper.
   - Keep loops small: about 4-6 fbm octaves and no 100-step raymarches at full resolution.
   - Use `scale` or `fps: 30` for heavy scenes.
   - **Measure, don't guess.** The in-app preview ignores `fps`, so its frame rate is what the
     GPU can sustain. Open the preview with `lw.py test <id>`, find the layer with
     `adb shell dumpsys SurfaceFlinger --list` (the `SurfaceView[com.pulsa.livewalls/...](BLAST)#N`
     line), then:
     - run `dumpsys SurfaceFlinger --latency-clear '<layer>'`;
     - wait 4 s and run `dumpsys SurfaceFlinger --latency '<layer>'`;
     - count the frames.
   - Aim for at least 1.5× the `fps` cap, so the GPU sits around 65% busy or less. Measured
     values on 2026-10-14:

     | Wallpaper | Settings | Measured |
     |---|---|---|
     | neon-alley | scale 0.45, fps 24 | 36 fps |
     | megacity | scale 0.5, fps 20 | 46 fps |
     | hover-run | scale 0.75, fps 30 | 48 fps |
     | lava-lamp | full resolution | 60 fps |
   - Use `highp`-safe math. `sin`-hash noise breaks at large `iTime`, so wrap time with `loop`
     or `mod`.
5. **Aspect ratio:** phones are portrait, about 1080×2400. Design for tall screens, and use
   `iOffset.x` for a gentle horizontal parallax.

## Phone / adb

- **Device:** Moto G Stylus 5G, adb id `ZY22LF34QG`.
- **adb path:** `C:\Users\pulsa\AppData\Local\Android\Sdk\platform-tools\adb.exe` (`lw.py` finds
  it automatically).
- **Git Bash:**
  - Run `export MSYS_NO_PATHCONV=1` so `/sdcard/...` paths aren't mangled.
  - With that set, pass Windows-style paths (`C:\...`) to `adb install`.
- **Before using the phone:**
  - The phone is often PIN-locked. Ask the user to unlock it before testing.
  - Ask before taking screenshots outside the LiveWalls app, such as the home screen.
  - Don't change system or accessibility settings on it.
- **The app installed on the phone is the release build**, signed with the upload key. To
  install a debug build you must uninstall it first, and the reverse.

## When the app itself has to change

A new uniform, multipass, video and so on are **app changes**, not catalog changes. They need a
new Play release:

1. Edit the app in `C:\Users\pulsa\Desktop\APPS\LiveWalls`.
2. Bump `APP_SCHEMA` in `data/WallpaperStore.kt` and keep `HEADER` in `tools/lw.py` in sync.
3. Bump `versionCode` in `app/build.gradle.kts`.
4. Build with `./gradlew :app:bundleRelease`.
5. Give wallpapers that need the new feature `"minApp": <new schema>`, so older installs skip
   them.

`LiveWalls/RELEASING.md` covers signing and the upload key.

The local catalog server for debug builds is described in `LiveWalls/app/src/debug/AndroidManifest.xml`:
`python -m http.server 8765`, `adb reverse tcp:8765 tcp:8765`, then build the debug app with
`-Plivewalls.catalogBaseUrl=http://localhost:8765/`. This is rarely needed now that `lw.py test` exists.

## Control Room

The owner often works from their phone and can't run `lw.py test`, so the Control Room is where they
look at wallpapers and decide. Link: https://claude.ai/artifact/EEv1GKcprRAgLxaYDdyrYM. It is a
claude.ai artifact; read and write its data with the `ArtifactData` tool (load it with ToolSearch)
and the artifact's `url`.

- **Page source:** `tools/dashboard/index.html`. After editing it, republish with the Artifact tool,
  passing `url` (the link above) so the link stays the same, and omit `capabilities` to keep them.
  Read the live artifact first (`action: "read"`) as the tool requires.
- **`wallpapers/<id>`:** one document per wallpaper, made by `python tools/lw.py export <id>`
  (writes `.dashboard/<id>.json`). Fields: name, description, fps, scale, loop, thumbTime, `status`
  (`pending` = not on main, `changed` = edited since publishing, `live`, `retired`), `version` (the
  catalog hash), `compiles`, and `files` (the text of `scene.frag` and `meta.json`).
  - A new wallpaper: `ArtifactData` `set` with `file_path: .dashboard/<id>.json`.
  - An existing one: `update` with the same file, so fields it doesn't hold survive.
  - Phone measurements: `update` with `measuredFps` (number) and `measuredOn` (date).
  - Run `export` where glslangValidator is installed (`sudo apt-get install -y glslang-tools`), or
    `compiles` reads `unchecked`.
  - Textures can't travel in the document. If a wallpaper has images, upload them as artifact
    assets and say so to the owner. The button flow below only handles shader-only wallpapers.
- **`requests/<id>`:** written by the page when the owner presses Publish or Retire. Fields:
  `wallpaper`, `action` (`publish`/`retire`), `version` (what the owner saw), `status`
  (`requested` → `working` → `done`/`failed`, or `cancelled`), `sessionId`, `note`, `requestedAt`,
  `finishedAt`. A press also starts a Claude Code session on this repo with `main` as its branch and
  a prompt naming the request.
- **At the start of any session in this repo,** list `requests` whose status is `requested` or
  `working` but whose `sessionId` is empty or isn't a live session. Those are presses that didn't get
  a session. Tell the owner and carry them out first, as below.

### Control Room requests

When asked to carry out request `<rid>`:

1. `get` `requests/<rid>`. Stop if its status is not `requested` or `working`. `update` it to
   `status: "working"`, with `sessionId` set to your own session id (`get_session` with no id) and
   `note: "Working on it."`
2. Work on `main`: `git fetch origin main && git checkout -B main origin/main`.
3. **Publish:**
   - `get` `wallpapers/<wallpaper>` with `out_dir: .dashboard`.
   - Run `python tools/lw.py import .dashboard/wallpapers/<wallpaper>.json --force`.
   - Check the document's `version` equals the request's `version`. If it doesn't, the wallpaper
     changed after the owner pressed the button: fail the request.
   - Run `python tools/lw.py check --glslang`. A compile error fails the request.
   - Run `python tools/lw.py publish -m "Publish <name> (Control Room)"`.
4. **Retire:** `git rm -r wallpapers/<wallpaper>`, then
   `python tools/lw.py publish -m "Retire <name> (Control Room)"`.
5. The GitHub Action then commits `catalog.json` again. `git pull` before any later push.
6. **Update the dashboard:**
   - After a publish: `python tools/lw.py export <wallpaper>`, then `update` its document. It now
     reads `live` and carries the `added` date.
   - After a retire: `update` it with `status: "retired"`. Keep the document, so "Publish again"
     works.
7. `update` the request with `status: "done"`, `finishedAt` (ISO time) and
   `note: "Live in commit <short sha>."`. On any failure, set `status: "failed"` with `finishedAt`
   and a plain-words `note` saying what went wrong and what fixes it. Push nothing in that case.

Only the owner (editors) can write requests, so a request is the owner's approval for exactly that
one change. Don't widen it: no other wallpapers, no tool or doc changes in the same push.
