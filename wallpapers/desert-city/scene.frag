// Desert City: a vast dune sea at golden hour, mountains behind, and a far-off city shimmering in the heat.

const float HZ = -0.04;                   // horizon height on screen
const vec2 SUN = vec2(-0.10, 0.10);       // sun position on screen
const vec3 HAZE = vec3(1.0, 0.70, 0.48);

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

float noise1(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash11(i), hash11(i + 1.0), f * f * (3.0 - 2.0 * f));
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
               mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}

float fbm1(float x) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise1(x);
        x = x * 2.03 + 1.7;
        a *= 0.5;
    }
    return v;
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = p * 2.02 + vec2(3.1, 1.7);
        a *= 0.5;
    }
    return v;
}

// Ridged mountain profile.
float ridge(float x) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * (1.0 - abs(noise1(x) * 2.0 - 1.0));
        x = x * 2.1 + 3.3;
        a *= 0.5;
    }
    return v;
}

// Dune profile: long windward rise on the left, short slip face on the right, a sharp crest and
// rounded troughs. Returns height in .x and, in .y, how deep the shadowed slip face hangs below
// the crest (as a fraction of the dune's height).
vec2 dune(float x, float freq, float seed) {
    float u = x * freq + seed + 0.8 * fbm1(x * freq * 0.35 + seed);
    float f = fract(u);
    float c = 0.72;
    float tri = f < c ? f / c : (1.0 - f) / (1.0 - c);
    float size = 0.75 + 0.5 * noise1(floor(u) * 3.7 + seed);
    float h = tri * tri * size;
    float slip = f < c ? smoothstep(c - 0.10, c, f) : 1.0;
    return vec2(h, 0.9 * size * pow(tri, 1.3) * slip);
}

vec3 sky(vec2 p, float t) {
    float e = p.y - HZ;
    vec3 col = mix(HAZE, vec3(0.93, 0.55, 0.42), smoothstep(0.0, 0.12, e));
    col = mix(col, vec3(0.45, 0.42, 0.62), smoothstep(0.08, 0.32, e));
    col = mix(col, vec3(0.12, 0.16, 0.36), smoothstep(0.28, 0.58, e));

    float d = length(p - SUN);
    col += vec3(1.0, 0.75, 0.45) * exp(-d * 9.0) * 0.55;
    col += vec3(1.0, 0.85, 0.60) * exp(-d * 30.0) * 0.6;
    col = mix(col, vec3(1.0, 0.95, 0.82), smoothstep(0.034, 0.030, d));

    // High wisps drifting slowly.
    vec2 cp = vec2(p.x * 3.0 + t * 0.004, (p.y - HZ) * 14.0);
    float c = fbm(cp * vec2(1.0, 1.0) + vec2(0.0, fbm(cp * 0.5) * 1.5));
    float a = smoothstep(0.55, 0.80, c) * smoothstep(0.10, 0.20, e) * (1.0 - smoothstep(0.42, 0.55, e));
    vec3 cc = mix(vec3(1.0, 0.72, 0.58), vec3(0.75, 0.55, 0.70), smoothstep(0.15, 0.45, e));
    col = mix(col, cc, a * 0.55);
    return col;
}

// Distant futuristic skyline. Returns colour in .rgb and coverage in .a.
float blocks(float x, float W, float seed, float env, out float inside) {
    float id = floor(x / W);
    float fx = fract(x / W);
    float h1 = hash11(id * 1.37 + seed);
    float h2 = hash11(id * 2.91 + seed + 7.0);
    float inset = 0.04 + 0.16 * hash11(id + seed + 11.0);
    inside = step(inset, fx) * step(fx, 1.0 - inset);
    float height = env * (0.010 + 0.050 * h1 * h1) * inside;
    // Stepped crowns and the odd needle.
    height += env * 0.012 * step(0.6, h2) * step(abs(fx - 0.5), 0.22) * inside;
    height += env * (0.03 + 0.04 * h1) * step(0.88, h2) * max(0.0, 1.0 - abs(fx - 0.5) / 0.06);
    return height;
}

