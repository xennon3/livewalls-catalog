// Neon Alley: a rain-soaked cyberpunk street at night. Blade signs buzz on both walls, cables sag
// overhead, steam rises from a vent and every sign smears across the wet ground.

const float W = 3.6;          // half-width of the street
const float ZEND = 140.0;     // tower that closes the far end of the street
const float EYE = 1.65;
const int NSIGNS = 12;

float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash12(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
               mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = p * 2.03 + vec2(1.7, 9.2);
        a *= 0.5;
    }
    return v;
}

vec3 neon(float h) {
    if (h < 0.28) return vec3(1.0, 0.16, 0.62);   // hot pink
    if (h < 0.52) return vec3(0.10, 0.85, 1.0);   // cyan
    if (h < 0.68) return vec3(0.62, 0.30, 1.0);   // violet
    if (h < 0.84) return vec3(1.0, 0.58, 0.12);   // amber
    return vec3(0.25, 1.0, 0.55);                 // acid green
}

// A made-up glyph built from a handful of strokes, in a 0..1 cell. Returns stroke coverage.
float glyph(vec2 uv, float seed, float px) {
    float d = 1e3;
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float h = hash11(seed * 13.1 + fi * 7.7);
        if (h < 0.42) continue;
        vec2 a, b;
        if (i < 3) {             // horizontal strokes
            float y = 0.18 + 0.32 * fi;
            float x0 = 0.12 + 0.30 * hash11(seed + fi * 3.1);
            a = vec2(x0, y);
            b = vec2(min(0.88, x0 + 0.35 + 0.4 * h), y);
        } else if (i < 5) {      // vertical strokes
            float x = fi == 3.0 ? 0.32 : 0.68;
            a = vec2(x, 0.12 + 0.3 * hash11(seed + fi * 5.3));
            b = vec2(x, 0.88);
        } else {                 // one diagonal
            a = vec2(0.2, 0.85);
            b = vec2(0.75, 0.25);
        }
        vec2 pa = uv - a, ba = b - a;
        float k = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        d = min(d, length(pa - ba * k));
    }
    return smoothstep(0.075 + px, 0.075 - px, d);
}

// Blade sign i: centre, half size (x, y), which wall (+1 right, -1 left), colour, seed.
void signInfo(int i, out vec3 c, out vec2 hs, out float side, out vec3 col, out float seed) {
    float fi = float(i);
    seed = fi * 17.3 + 4.0;
    side = hash11(seed) < 0.5 ? -1.0 : 1.0;
    float z = 6.0 + fi * 6.5 + 2.5 * hash11(seed + 1.0);
    hs = vec2(0.55, 1.2 + 1.4 * hash11(seed + 2.0));
    float y = 3.2 + hs.y + 6.0 * hash11(seed + 3.0);
    c = vec3(side * (W - 0.25 - hs.x), y, z);
    col = neon(hash11(seed + 4.0));
}

float signPower(float seed, float t) {
    float p = 1.0;
    if (hash11(seed + 9.0) > 0.78) {
        // A failing tube: mostly on, with nervous dropouts.
        float n = noise(vec2(t * 9.0, seed));
        p = mix(0.15, 1.0, step(0.28, n));
    }
    return p;
}

// Light the signs throw onto a surface point.
vec3 signSpill(vec3 pos, vec3 n, float t) {
    vec3 sum = vec3(0.0);
    int i0 = clamp(int(floor((pos.z - 7.0) / 6.5)) - 1, 0, NSIGNS - 4);
    for (int i = i0; i < i0 + 4; i++) {
        vec3 c; vec2 hs; float side; vec3 col; float seed;
        signInfo(i, c, hs, side, col, seed);
        vec3 d = c - pos;
        float dist2 = dot(d, d);
        float facing = max(dot(n, d * inversesqrt(dist2 + 1e-4)), 0.0) * 0.8 + 0.2;
        sum += col * signPower(seed, t) * facing * 3.0 / (1.0 + dist2 * 0.35);
    }
    return sum;
}

