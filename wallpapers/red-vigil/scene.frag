// Red Vigil: a cat keeps watch at the mouth of a rain-soaked alley. Red and teal neon pours down
// the walls, a car idles in the mist with its brake lights on, and the flooded street mirrors it
// all, freckled with raindrop rings. The cat's tail never stops twitching.

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

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
               mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}

const float H = 0.45;          // the camera sits low, at a cat's eye height (m)
const float W = 4.0;           // half width of the alley
const float F = 0.30;          // focal length
const float VPY = -0.12;       // horizon
const vec3 MIST = vec3(0.32, 0.50, 0.52);
const vec3 RED = vec3(1.0, 0.13, 0.10);
const vec3 TEAL = vec3(0.35, 1.0, 0.92);

// walls, signs, the car and the misty sky: everything above the water
vec3 alley(vec2 p, float t, float vx) {
    float dx = p.x - vx;
    float dy = p.y - VPY;
    vec3 col = mix(MIST * 1.2, vec3(0.05, 0.12, 0.14), smoothstep(0.0, 0.55, dy));
    col += MIST * 0.5 * exp(-abs(dx) * 10.0) * smoothstep(0.5, 0.0, dy);

    float side = sign(dx);
    float z = F * W / max(abs(dx), 1e-3);
    float Y = dy * z / F + H;
    if (z < 90.0 && Y > 0.0 && Y < 30.0) {
        float bid = floor(z / 7.0) + (side > 0.0 ? 50.0 : 0.0);
        vec3 wall = vec3(0.05, 0.06, 0.07);
        // window grid, mostly dark, some red and teal
        vec2 g = vec2(z * 1.0, Y * 0.45);
        float wn = step(0.3, fract(g.x)) * step(0.4, fract(g.y));
        float hw = hash12(floor(g) + bid);
        wall += mix(RED * 0.6, TEAL * 0.4, step(0.6, hw)) * wn * step(0.75, hw) * 0.6;
        // fire escapes: zigzag stairs as dark bars
        float fe = smoothstep(0.08, 0.0, abs(fract(Y * 0.28 + (z - floor(z / 7.0) * 7.0) * 0.14) - 0.5) - 0.44);
        wall = mix(wall, vec3(0.02), fe * step(1.0, mod(z, 7.0)) * step(mod(z, 7.0), 3.5) * step(3.0, Y));
        float fog = 1.0 - exp(-z * 0.045);
        col = mix(wall, MIST * 0.9, fog);
        // neon spill on the walls near each sign
        col += RED * 0.12 * (1.0 - fog) * step(0.5, hash11(bid));
    }

    // vertical signs jutting from both walls
    for (int i = 0; i < 9; i++) {
        float fi = float(i);
        float s = mod(fi, 2.0) * 2.0 - 1.0;
        float sz = 40.0 / (fi * 0.9 + 1.0);
        float x0 = vx + F * s * W / sz;
        float x1 = vx + F * s * (W - 0.6) / sz;
        float y0 = 2.5 + 5.0 * hash11(fi * 5.3);
        float y1 = y0 + 4.0 + 6.0 * hash11(fi * 2.9);
        float sy0 = VPY + F * (y0 - H) / sz, sy1 = VPY + F * (y1 - H) / sz;
        vec3 nc = hash11(fi * 3.7) < 0.7 ? RED : TEAL;
        float buzz = 0.7 + 0.3 * step(0.2, noise(vec2(t * 7.0, fi * 5.0)));
        float fog = 1.0 - exp(-sz * 0.045);
        vec2 c = vec2(0.5 * (x0 + x1), 0.5 * (sy0 + sy1));
        vec2 e = vec2(abs(x1 - x0), sy1 - sy0) * 0.5;
        vec2 q = (p - c) / e;
        if (abs(q.x) < 1.0 && abs(q.y) < 1.0) {
            vec2 gq = vec2(q.x * 1.5 + 1.5, q.y * 6.0 + 6.0);
            float glyph = step(0.6, hash12(floor(gq) + fi * 7.0)) * step(0.2, fract(gq.x)) * step(0.2, fract(gq.y));
            float frame = 1.0 - step(abs(q.x), 0.85) * step(abs(q.y), 0.95);
            col = mix(nc * (0.06 + 2.2 * max(glyph, frame)) * buzz, MIST, fog * 0.3);
        }
        float d = length(max(abs(p - c) - e, 0.0));
        col += nc * 0.25 * exp(-d * sz * 5.0) * (1.0 - fog) * buzz;
    }

    // the car in the mist: a dark shape with two red brake lights
    vec2 cp = vec2(vx + 0.015, VPY + 0.002);
    vec2 cq = (p - cp) / vec2(0.055, 0.03);
    float body = step(abs(cq.x), 1.0) * step(-1.0, cq.y) * step(cq.y, 0.3 - 0.5 * cq.x * cq.x);
    col = mix(col, vec3(0.06, 0.06, 0.08), body * 0.85);
    for (int k = -1; k <= 1; k += 2) {
        vec2 lp = cp + vec2(float(k) * 0.040, -0.002);
        float d = length((p - lp) * vec2(1.0, 2.2));
        col += RED * (smoothstep(0.009, 0.004, d) * 2.0 + 0.012 / (d + 0.004));
    }
    return col;
}

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float ellipse(vec2 p, vec2 r) {
    return (length(p / r) - 1.0) * min(r.x, r.y);
}

float segment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

// an upward triangle: base centred on the origin, half-width hw, height h
float ear(vec2 e, float hw, float h) {
    return max(-e.y, (abs(e.x) * h + e.y * hw - h * hw) / sqrt(h * h + hw * hw));
}

