// Solar Bay: a bright tropical megacity on a turquoise bay. Glass spires carry holo billboards,
// a skybridge strings across to the green headland, boats idle on the water and a flying car
// slips past. Palm fronds sway across the top of the frame. Swipe to pan the city.

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

const float HORIZON = -0.07;

// ---------------------------------------------------------------- sky
vec3 sky(vec2 p, float t) {
    float k = clamp((p.y - HORIZON) / 0.55, 0.0, 1.0);
    vec3 col = mix(vec3(0.78, 0.90, 0.97), vec3(0.16, 0.42, 0.86), pow(k, 0.7));
    // cumulus band: a soft fbm mask, lit from above
    vec2 q = p * vec2(4.0, 7.0) + vec2(t * 0.012, 0.0);
    float band = smoothstep(-0.02, 0.10, p.y) * smoothstep(0.48, 0.22, p.y);
    float n = fbm(q);
    float d = smoothstep(0.48, 0.70, n) * band;
    float under = fbm(q + vec2(0.0, -0.35));
    vec3 cloud = mix(vec3(0.70, 0.76, 0.86), vec3(1.0), smoothstep(0.35, 0.65, n - under * 0.4 + 0.2));
    return mix(col, cloud, d);
}

// ---------------------------------------------------------------- towers (right side)
// returns (mask, glow) and writes the tower colour
float towers(vec2 p, float t, out vec3 tc) {
    tc = vec3(0.0);
    float m = 0.0;
    for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float far = 1.0 - fi / 7.0;                     // first towers are the farthest
        float cx = 0.215 - fi * 0.040 + 0.012 * (hash11(fi * 3.1) - 0.5);
        float w = mix(0.014, 0.030, hash11(fi * 7.7)) * (0.75 + 0.45 * (1.0 - far));
        float top = mix(0.08, 0.36, hash11(fi * 1.9 + 0.3)) + (1.0 - far) * 0.06;
        if (i == 5) top = 0.40;
        float dx = abs(p.x - cx);
        // stepped setbacks and a needle spire
        float wy = w * mix(1.0, 0.55, smoothstep(top - 0.12, top, p.y));
        float body = step(dx, wy) * step(p.y, top) * step(HORIZON - 0.02, p.y);
        float spire = step(dx, 0.0015) * step(p.y, top + 0.05 + 0.04 * hash11(fi)) * step(top, p.y);
        float mk = max(body, spire);
        if (mk > 0.0) {
            // sunlit left face, shaded right face, floor lines and lit windows
            float side = step(cx, p.x);
            vec3 glass = mix(vec3(0.55, 0.70, 0.86), vec3(0.16, 0.22, 0.38), side);
            glass = mix(glass, vec3(0.85, 0.93, 1.0), 0.3 * smoothstep(0.1, 0.45, p.y) * (1.0 - side));
            glass *= 0.85 + 0.15 * step(0.25, fract(p.y * 140.0));
            vec2 g = vec2((p.x - cx) * 220.0, p.y * 140.0);
            float win = step(0.3, fract(g.x)) * step(0.45, fract(g.y)) * step(0.6, hash12(floor(g) + fi * 13.0));
            glass += vec3(0.30, 0.85, 1.0) * win * 0.30 * (0.3 + 0.7 * side);
            // vertical neon trims
            glass += vec3(0.50, 0.35, 1.0) * smoothstep(0.0012, 0.0, abs(dx - wy * 0.9)) * 0.8;
            // holo billboard on the nearer towers
            if (i == 2 || i == 5) {
                vec2 b = vec2((p.x - cx) / (wy * 0.8), (p.y - (top - 0.11)) / 0.045);
                if (abs(b.x) < 1.0 && abs(b.y) < 1.0) {
                    float k = b.y * 0.5 + 0.5;
                    vec3 ad = mix(vec3(1.0, 0.35, 0.55), vec3(0.45, 0.30, 1.0), k);
                    // striped synthwave sun sinking into the ad's horizon
                    vec2 sb = b * vec2(1.0, 1.6) - vec2(0.0, -0.25);
                    float sun = smoothstep(0.62, 0.58, length(sb)) * step(-0.25, b.y)
                              * step(0.35, fract(b.y * 6.0 + 0.2) + step(0.15, b.y));
                    ad = mix(ad, mix(vec3(1.0, 0.9, 0.4), vec3(1.0, 0.45, 0.6), -b.y), sun);
                    ad *= 0.85 + 0.15 * sin(b.y * 40.0 - t * 4.0);
                    ad *= 0.8 + 0.2 * step(0.06, fract(t * 0.13 + fi * 0.3));
                    glass = ad * 1.15;
                }
            }
            glass = mix(glass, vec3(0.70, 0.84, 0.95), far * 0.30);   // aerial haze
            tc = glass;
            m = mk;
        }
    }
    return m;
}