vec3 skyCol(vec3 rd, float t) {
    float e = clamp(rd.y, 0.0, 1.0);
    vec3 c = mix(vec3(0.30, 0.08, 0.32), vec3(0.03, 0.02, 0.08), smoothstep(0.0, 0.7, e));
    float cl = fbm(rd.xz / max(rd.y, 0.05) * 0.6 + vec2(t * 0.01, 0.0));
    c += vec3(0.45, 0.12, 0.40) * smoothstep(0.35, 0.8, cl) * (1.0 - e) * 0.6;
    return c;
}

// Facade of a wall point. u runs along the street (z), v is height.
vec3 facade(vec3 pos, vec3 n, float t, out float bh) {
    float side = sign(pos.x);
    float seg = floor(pos.z / 11.0 + (side > 0.0 ? 0.37 : 0.0));
    float bs = hash11(seg * 7.3 + side * 3.0);
    bh = 14.0 + 40.0 * bs * bs;
    float u = pos.z;
    float v = pos.y;
    vec3 base = mix(vec3(0.045, 0.04, 0.06), vec3(0.08, 0.06, 0.07), hash11(seg + 2.0));
    base *= 0.75 + 0.5 * fbm(vec2(u, v) * 1.5);
    vec3 col = base;

    if (v > 3.0) {
        // Windows: floors every 3.2 m, bays every 2.4 m.
        vec2 cell = vec2(u / 2.4, (v - 3.0) / 3.2);
        vec2 id = floor(cell);
        vec2 f = fract(cell);
        float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.22, f.y) * step(f.y, 0.78);
        float h = hash12(id + seg * 13.0);
        vec3 room = h > 0.62 ? mix(vec3(1.0, 0.70, 0.40), vec3(0.55, 0.75, 1.0), step(0.85, h)) * (0.25 + 0.5 * hash12(id + 3.0)) : vec3(0.01, 0.012, 0.02);
        // Blinds and silhouettes break up the lit rooms.
        room *= 0.82 + 0.18 * step(0.5, fract(f.y * 7.0 + hash12(id) * 3.0));
        room *= 1.0 - 0.6 * step(0.8, hash12(id + 11.0)) * smoothstep(0.25, 0.2, abs(f.x - 0.4 - 0.2 * hash12(id + 12.0))) * step(f.y, 0.6);
        col = mix(col, room, win);
        // AC units hang under some windows.
        float ac = step(0.55, hash12(id + 7.0)) * step(0.30, f.x) * step(f.x, 0.62) * step(0.02, f.y) * step(f.y, 0.17);
        col = mix(col, vec3(0.11, 0.11, 0.12) * (0.8 + 0.4 * step(0.5, fract(f.x * 30.0))), ac);
    } else {
        // Shopfronts at street level: shutters and a glowing doorway here and there.
        float bay = floor(u / 5.0);
        float f = fract(u / 5.0);
        float shutter = 0.6 + 0.4 * step(0.5, fract(v * 9.0));
        col = vec3(0.05, 0.05, 0.06) * shutter;
        float lit = step(0.6, hash11(bay + seg));
        float door = step(0.25, f) * step(f, 0.75) * step(v, 2.5);
        col = mix(col, neon(hash11(bay * 3.1)) * 0.35 * lit, door * lit);
        col += neon(hash11(bay * 5.7)) * smoothstep(0.08, 0.0, abs(v - 2.75)) * 0.8 * step(0.35, hash11(bay + 2.0));
    }
    // A horizontal neon strip along some floors.
    float strip = smoothstep(0.05, 0.0, abs(v - (6.2 + 3.2 * floor(hash11(seg + 5.0) * 4.0)))) * step(0.5, hash11(seg + 6.0));
    col += neon(hash11(seg + 8.0)) * strip * 1.4;
    // Rain streaks running down the wall.
    col *= 0.9 + 0.2 * noise(vec2(u * 8.0, v * 0.5 + t * 2.0));
    return col;
}