vec4 city(vec2 p, float t) {
    const float CX = 0.085;
    float x = p.x - CX;
    float env = exp(-pow(x / 0.07, 2.0));
    if (env < 0.03 || p.y > HZ + 0.17) return vec4(0.0);
    float aa = 1.0 / iResolution.y;

    float inBack;
    float back = HZ + blocks(p.x + 0.0021, 0.0050, 19.0, env * 0.8, inBack);
    float inFront;
    float front = HZ + blocks(p.x, 0.0075, 3.0, env, inFront);
    // Landmark towers: tapered, with a ring near the top.
    float t1 = abs(p.x - 0.062);
    float t2 = abs(p.x - 0.112);
    float tower1 = HZ + (0.150 - t1 * 9.0) * step(t1, 0.0045);
    float tower2 = HZ + (0.112 - t2 * 9.0) * step(t2, 0.0035);
    vec2 r1 = (p - vec2(0.062, HZ + 0.118)) / vec2(0.0105, 0.0024);
    vec2 r2 = (p - vec2(0.112, HZ + 0.088)) / vec2(0.0085, 0.0020);
    float rings = max(step(dot(r1, r1), 1.0), step(dot(r2, r2), 1.0));
    float frontTop = max(front, max(tower1, tower2));

    float covF = max(smoothstep(aa, -aa, p.y - frontTop), rings);
    float covB = smoothstep(aa, -aa, p.y - back);
    if (covF + covB <= 0.0) return vec4(0.0);

    vec3 backCol = mix(vec3(0.70, 0.50, 0.50), HAZE, 0.55);
    vec3 frontCol = mix(vec3(0.50, 0.32, 0.38), HAZE, 0.30);
    // Lit windows on the near blocks.
    vec2 wg = vec2(p.x * 1100.0, (p.y - HZ) * 800.0);
    float win = step(0.70, hash12(floor(wg))) * step(0.35, fract(wg.x)) * step(0.4, fract(wg.y));
    frontCol += vec3(1.0, 0.85, 0.6) * win * 0.22;
    // Sun catching the left faces.
    frontCol += vec3(1.0, 0.8, 0.55) * 0.12 * step(fract(p.x / 0.0075), 0.25);
    vec3 col = mix(backCol, frontCol, covF);
    float cov = max(covF, covB);

    float blink = step(0.5, fract(t * 0.5));
    vec2 b1 = p - vec2(0.062, HZ + 0.151);
    vec2 b2 = p - vec2(0.112, HZ + 0.113);
    vec3 beacon = vec3(1.0, 0.25, 0.20) * (exp(-dot(b1, b1) * 1.5e5) * blink + exp(-dot(b2, b2) * 1.5e5) * (1.0 - blink));
    return vec4(col + beacon, cov);
}

// Small aircraft drifting between the towers.
vec3 craft(vec2 p, float t) {
    vec3 col = vec3(0.0);
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float speed = 0.004 + 0.002 * fi;
        float x = 0.085 + mod(t * speed + fi * 0.13, 0.30) - 0.15;
        float y = HZ + 0.07 + 0.025 * fi + 0.004 * sin(t * 0.7 + fi);
        vec2 d = p - vec2(x, y);
        float blink = 0.6 + 0.4 * step(0.5, fract(t * 0.8 + fi * 0.3));
        col += vec3(1.0, 0.9, 0.75) * exp(-dot(d, d) * 4.0e5) * blink * 0.9;
    }
    return col;
}

