// Rainglass: the view from a capsule-apartment window on a wet night. The neon city melts into
// bokeh behind the glass, and every raindrop is a tiny lens that brings it back into focus.
// Drops stick and slip down the pane, leave beaded trails and wipe paths through the fog, while
// a skytrain slides past and a blade sign flickers. Swipe to pan the city behind the fixed glass.

const float TAU = 6.2831853;

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

vec2 hash22(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yzx + 33.33);
    return fract((q.xx + q.yz) * q.zy);
}

float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash11(i), hash11(i + 1.0), f * f * (3.0 - 2.0 * f));
}

vec3 neon(float h) {
    if (h < 0.34) return vec3(1.00, 0.31, 0.85);   // synthwave pink
    if (h < 0.58) return vec3(0.49, 0.36, 1.00);   // violet
    if (h < 0.82) return vec3(0.15, 0.85, 1.00);   // cyan
    return vec3(1.00, 0.62, 0.22);                 // sodium amber
}

// ---------------------------------------------------------------- the city behind the glass
// focus: 0 = seen through the fogged pane (soft bokeh), 1 = through a drop (sharp).

vec3 bokeh(vec2 p, float focus, float t) {
    vec3 col = vec3(0.0);
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float s = 5.0 + fi * 4.0;
        vec2 q = p * s + vec2(fi * 13.7, fi * 5.3);
        // two layers are streams of flying cars, the others are windows and signs
        if (i == 1) q.x += t * 0.9;
        if (i == 3) q.x -= t * 1.3;
        vec2 id = floor(q);
        vec2 f = fract(q) - 0.5;
        float n = hash12(id + fi * 31.0);
        float yw = p.y + 0.5;                       // 0 at the bottom of the screen
        float dens = smoothstep(0.85, 0.35, yw);    // denser low in the city
        if (i == 1 || i == 3) dens *= step(abs(fract(id.y * 0.37) - 0.5), 0.12) * 1.6;
        if (n > dens * 0.45) continue;
        vec2 c = (hash22(id + 7.0) - 0.5) * 0.3;   // c + r stays inside the cell
        float r = mix(mix(0.14, 0.34, hash11(n * 17.0)), 0.07, focus);
        float d = length(f - c);
        float disc = smoothstep(r, r - mix(0.05, 0.015, focus), d);
        float rim = smoothstep(r - 0.06, r, d) * (1.0 - focus);   // lens-like brighter rim
        float tw = 0.75 + 0.25 * sin(t * (1.0 + 3.0 * n) + n * TAU);
        vec3 lc = neon(hash11(n * 91.7));
        if (i == 1) lc = vec3(1.0, 0.25, 0.18);     // tail lights
        if (i == 3) lc = vec3(0.85, 0.95, 1.0);     // headlights
        float gain = mix(0.5, 1.5, focus) * mix(0.35, 1.5, hash11(n * 5.3)) / (1.0 + fi * 0.35);
        col += lc * (disc * (1.0 + 0.6 * rim)) * tw * gain;
    }
    return col;
}