// The tower closing the street: dark glass and a giant animated billboard.
vec3 endTower(vec3 pos, float t) {
    vec2 uv = vec2(pos.x, pos.y);
    vec3 col = vec3(0.03, 0.03, 0.05);
    vec2 g = vec2(uv.x / 1.2, uv.y / 2.4);
    float lit = step(0.7, hash12(floor(g))) * step(0.2, fract(g.x)) * step(0.25, fract(g.y));
    col += vec3(0.6, 0.7, 1.0) * lit * 0.25;
    // Billboard.
    vec2 b = (uv - vec2(0.0, 30.0)) / vec2(3.2, 7.0);
    if (abs(b.x) < 1.0 && abs(b.y) < 1.0) {
        float phase = floor(t / 6.0);
        float k = fract(t / 6.0);
        vec3 c1 = neon(hash11(phase));
        vec3 c2 = neon(hash11(phase + 1.0));
        vec3 img = mix(c1, c2, 0.5 + 0.5 * sin(b.y * 3.0 + t * 1.5));
        // Concentric rings pulsing out, glyph column down the side.
        img *= 0.6 + 0.4 * sin(length(b * vec2(1.0, 2.0)) * 14.0 - t * 4.0);
        vec2 gc = vec2((b.x + 1.0) * 3.0, (b.y + 1.0) * 6.0);
        float gl = glyph(fract(gc), floor(gc.y) + phase * 7.0, 0.05) * step(gc.x, 1.0);
        img = mix(img, vec3(1.0), gl * 0.9);
        img *= 0.85 + 0.15 * step(0.5, fract(b.y * 40.0));        // scanlines
        img *= smoothstep(0.0, 0.08, k) * smoothstep(1.0, 0.94, k) * 0.9 + 0.1; // slide change
        col = img * 2.2;
    }
    col += neon(0.1) * smoothstep(0.12, 0.0, abs(abs(b.x) - 1.03)) * step(abs(b.y), 1.03) * 2.5;
    return col;
}