// ---------------------------------------------------------------- palm frond
float frond(vec2 p, vec2 base, float ang, float len, float droop) {
    vec2 d = p - base;
    float c = cos(ang), s = sin(ang);
    vec2 q = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
    float u = q.x / len;
    if (u < 0.0 || u > 1.0) return 0.0;
    float v = q.y + droop * u * u * len;
    float w = 0.30 * len * sin(3.1416 * clamp(u * 1.1, 0.0, 1.0)) * (1.0 - 0.35 * u);
    float rib = smoothstep(0.004, 0.0015, abs(v)) * step(u, 0.97);
    // leaflets: narrow blades that sweep toward the tip and taper to a point
    float along = clamp(abs(v) / max(w, 1e-4), 0.0, 1.0);
    float cell = fract(u * 20.0 - along * 1.6) - 0.5;
    float thick = 0.30 * (1.0 - along * 0.9);
    float leaf = step(abs(v), w) * smoothstep(thick, thick - 0.12, abs(cell));
    return max(rib, leaf);
}

vec3 scene(vec2 p, float t) {
    vec3 col = sky(p, t);

    // headland on the left: a green mountain sinking into haze
    float hx = p.x + 0.13;
    float mh = HORIZON + 0.13 * exp(-hx * hx / 0.006) + 0.025 * fbm(vec2(p.x * 14.0, 1.0));
    if (p.y < mh && p.y > HORIZON) {
        float sh = fbm(p * vec2(40.0, 60.0));
        vec3 rock = mix(vec3(0.18, 0.38, 0.30), vec3(0.42, 0.58, 0.40), sh);
        col = mix(rock, vec3(0.70, 0.84, 0.92), 0.35 + 0.3 * smoothstep(mh - 0.02, mh, p.y));
        col += vec3(1.0, 0.4, 0.8) * 0.25 * step(0.97, hash12(floor(p * vec2(300.0, 200.0)))) * step(p.y, mh - 0.02);
    }

    // far skyline on the horizon
    float fb = HORIZON + 0.012 * step(0.4, hash11(floor(p.x * 160.0))) + 0.01 * hash11(floor(p.x * 90.0));
    if (p.y < fb && p.y > HORIZON - 0.002) col = mix(col, vec3(0.62, 0.74, 0.86), 0.8);

    vec3 tc;
    float tm = towers(p, t, tc);
    col = mix(col, tc, tm);

    // skybridge from the headland to the towers
    float by = 0.03 + 0.03 * (1.0 - smoothstep(-0.25, 0.10, p.x)) + 0.012 * sin(p.x * 10.0);
    float bridge = smoothstep(0.003, 0.0, abs(p.y - by)) * step(-0.24, p.x) * step(p.x, 0.12);
    col = mix(col, vec3(0.25, 0.30, 0.40), bridge);
    col += vec3(0.4, 0.8, 1.0) * smoothstep(0.0015, 0.0, abs(p.y - by - 0.003)) * step(0.5, fract(p.x * 120.0)) * step(-0.24, p.x) * step(p.x, 0.12);

    // flying car: crosses every 22 s with a cyan underglow
    float ph = fract(t / 22.0);
    vec2 car = vec2(mix(-0.35, 0.35, ph), 0.19 + 0.02 * sin(ph * 6.0));
    vec2 cd = (p - car) * vec2(1.0, 2.6);
    float body = smoothstep(0.013, 0.010, length(cd));
    col = mix(col, vec3(0.12, 0.13, 0.20), body);
    col += vec3(0.3, 0.9, 1.0) * smoothstep(0.012, 0.0, length((p - car - vec2(0.0, -0.006)) * vec2(0.6, 3.0)));
    float trail = smoothstep(0.003, 0.0, abs(p.y - car.y)) * smoothstep(-0.12, 0.0, p.x - car.x) * step(p.x, car.x);
    col += vec3(0.5, 0.9, 1.0) * trail * 0.5;
    return col;
}