vec3 sand(vec2 p, float top, float shadowBottom, float depth) {
    float aa = 1.5 / iResolution.y;
    float below = top - p.y;
    vec3 lit = vec3(0.98, 0.64, 0.38);
    vec3 shade = vec3(0.58, 0.33, 0.36);
    // Sunlit windward body: brightest just under the crest, warmer and darker further down.
    vec3 col = lit * (0.82 + 0.25 * exp(-below / (0.06 * depth)));
    // Slip-face shadow wedge under the crest.
    float inShadow = smoothstep(-aa * 2.0, aa * 2.0, p.y - shadowBottom);
    col = mix(col, shade * (0.9 + 0.2 * exp(-below / (0.03 * depth))), inShadow);
    // Warm rim along the crest itself.
    col += vec3(1.0, 0.8, 0.55) * smoothstep(0.004 * depth, 0.0, below) * 0.35 * (1.0 - 0.6 * inShadow);
    // Wind ripples, finer with distance.
    float rip = sin((p.x * 1.0 + p.y * 4.0) * 240.0 / depth + fbm(p * 30.0 / depth) * 5.0);
    col *= 1.0 + rip * 0.04 * smoothstep(0.4, 1.0, depth);
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float t = iTime;
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float par = iOffset.x - 0.5;
    float aa = 1.5 / iResolution.y;

    // Heat shimmer close to the horizon.
    float shimmer = 0.00035 * sin(p.y * 900.0 + t * 6.0) * exp(-abs(p.y - HZ) / 0.012);
    vec2 ps = vec2(p.x + shimmer, p.y);

    vec3 col = sky(p, t);

    // Far mountains.
    float x0 = ps.x + par * 0.01;
    float m0 = HZ + 0.020 + 0.09 * ridge(x0 * 3.0 + 4.0) * smoothstep(-0.45, 0.1, x0);
    vec3 c0 = mix(vec3(0.52, 0.42, 0.62), HAZE, 0.55);
    col = mix(col, c0, smoothstep(aa, -aa, ps.y - m0));

    // Nearer range.
    float x1 = ps.x + par * 0.02;
    float m1 = HZ + 0.008 + 0.055 * ridge(x1 * 5.0 + 9.0);
    vec3 c1 = mix(vec3(0.45, 0.30, 0.42), HAZE, 0.38);
    col = mix(col, c1, smoothstep(aa, -aa, ps.y - m1));

    // The city on the horizon, then traffic above it.
    vec4 cty = city(vec2(ps.x + par * 0.025, ps.y), t);
    col = mix(col, cty.rgb, cty.a);
    col += craft(vec2(p.x + par * 0.025, p.y), t);

    // Haze band sitting on the horizon.
    col = mix(col, HAZE, exp(-abs(p.y - (HZ + 0.005)) / 0.012) * 0.35);

    // Dune ranges, far to near.
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float depth = 0.25 + fi * 0.28;                // 0.25 far ... 1.09 near
        float xp = p.x + par * (0.04 + fi * 0.05);
        float base = HZ - 0.010 - fi * fi * 0.040 - fi * 0.022;
        float amp = 0.012 + fi * fi * 0.026;
        float freq = 9.0 / (1.0 + fi * 1.3);
        vec2 dn = dune(xp, freq, fi * 7.1 + 2.0);
        float hgt = base + amp * dn.x;
        if (p.y < hgt + aa) {
            vec3 sc = sand(vec2(xp, p.y), hgt, hgt - amp * dn.y, depth);
            sc = mix(sc, HAZE, (1.0 - depth) * 0.45);
            col = mix(col, sc, smoothstep(aa, -aa, p.y - hgt));
        }
        // Sand blowing off the crests, downwind to the right.
        float above = p.y - hgt;
        if (above > -0.004 && above < 0.03 * depth) {
            float s = fbm(vec2((xp - t * 0.035) * 60.0 / depth, above * 300.0 / depth));
            float a = smoothstep(0.5, 0.85, s) * exp(-above / (0.008 * depth)) * 0.45 * smoothstep(0.6, 1.0, dn.x);
            col = mix(col, vec3(1.0, 0.80, 0.58), a);
        }
    }

    // Low drifting sand haze over the whole desert floor.
    float drift = fbm(vec2(p.x * 6.0 - t * 0.03, p.y * 20.0));
    col = mix(col, HAZE, smoothstep(0.45, 0.9, drift) * 0.18 * smoothstep(HZ + 0.03, HZ - 0.15, p.y));

    // Gentle vignette.
    col *= 1.0 - 0.25 * pow(length(p * vec2(1.2, 0.9)), 2.0);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