// Trace everything except the ground. Returns colour; t out is the hit distance.
vec3 traceAbove(vec3 ro, vec3 rd, float time, out float tHit, out vec3 hitPos) {
    tHit = 1e4;
    vec3 col = vec3(0.0);
    int kind = 0;

    // Walls.
    if (abs(rd.x) > 1e-4) {
        float tw = (sign(rd.x) * W - ro.x) / rd.x;
        vec3 p = ro + rd * tw;
        if (tw > 0.0 && p.z < ZEND) {
            float bh;
            vec3 n = vec3(-sign(rd.x), 0.0, 0.0);
            vec3 fc = facade(p, n, time, bh);
            if (p.y < bh) {
                tHit = tw;
                kind = 1;
                col = fc + signSpill(p, n, time) * 0.16;
            }
        }
    }
    // End tower.
    if (rd.z > 0.0) {
        float te = (ZEND - ro.z) / rd.z;
        vec3 p = ro + rd * te;
        if (te < tHit && p.y < 80.0) {
            tHit = te;
            kind = 2;
            col = endTower(p, time);
        }
    }
    // Blade signs, facing the camera, plus each sign's halo in the rain-filled air.
    vec3 halo = vec3(0.0);
    for (int i = 0; i < NSIGNS; i++) {
        vec3 c; vec2 hs; float side; vec3 nc; float seed;
        signInfo(i, c, hs, side, nc, seed);
        if (rd.z <= 0.0) break;
        float ts = (c.z - ro.z) / rd.z;
        if (ts <= 0.0 || ts > tHit + 0.5) continue;
        vec3 p = ro + rd * ts;
        vec2 q = vec2(p.x - c.x, p.y - c.y);
        float hd = length(max(abs(q) - hs, 0.0));
        halo += nc * signPower(seed, time) * (exp(-hd * 2.2) * 0.22 + exp(-hd * 8.0) * 0.25) * step(0.001, hd);
        if (ts >= tHit) continue;
        // Bracket arm to the wall.
        float arm = step(abs(q.y - hs.y + 0.15), 0.04) * step(abs(p.x), W) * step(-side * q.x, -hs.x + 0.001);
        if (abs(q.x) < hs.x && abs(q.y) < hs.y) {
            tHit = ts;
            kind = 3;
            float px = ts * 2.0 / iResolution.y;
            float pw = signPower(seed, time);
            vec3 sc = vec3(0.02, 0.015, 0.03);
            // Neon border tube.
            float edge = min(hs.x - abs(q.x), hs.y - abs(q.y));
            sc += nc * smoothstep(0.05 + px, 0.0, abs(edge - 0.07)) * 2.2 * pw;
            // Stacked glyphs.
            float nch = floor(hs.y * 2.0 / 0.9);
            vec2 gu = vec2((q.x + hs.x * 0.75) / (hs.x * 1.5), (hs.y - 0.2 - q.y) / 0.9);
            if (gu.x > 0.0 && gu.x < 1.0 && gu.y > 0.0 && gu.y < nch - 0.3) {
                float g = glyph(vec2(gu.x, 1.0 - fract(gu.y)), seed + floor(gu.y), px * 2.0);
                sc += mix(nc, vec3(1.0), 0.35) * g * 2.0 * pw;
            }
            sc += nc * 0.12 * pw;
            col = sc;
        } else if (arm > 0.5) {
            tHit = ts;
            kind = 3;
            col = vec3(0.04);
        }
    }
    // Cables sagging across the street.
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float cz = 9.0 + fi * 11.0 + 4.0 * hash11(fi + 40.0);
        if (rd.z <= 0.0) break;
        float tc = (cz - ro.z) / rd.z;
        if (tc <= 0.0 || tc >= tHit) continue;
        vec3 p = ro + rd * tc;
        float y0 = 7.0 + 6.0 * hash11(fi + 41.0);
        float sag = 0.8 + 0.8 * hash11(fi + 42.0);
        for (int k = 0; k < 2; k++) {
            float cy = y0 - float(k) * 0.35 - sag * (1.0 - (p.x / W) * (p.x / W));
            float w = max(0.025, tc * 1.2 / iResolution.y);
            float a = smoothstep(w * 1.5, 0.0, abs(p.y - cy)) * step(abs(p.x), W);
            if (a > 0.5) {
                tHit = tc;
                kind = 4;
                col = vec3(0.015) + signSpill(p, vec3(0.0, -1.0, 0.0), time) * 0.02;
            }
        }
    }

    hitPos = ro + rd * tHit;
    col += halo;
    if (kind == 0) {
        col = skyCol(rd, time);
        // Flying traffic crossing the slot of sky.
        for (int i = 0; i < 5; i++) {
            float fi = float(i);
            float z = 60.0 + fi * 18.0;
            float y = 45.0 + 15.0 * hash11(fi + 60.0);
            float speed = (hash11(fi + 61.0) < 0.5 ? -1.0 : 1.0) * (10.0 + 8.0 * hash11(fi + 62.0));
            float x = mod(time * speed + fi * 37.0, 120.0) - 60.0;
            vec3 car = vec3(x, y, z) - ro;
            vec3 cd = normalize(car);
            float a = acos(clamp(dot(cd, rd), -1.0, 1.0));
            col += vec3(1.0, 0.92, 0.85) * exp(-a * a * 1.5e6) * 2.5;
            col += mix(vec3(1.0, 0.2, 0.3), vec3(0.3, 0.8, 1.0), step(0.0, speed)) * exp(-a * a * 1.2e5) * 0.5;
        }
    }
    return col;
}