vec3 water(vec2 p, vec2 uv, float t) {
    float depth = (HORIZON - p.y) / 0.30;                 // 0 at horizon, 1 near the shore
    vec3 col = mix(vec3(0.28, 0.66, 0.82), vec3(0.08, 0.80, 0.82), smoothstep(0.0, 1.0, depth));
    // reflections of towers and sky, broken up by ripples
    float rip = (noise(vec2(p.x * 60.0, p.y * 300.0 - t * 1.5)) - 0.5) * 0.012 * (0.3 + depth);
    vec2 r = vec2(p.x + rip, 2.0 * HORIZON - p.y);
    vec3 tc;
    float tm = towers(r, t, tc);
    col = mix(col, mix(col, tc, 0.38), tm * (1.0 - depth) * (0.6 + 0.4 * noise(vec2(p.x * 90.0, p.y * 40.0 - t))));
    // sun glitter
    float g = noise(vec2(p.x * 220.0 + t * 0.6, p.y * 900.0 - t * 2.0));
    col += vec3(1.0, 0.97, 0.85) * pow(g, 14.0) * 1.6 * (1.0 - 0.5 * depth);
    // boats
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        vec2 bp = vec2(fract(hash11(fi * 5.3) + t * (0.002 + 0.002 * fi)) * 0.6 - 0.3, HORIZON - 0.05 - 0.07 * fi);
        float sz = 0.010 + 0.006 * fi;
        vec2 d = (p - bp) / sz;
        float hull = step(abs(d.x), 1.0 - max(d.y, 0.0) * 0.0) * step(-0.35, d.y) * step(d.y, 0.0);
        float cabin = step(abs(d.x + 0.2), 0.45) * step(0.0, d.y) * step(d.y, 0.45);
        col = mix(col, vec3(0.95, 0.96, 0.98), max(hull, cabin));
        float wake = smoothstep(0.004, 0.0, abs(p.y - bp.y + sz * 0.35)) * smoothstep(sz * 6.0, 0.0, bp.x - p.x) * step(p.x, bp.x);
        col += vec3(0.8) * wake * 0.4;
    }
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    vec2 p = uv + vec2((iOffset.x - 0.5) * 0.10, 0.0);

    vec3 col = p.y > HORIZON ? scene(p, t) : water(p, uv, t);

    // beach and foreground foliage
    float shore = -0.33 + 0.025 * sin(p.x * 9.0 + 1.0);
    if (uv.y < shore + 0.02) {
        float sand = smoothstep(shore + 0.02, shore + 0.005, uv.y);
        col = mix(col, vec3(0.93, 0.85, 0.70), sand * 0.9);
        col = mix(col, vec3(0.80, 0.95, 0.95), smoothstep(0.004, 0.0, abs(uv.y - shore - 0.016 - 0.002 * sin(t * 1.4 + p.x * 40.0))) * 0.8);
    }
    vec2 fp = uv + vec2((iOffset.x - 0.5) * 0.03, 0.0);
    float bush = fbm(fp * vec2(18.0, 14.0) + vec2(0.0, 3.0));
    float edge = -0.40 + 0.10 * smoothstep(0.05, 0.25, abs(fp.x)) + 0.06 * bush;
    if (uv.y < edge) {
        float lit = fbm(fp * 60.0);
        vec3 leaf = mix(vec3(0.06, 0.22, 0.10), vec3(0.30, 0.55, 0.18), lit * smoothstep(edge - 0.08, edge, uv.y));
        float flower = step(0.93, hash12(floor(fp * 120.0))) * step(0.3, lit) * smoothstep(0.42, 0.25, length(fract(fp * 120.0) - 0.5));
        leaf = mix(leaf, vec3(1.0, 0.35, 0.55), flower);
        col = mix(col, leaf, smoothstep(edge, edge - 0.006, uv.y));
    }

    // palm fronds framing the top, swaying in the sea breeze
    float sw = sin(t * 0.7) * 0.04 + sin(t * 1.9) * 0.012;
    vec2 qp = uv + vec2((iOffset.x - 0.5) * 0.02, 0.0);
    float f = 0.0;
    f = max(f, frond(qp, vec2(-0.30, 0.52), -0.55 + sw, 0.38, 0.45));
    f = max(f, frond(qp, vec2(-0.30, 0.52), -0.15 + sw * 0.8, 0.34, 0.65));
    f = max(f, frond(qp, vec2(-0.28, 0.55), -0.95 + sw * 1.2, 0.30, 0.30));
    f = max(f, frond(qp, vec2(0.30, 0.40), 3.6 - sw, 0.30, -0.55));
    f = max(f, frond(qp, vec2(0.30, 0.44), 3.25 - sw * 0.7, 0.26, -0.35));
    vec3 frondCol = mix(vec3(0.05, 0.16, 0.06), vec3(0.45, 0.62, 0.15), smoothstep(0.1, 0.5, uv.y) * 0.6);
    col = mix(col, frondCol, f);

    // warm sunlight and a soft vignette
    col *= vec3(1.04, 1.0, 0.95);
    vec2 v = fragCoord / iResolution.xy - 0.5;
    col *= 1.0 - 0.35 * dot(v, v);
    fragColor = vec4(col, 1.0);
}