vec3 city(vec2 p, float focus, float t) {
    float y = p.y;
    // sky: deep violet overhead, magenta smog glow above the streets
    vec3 col = mix(vec3(0.16, 0.03, 0.17), vec3(0.015, 0.01, 0.045), smoothstep(-0.25, 0.45, y));
    col += vec3(0.30, 0.06, 0.22) * exp(-abs(y + 0.12) * 6.0);

    // two rows of tower silhouettes with lit windows
    for (int k = 0; k < 2; k++) {
        float fk = float(k);
        float w = 14.0 - fk * 6.0;
        float bx = p.x * w + fk * 3.1;
        float id = floor(bx);
        float h = mix(-0.02, 0.40, pow(hash11(id + fk * 17.0), 1.5)) - fk * 0.16;
        float soft = mix(0.035, 0.004, focus);
        float m = smoothstep(h + soft, h - soft, y);
        float edge = fract(bx);
        m *= smoothstep(0.0, soft * w, edge) * smoothstep(1.0, 1.0 - soft * w, edge);
        vec2 wq = vec2(bx * 6.0, y * 70.0 + fk * 11.0);
        float lit = step(0.72, hash12(floor(wq) + id * 3.0)) * step(0.35, fract(wq.x)) * step(0.4, fract(wq.y));
        float glow = mix(0.12, lit, smoothstep(0.6, 1.0, focus));
        vec3 wc = mix(vec3(1.0, 0.70, 0.40), neon(hash11(id * 1.3)), 0.4);
        vec3 tower = mix(vec3(0.03, 0.015, 0.06), vec3(0.06, 0.02, 0.07), fk);
        col = mix(col, tower + wc * glow * (0.5 + 0.5 * fk), m);
    }

    // aircraft beacons on the tallest roofs
    for (int k = 0; k < 3; k++) {
        float fk = float(k);
        vec2 bp = p - vec2(-0.17 + fk * 0.16, 0.30 + 0.06 * hash11(fk * 4.1));
        float bl = step(0.8, fract(t * 0.5 + fk * 0.37));
        float br = mix(0.02, 0.004, focus);
        col += vec3(1.0, 0.12, 0.10) * smoothstep(br, 0.0, length(bp)) * bl * 1.5;
    }

    // giant holo-ad hanging in the smog: a cyan panel with a pulsing ring logo and scanlines
    vec2 hp = p - vec2(-0.08, 0.17);
    vec2 hs = vec2(0.11, 0.075);
    float hsoft = mix(0.03, 0.004, focus);
    vec2 he = abs(hp) - hs;
    float panel = smoothstep(hsoft, -hsoft, max(he.x, he.y));
    float ring = smoothstep(0.012, 0.0, abs(length(hp) - 0.04 - 0.008 * sin(t * 2.0)));
    float scan = 0.75 + 0.25 * sin(hp.y * 900.0 - t * 6.0);
    float roll = smoothstep(0.02, 0.0, abs(fract(t * 0.15) * 0.2 - 0.1 - hp.y));
    vec3 holo = mix(vec3(0.10, 0.75, 1.00), vec3(1.0, 0.31, 0.85), 0.5 + 0.5 * sin(t * 0.4));
    float hflick = 0.85 + 0.15 * step(0.1, noise(t * 4.0 + 50.0));
    col += holo * panel * (0.18 + mix(0.15, 0.9, focus) * ring + 0.3 * roll) * mix(1.0, scan, focus) * hflick;
    col += holo * 0.06 * exp(-length(max(he, 0.0)) * 18.0);

    col += bokeh(p, focus, t);

    // blade sign: a tall pink strip with glyph blocks, buzzing now and then
    vec2 sp = p - vec2(0.13, 0.02);
    float bw = mix(0.035, 0.022, focus);
    float sign = smoothstep(bw, bw - mix(0.03, 0.004, focus), abs(sp.x)) *
                 smoothstep(0.22, 0.20, abs(sp.y));
    vec2 gq = vec2(sp.x * 70.0, sp.y * 40.0);
    float glyph = step(0.45, hash12(floor(gq) + floor(t * 0.25) * 7.0)) * step(abs(sp.x), 0.016);
    float buzz = step(0.08, noise(t * 9.0)) * (0.85 + 0.15 * sin(t * 120.0));
    vec3 sc = vec3(1.0, 0.31, 0.85);
    col += sc * sign * mix(0.35, 0.25 + 1.1 * glyph, focus) * buzz;
    col += sc * 0.10 * exp(-abs(sp.x) * 25.0) * smoothstep(0.35, 0.0, abs(sp.y)) * buzz;

    // skytrain: crosses on an elevated line every 28 s
    float ty = -0.07;
    float head = fract(t / 28.0) * 2.4 - 0.9;
    float along = head - p.x;
    float body = step(0.0, along) * step(along, 0.7);
    float th = mix(0.022, 0.006, focus);
    float band = smoothstep(th, 0.0, abs(y - ty));
    float wins = mix(0.55, step(0.4, fract(p.x * 90.0)), focus);
    col += vec3(0.55, 0.95, 1.0) * band * body * wins * 0.9;
    col += vec3(0.15, 0.6, 1.0) * exp(-abs(y - ty) * 30.0) * body * 0.12;
    col += vec3(0.08, 0.02, 0.06) * smoothstep(0.004, 0.0, abs(y - ty + 0.012)); // the rail
    return col;
}

// ---------------------------------------------------------------- the glass
// Each drop layer returns (refraction offset, drop mask, trail mask).

vec4 staticDrops(vec2 uv, float t, float scale, inout float spec) {
    vec2 st = uv * scale;
    vec2 id = floor(st);
    vec2 f = fract(st) - 0.5;
    vec2 n = hash22(id);
    vec2 d = f - (n - 0.5) * 0.7;
    float life = fract(t * 0.05 + n.x * 3.0);
    float fade = smoothstep(0.0, 0.05, life) * smoothstep(1.0, 0.5, life);
    float r = 0.04 + 0.10 * n.y;
    float m = smoothstep(r, r * 0.55, length(d)) * fade * step(0.35, n.x);
    spec += smoothstep(r * 0.3, 0.0, length(d - vec2(-0.3, 0.35) * r)) * m;
    return vec4(d / scale * 3.0 * m, m, 0.0);
}

// How far a sliding drop has travelled down its cell (0..1) at phase ph of its run. Two stacked
// monotonic warps make it creep, cling and surge at irregular moments instead of on a beat, and
// the blend with s*s lets it pick up speed as it gathers water on the way down.
float travel(float ph, float n) {
    float k = ph * 3.0 + n * 7.0;
    float w = k + 0.3 * sin(k * 1.37 + n * 40.0);
    return w - 0.85 * sin(TAU * w) / TAU;
}