// the cat, seen from behind: a signed distance in screen units
float catSDF(vec2 p, float t) {
    vec2 b = p - vec2(0.075, -0.30);
    float d = ellipse(b - vec2(0.0, -0.040), vec2(0.064, 0.048));          // haunches
    d = smin(d, ellipse(b - vec2(0.0, 0.010), vec2(0.046, 0.062)), 0.025);  // back
    d = smin(d, ellipse(b - vec2(0.0, 0.065), vec2(0.030, 0.035)), 0.020);  // shoulders
    vec2 hq = b - vec2(0.002, 0.108);
    d = smin(d, ellipse(hq, vec2(0.031, 0.027)), 0.012);                   // head
    float twitch = 0.08 * sin(t * 0.9) * step(0.7, fract(t * 0.11));       // an ear flick now and then
    vec2 e1 = hq - vec2(-0.017, 0.012);
    vec2 e2 = hq - vec2(0.017, 0.012);
    e1 = mat2(cos(0.25), -sin(0.25), sin(0.25), cos(0.25)) * e1;
    e2 = mat2(cos(-0.25 + twitch), -sin(-0.25 + twitch), sin(-0.25 + twitch), cos(-0.25 + twitch)) * e2;
    d = min(d, ear(e1, 0.012, 0.026));
    d = min(d, ear(e2, 0.012, 0.026));
    // tail: curls along the ground to the right, its tip twitching
    float tw = sin(t * 1.3) * 0.5 + sin(t * 3.1) * 0.2;
    vec2 prev = vec2(0.045, -0.080);
    float tail = 1e3;
    for (int i = 1; i <= 8; i++) {
        float s = float(i) / 8.0;
        vec2 cur = vec2(0.045 + s * 0.085, -0.082 + 0.012 * sin(s * 3.0) + s * s * (0.025 + 0.045 * tw));
        tail = min(tail, segment(b, prev, cur) - 0.0095 * (1.0 - 0.45 * s));
        prev = cur;
    }
    return smin(d, tail, 0.01);
}

float cat(vec2 p, float t, out float rim) {
    float d = catSDF(p, t);
    float yb = p.y + 0.35;
    rim = smoothstep(0.005, 0.0, abs(d + 0.0025)) * smoothstep(0.0, 0.08, yb);
    return smoothstep(0.0015, -0.0015, d);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    float vx = (iOffset.x - 0.5) * 0.06;
    vec2 p = uv;
    float dy = p.y - VPY;
    vec3 col;

    if (dy > 0.0) {
        col = alley(p, t, vx);
    } else {
        // flooded street: a rippled mirror of the alley, with raindrop rings
        float z = F * H / max(-dy, 1e-3);
        float X = (p.x - vx) * z / F;
        vec2 gp = vec2(X, z);
        vec2 off = vec2(0.0);
        float rings = 0.0;
        for (int k = 0; k < 2; k++) {
            vec2 cell = floor(gp * (1.5 + float(k)) );
            vec2 f = fract(gp * (1.5 + float(k))) - 0.5;
            vec2 h = hash22(cell + float(k) * 17.0);
            float ph = fract(t * 0.6 + h.x);
            float r = ph * 0.45;
            float d = length(f - (h - 0.5) * 0.5);
            float ring = smoothstep(0.04, 0.0, abs(d - r)) * (1.0 - ph);
            rings += ring;
            off += (f - (h - 0.5) * 0.5) * ring * 0.03;
        }
        float rip = (noise(vec2(X * 4.0, z * 3.0 - t * 1.5)) - 0.5) * 0.006;
        vec3 refl = alley(vec2(p.x + rip + off.x, VPY - dy + off.y), t, vx);
        col = refl * 0.75 + vec3(0.02, 0.03, 0.035);
        col += vec3(0.5, 0.6, 0.6) * rings * 0.12 * smoothstep(30.0, 2.0, z);
        col = mix(col, MIST * 0.6, (1.0 - exp(-z * 0.045)) * 0.6);
    }

    // the cat and its reflection
    float rim;
    float c = cat(p, t, rim);
    vec3 fur = vec3(0.02, 0.02, 0.025);
    fur += RED * rim * 0.9 + TEAL * rim * 0.25 * smoothstep(0.0, 0.08, p.x - 0.07);
    col = mix(col, fur, c);
    float rrim;
    vec2 mp = vec2(p.x, 2.0 * (-0.385) - p.y);            // mirrored about the paws
    float cr = cat(mp + vec2(0.0, (noise(vec2(p.x * 80.0, p.y * 40.0 - t)) - 0.5) * 0.004), t, rrim) * step(p.y, -0.385);
    col = mix(col, fur * 0.6 + RED * rrim * 0.3, cr * 0.7);

    // rain: long streaks lit red near the signs
    for (int k = 0; k < 2; k++) {
        float fk = float(k);
        vec2 rq = vec2(uv.x * (110.0 + fk * 60.0), uv.y * (3.0 + fk) + t * (2.2 + fk) + hash11(floor(uv.x * (110.0 + fk * 60.0)) + fk) * 7.0);
        float streak = step(0.93, hash12(floor(rq) + fk * 3.0)) * smoothstep(0.5, 0.1, abs(fract(rq.x) - 0.5));
        col += mix(TEAL * 0.35, RED * 0.6, 0.5 + 0.5 * sin(uv.x * 12.0)) * streak * (0.12 + fk * 0.06);
    }

    vec2 v = fragCoord / iResolution.xy - 0.5;
    col *= 1.0 - 0.6 * dot(v, v);
    col = 1.0 - exp(-col * 1.4);
    fragColor = vec4(col, 1.0);
}