vec3 fog(vec3 col, float t, vec3 rd) {
    vec3 fc = mix(vec3(0.20, 0.06, 0.24), vec3(0.06, 0.10, 0.20), smoothstep(-0.1, 0.4, rd.y));
    return mix(col, fc, 1.0 - exp(-t * 0.011));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float time = iTime;
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    vec3 ro = vec3((iOffset.x - 0.5) * 0.8, EYE, 0.0);
    vec3 rd = normalize(vec3(p.x, p.y + 0.10, 1.15));

    float tA;
    vec3 hp;
    vec3 col = traceAbove(ro, rd, time, tA, hp);
    float tFinal = tA;

    // Wet ground.
    if (rd.y < 0.0) {
        float tg = -ro.y / rd.y;
        if (tg < tA) {
            vec3 gp = ro + rd * tg;
            tFinal = tg;
            vec2 g = gp.xz;
            float puddle = smoothstep(0.45, 0.6, fbm(g * 0.35 + 3.0));
            // Rain ripples: expanding rings in random cells.
            vec2 rc = g * 4.0;
            vec2 rid = floor(rc);
            vec2 rf = fract(rc) - 0.5;
            float ph = fract(time * 1.3 + hash12(rid));
            float ring = sin((length(rf) - ph * 0.5) * 60.0) * smoothstep(0.5 * ph + 0.06, 0.5 * ph, length(rf)) * (1.0 - ph);
            float rough = 0.16 - 0.13 * puddle;
            vec3 n = normalize(vec3((noise(g * 16.0) - 0.5) * rough + (noise(g * 3.0) - 0.5) * 0.06 + rf.x * ring * 0.12,
                                    1.0,
                                    (noise(g * 16.0 + 7.0) - 0.5) * rough + (noise(g * 3.0 + 5.0) - 0.5) * 0.06 + rf.y * ring * 0.12));
            vec3 rr = reflect(rd, n);
            float tR;
            vec3 hr;
            vec3 refl = traceAbove(gp + n * 0.01, rr, time, tR, hr);
            refl = fog(refl, tR, rr);
            float fres = mix(0.10, 0.85, puddle) * (0.6 + 0.4 * pow(1.0 - max(dot(n, -rd), 0.0), 3.0));
            vec3 asphalt = vec3(0.025, 0.022, 0.03) * (0.7 + 0.6 * fbm(g * 3.0));
            // Painted line down the middle, worn away.
            asphalt += vec3(0.25, 0.22, 0.12) * step(abs(g.x), 0.06) * step(0.5, fract(g.y * 0.25)) * (1.0 - puddle) * 0.4;
            col = asphalt + signSpill(gp, vec3(0.0, 1.0, 0.0), time) * 0.035 * (1.0 - puddle * 0.5);
            col = mix(col, refl, fres);
        }
    }

    // Steam rising from a vent by the right wall.
    if (rd.z > 0.0) {
        float ts = (16.0 - ro.z) / rd.z;
        if (ts > 0.0 && ts < tFinal) {
            vec3 sp = ro + rd * ts;
            float h = sp.y;
            float cx = 2.2 + 0.25 * sin(h * 0.8 - time * 0.7);
            float wdt = 0.35 + h * 0.22;
            float shape = exp(-pow((sp.x - cx) / wdt, 2.0)) * smoothstep(0.0, 0.3, h) * exp(-h / 3.0);
            float d = fbm(vec2(sp.x * 1.4, h * 1.1 - time * 0.9)) * fbm(vec2(sp.x * 2.3 + 4.0, h * 1.7 - time * 1.3) + 3.0);
            float a = clamp(shape * smoothstep(0.08, 0.35, d) * 1.8, 0.0, 0.8);
            vec3 sc = vec3(0.30, 0.25, 0.35) + signSpill(sp, vec3(0.0, 0.0, -1.0), time) * 0.08;
            col = mix(col, sc, a);
        }
    }

    col = fog(col, tFinal, rd);

    // Rain: three layers of slanted streaks, lit pink and cyan by the street.
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float sc = 22.0 + fi * 16.0;
        vec2 uv = vec2(p.x + p.y * 0.12, p.y) * sc;
        uv.y += time * (14.0 + fi * 6.0);
        uv.x += fi * 3.7;
        vec2 id = floor(vec2(uv.x, uv.y / 6.0));
        vec2 f = vec2(fract(uv.x), fract(uv.y / 6.0));
        float r = hash12(id + fi * 10.0);
        float x = 0.2 + 0.6 * hash12(id + 5.0 + fi);
        float streak = smoothstep(0.045, 0.0, abs(f.x - x)) * smoothstep(0.0, 0.25, f.y) * smoothstep(1.0, 0.75, f.y) * step(0.55, r);
        vec3 tint = mix(vec3(1.0, 0.55, 0.85), vec3(0.6, 0.9, 1.0), hash12(id + 2.0));
        col += tint * streak * (0.10 - fi * 0.02);
    }

    // Lens grade: lift the blacks toward violet, gentle vignette.
    col = col / (1.0 + col * 0.6) * 1.3;
    col += vec3(0.015, 0.005, 0.025);
    col *= 1.0 - 0.35 * dot(p * vec2(1.6, 0.9), p * vec2(1.6, 0.9));
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