vec4 slidingDrops(vec2 uv, float t, float scale, inout float spec) {
    // tall cells, each holding one drop that sticks and slips down
    vec2 st = uv * scale * vec2(1.0, 1.0 / 3.0);
    vec2 id = floor(st);
    vec2 q = (fract(st) - 0.5) * vec2(1.0, 3.0);    // isotropic cell units, y in -1.5..1.5
    float n = hash11(id.x * 7.31 + id.y * 1.17);
    float c = t * (0.06 + 0.06 * n) + n * 10.0;
    float cyc = floor(c);
    float ph = fract(c);
    float f0 = travel(0.0, n);
    float span = travel(1.0, n) - f0;
    float s = (travel(ph, n) - f0) / span;
    float v = (travel(ph + 0.01, n) - travel(ph, n)) / (0.01 * span);   // 1 = average speed
    s = mix(s, s * s, 0.35);
    float y0 = 1.25 - 2.5 * s;
    float bx = (hash11(n * 33.0 + cyc) - 0.5) * 0.6;
    float wob = n * 20.0 + cyc;
    float x0 = bx + 0.05 * sin(y0 * 4.0 + wob) + 0.025 * sin(y0 * 9.3 + wob * 1.7);
    float xp = bx + 0.05 * sin(q.y * 4.0 + wob) + 0.025 * sin(q.y * 9.3 + wob * 1.7);
    float alive = step(0.3, hash11(n * 51.0 + cyc));
    float fade = smoothstep(0.0, 0.04, ph) * smoothstep(1.0, 0.9, ph) * alive;

    vec2 d = q - vec2(x0, y0);
    d.y *= mix(1.0, 1.35, step(0.0, d.y));          // pointed top, round belly
    d.y /= 1.0 + 0.2 * clamp(v - 1.0, 0.0, 2.0);    // stretches out while it surges
    float r = 0.11 + 0.05 * n;
    float m = smoothstep(r, r * 0.6, length(d)) * fade;
    spec += smoothstep(r * 0.3, 0.0, length(d - vec2(-0.3, 0.4) * r)) * m;

    // beaded trail and the wiped strip above the drop
    float above = smoothstep(-0.05, 0.1, q.y - y0) * smoothstep(1.5, y0, q.y);
    float wipe = smoothstep(0.12, 0.04, abs(q.x - xp)) * above * fade;
    vec2 td = vec2(q.x - xp, (fract(q.y * 6.0 + n) - 0.5) / 6.0);
    float bead = hash11(floor(q.y * 6.0 + n) + n * 13.0 + cyc);
    float tr = 0.025 + 0.025 * bead;
    float tm = smoothstep(tr, tr * 0.4, length(td)) * above * step(0.4, bead) * fade;

    vec2 off = (d * m * 3.2 + td * tm * 4.0) / scale;
    return vec4(off, max(m, tm), wipe);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;

    float spec = 0.0;
    vec4 a = slidingDrops(uv, t, 9.0, spec);
    vec4 b = slidingDrops(uv + vec2(0.31, 0.17), t * 0.8 + 41.0, 14.0, spec);
    vec4 c = staticDrops(uv, t, 32.0, spec);
    vec4 e = staticDrops(uv + 0.37, t + 17.0, 52.0, spec);
    vec2 off = a.xy + b.xy + c.xy + e.xy;
    float drop = clamp(a.z + b.z + c.z + e.z, 0.0, 1.0);
    float wipe = clamp(a.w + b.w, 0.0, 1.0);

    // the city sits far behind the glass, so it pans on swipe while the drops stay put
    vec2 p = uv + vec2((iOffset.x - 0.5) * 0.12, 0.0);
    // drops flip and magnify what is behind them
    vec2 sp = p - off * 0.9;
    // big drops focus sharply, the fine mist of droplets only partly
    float focus = max(max(a.z, b.z) * 0.75, max(max(c.z * 0.6, e.z * 0.4), wipe * 0.5));
    vec3 col = city(sp, focus, t);

    // fog on the pane: mist dims and lifts the background, except where drops cleared it
    float fog = (1.0 - focus) * mix(0.55, 0.25, smoothstep(-0.5, 0.4, uv.y));
    col = mix(col, col * 0.55 + vec3(0.05, 0.03, 0.08), fog);

    // drop shading: clear water, a faint dark meniscus and a glint from the street light
    float edge = drop * (1.0 - drop);
    col *= 1.0 + 0.3 * drop - 0.5 * edge;
    col += vec3(1.0, 0.85, 1.0) * clamp(spec, 0.0, 1.0) * 0.25;

    // window frame shadow at the bottom and a soft vignette
    col *= smoothstep(-0.52, -0.42, uv.y) * 0.6 + 0.4;
    vec2 v = fragCoord / iResolution.xy - 0.5;
    col *= 1.0 - 0.6 * dot(v * vec2(1.2, 0.8), v * vec2(1.2, 0.8));

    col = 1.0 - exp(-col * 1.25);                    // gentle tone map keeps neon from clipping
    col = pow(col, vec3(0.95));
    col += (hash12(fragCoord + fract(t) * 91.0) - 0.5) * 0.015;   // a touch of grain
    fragColor = vec4(col, 1.0);
}
