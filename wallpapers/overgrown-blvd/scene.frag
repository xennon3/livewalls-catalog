// Overgrown Boulevard: a cyberpunk avenue the jungle took back. Towers vanish into teal mist,
// vines and palms climb the facades between buzzing neon signs, traffic glides along the wet
// street and drizzle hangs in the air. Swipe to look down the street from a different spot.

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

const float H = 1.7;          // eye height (m)
const float W = 6.0;          // half width of the canyon, wall to wall
const float F = 0.32;         // focal length: screen = F * X / z (a wide lens)
const float VPY = -0.10;      // horizon on screen
const vec3 FOG = vec3(0.30, 0.52, 0.55);

vec3 neon(float h) {
    if (h < 0.25) return vec3(1.0, 0.25, 0.20);   // red
    if (h < 0.45) return vec3(1.0, 0.60, 0.15);   // amber
    if (h < 0.70) return vec3(0.20, 0.95, 1.00);  // cyan
    if (h < 0.85) return vec3(1.0, 0.35, 0.80);   // pink
    return vec3(0.95, 0.95, 0.55);                // pale yellow
}

// everything above the street: facades, far towers, misty sky
vec3 upper(vec2 p, float t, float vx) {
    float dx = p.x - vx;
    float dy = p.y - VPY;
    // misty sky and far megastructure
    vec3 col = mix(FOG * 1.25, vec3(0.08, 0.20, 0.26), smoothstep(0.0, 0.5, dy));
    col += vec3(0.6, 0.85, 0.85) * 0.35 * exp(-abs(dx) * 14.0) * smoothstep(0.45, 0.05, dy);
    float fx = dx * 9.0;
    float fh = 0.10 + 0.32 * hash11(floor(fx + 50.0)) * smoothstep(0.30, 0.05, abs(dx));
    if (dy < fh) {
        vec3 far = mix(vec3(0.17, 0.33, 0.38), FOG, 0.55);
        vec2 g = vec2(p.x * 300.0, p.y * 220.0);
        far += vec3(1.0, 0.75, 0.40) * 0.35 * step(0.86, hash12(floor(g))) * step(0.4, fract(g.y));
        col = far;
    }
    // overhanging deck between the far towers, with warm windows
    float deck = smoothstep(0.012, 0.0, abs(dy - 0.20 - 0.01 * dx)) * step(abs(dx), 0.14);
    col = mix(col, vec3(0.10, 0.20, 0.24), deck);
    col += vec3(1.0, 0.7, 0.35) * deck * step(0.6, fract(p.x * 140.0)) * 0.6;

    // the facades on both sides: a plane at |X| = W, seen in perspective
    float side = sign(dx);
    float z = F * W / max(abs(dx), 1e-3);
    float Y = dy * z / F + H;
    if (z < 140.0) {
        float bid = floor(z / 9.0) + (side > 0.0 ? 100.0 : 0.0);
        float bh = 10.0 + 34.0 * hash11(bid * 1.7);
        if (Y > 0.0 && Y < bh) {
            float u = z;                                   // metres along the street
            vec3 wall = mix(vec3(0.10, 0.12, 0.13), vec3(0.20, 0.17, 0.15), hash11(bid));
            // windows by floor
            vec2 g = vec2(u * 1.1, Y * 0.36);
            float lit = step(0.62, hash12(floor(g) + bid)) * step(0.3, fract(g.x)) * step(0.35, fract(g.y));
            wall += mix(vec3(1.0, 0.62, 0.30), vec3(0.4, 0.9, 1.0), step(0.75, hash12(floor(g) * 1.3))) * lit * 0.7;
            // vines and planters over the facade, thickest high up and at the corners
            float edge = abs(fract(z / 9.0) - 0.5) * 2.0;
            float g1 = fbm(vec2(u * 0.35, Y * 0.30) + bid);
            float green = smoothstep(0.55, 0.62, g1 + 0.18 * smoothstep(0.3, 1.0, Y / bh) + 0.15 * edge);
            vec3 leaf = mix(vec3(0.05, 0.16, 0.08), vec3(0.20, 0.42, 0.16), fbm(vec2(u, Y) * 2.0));
            wall = mix(wall, leaf, green);
            // blade signs sticking out from the walls
            float sx = fract(u / 9.0 + 0.3 * hash11(bid * 3.3));
            float sy0 = 3.0 + 6.0 * hash11(bid * 5.1);
            float sign = step(abs(sx - 0.5), 0.06) * step(sy0, Y) * step(Y, sy0 + 3.0 + 4.0 * hash11(bid));
            float hb = hash11(bid * 9.7);
            float buzz = step(0.12, noise(vec2(t * 5.0, bid)));
            vec2 sg = vec2(sx * 40.0, Y * 2.2);
            float glyph = step(0.4, hash12(floor(sg) + bid)) * 0.6 + 0.4;
            wall = mix(wall, neon(hb) * (1.2 + 0.6 * glyph) * buzz, sign * step(0.3, hb));
            // shop fronts glow at street level
            wall += vec3(1.0, 0.62, 0.30) * 0.6 * smoothstep(3.5, 1.5, Y) * step(0.3, fract(u * 0.25 + hb));
            float fog = 1.0 - exp(-z * 0.022);
            col = mix(wall, FOG, fog);
            // neon bleed into the mist
            col += neon(hb) * 0.08 * step(0.3, hb) * (1.0 - fog);
        }
    }
    return col;
}

// palm frond, as in solar-bay: leaflets sweep to the tip and taper to a point
float frond(vec2 p, vec2 base, float ang, float len, float droop) {
    vec2 d = p - base;
    float c = cos(ang), s = sin(ang);
    vec2 q = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
    float u = q.x / len;
    if (u < 0.0 || u > 1.0) return 0.0;
    float v = q.y + droop * u * u * len;
    float w = 0.30 * len * sin(3.1416 * clamp(u * 1.1, 0.0, 1.0)) * (1.0 - 0.35 * u);
    float rib = smoothstep(0.004, 0.0015, abs(v)) * step(u, 0.97);
    float along = clamp(abs(v) / max(w, 1e-4), 0.0, 1.0);
    float cell = fract(u * 20.0 - along * 1.6) - 0.5;
    float thick = 0.30 * (1.0 - along * 0.9);
    float leaf = step(abs(v), w) * smoothstep(thick, thick - 0.12, abs(cell));
    return max(rib, leaf);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    float vx = (iOffset.x - 0.5) * 0.08;          // vanishing point slides with the swipe
    vec2 p = uv;
    float dy = p.y - VPY;
    vec3 col;

    if (dy > 0.0 || W / max(abs(p.x - vx), 1e-3) * dy + H > 0.0) {
        col = upper(p, t, vx);
    } else {
        // wet street: dark asphalt mirroring the canyon, broken by ripples
        float z = F * H / max(-dy, 1e-3);
        float X = (p.x - vx) * z / F;
        float rip = (noise(vec2(X * 3.0, z * 2.0 - t * 2.0)) - 0.5) * 0.010;
        float smear = (noise(vec2(X * 0.8, z * 6.0)) - 0.5) * 0.03;
        vec3 refl = upper(vec2(p.x + rip, VPY - dy + smear), t, vx);
        float fres = 0.45 + 0.4 * smoothstep(2.0, 30.0, z);
        col = mix(vec3(0.04, 0.06, 0.07), refl, 0.42 * fres);
        // sidewalks and kerbs
        float walk = smoothstep(W * 0.70, W * 0.72, abs(X));
        col = mix(col, vec3(0.10, 0.12, 0.12) + refl * 0.15, walk * 0.7);
        col += vec3(0.6) * 0.15 * smoothstep(0.08, 0.0, abs(abs(X) - W * 0.71)) * smoothstep(60.0, 5.0, z);
        // traffic: tail lights going away on the right, headlights coming on the left
        for (int i = 0; i < 4; i++) {
            float fi = float(i);
            float cz = 6.0 + fract(t * 0.035 + fi * 0.27) * 70.0;
            vec2 tl = vec2(vx + F * 1.6 / cz, VPY - F * (H - 0.8) / cz);
            float r = F * 0.18 / cz;
            col += vec3(1.0, 0.15, 0.1) * smoothstep(r, 0.0, length((p - tl) * vec2(0.5, 1.0))) * 1.5;
            float hz = 6.0 + fract(-t * 0.05 + fi * 0.31) * 70.0;
            vec2 hl = vec2(vx - F * 2.0 / hz, VPY - F * (H - 0.7) / hz);
            col += vec3(1.0, 0.9, 0.7) * smoothstep(F * 0.25 / hz, 0.0, length((p - hl) * vec2(0.45, 1.0))) * 1.2;
            // their streaks in the wet road
            col += vec3(1.0, 0.2, 0.1) * 0.25 * smoothstep(r * 1.5, 0.0, abs(p.x - tl.x)) * step(p.y, tl.y) * smoothstep(0.25, 0.0, tl.y - p.y);
        }
        float fog = 1.0 - exp(-z * 0.022);
        col = mix(col, FOG * 0.8, fog * 0.8);
    }

    // blade signs jutting out from the facades, nearest drawn last
    for (int i = 0; i < 10; i++) {
        float fi = float(i);
        float s = mod(fi, 2.0) * 2.0 - 1.0;
        float z = 70.0 / (fi * 0.8 + 1.0);
        float x0 = vx + F * s * W / z;
        float x1 = vx + F * s * (W - 1.4) / z;
        float y0 = 3.0 + 7.0 * hash11(fi * 5.3);
        float y1 = y0 + 3.0 + 5.0 * hash11(fi * 2.9);
        float sy0 = VPY + F * (y0 - H) / z, sy1 = VPY + F * (y1 - H) / z;
        float inx = step(min(x0, x1), p.x) * step(p.x, max(x0, x1));
        float iny = step(sy0, p.y) * step(p.y, sy1);
        float hb = hash11(fi * 9.7 + 0.5);
        vec3 nc = neon(hb);
        float buzz = 0.75 + 0.25 * step(0.15, noise(vec2(t * 6.0, fi * 3.0)));
        float fog = 1.0 - exp(-z * 0.022);
        if (inx * iny > 0.0) {
            vec2 q = vec2((p.x - min(x0, x1)) / abs(x1 - x0), (p.y - sy0) / (sy1 - sy0));
            vec2 gq = vec2(q.x * 3.0, q.y * 7.0);
            float glyph = step(0.62, hash12(floor(gq) + fi * 7.0)) * step(0.18, fract(gq.x)) * step(0.15, fract(gq.y));
            float frame = 1.0 - step(0.08, q.x) * step(q.x, 0.92) * step(0.04, q.y) * step(q.y, 0.96);
            vec3 sc = mix(nc * 0.10, nc * 1.5, max(glyph, frame)) * buzz;
            col = mix(sc, FOG, fog * 0.5);
        }
        // halo in the mist
        vec2 c = vec2(0.5 * (x0 + x1), 0.5 * (sy0 + sy1));
        vec2 e = vec2(abs(x1 - x0), sy1 - sy0) * 0.5;
        float d = length(max(abs(p - c) - e, 0.0));
        col += nc * 0.18 * exp(-d * z * 6.0) * (1.0 - fog) * buzz * (1.0 - inx * iny);
    }

    // palms along both kerbs, nearest last; trunks lean a little
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float s = mod(fi, 2.0) * 2.0 - 1.0;
        float z = 36.0 / (fi + 1.0);                 // 36, 18, 12, 9, 7.2, 6 m
        float X = s * (W * 0.62 + 0.4 * hash11(fi));
        float bx = vx + F * X / z;
        float by = VPY - F * H / z;
        float th = F * (11.0 + 4.0 * hash11(fi * 2.0) - H) / z + VPY;
        float lean = 0.06 * s * (hash11(fi * 4.0) - 0.3);
        float k = clamp((p.y - by) / (th - by), 0.0, 1.0);
        float tx = bx + lean * k * k * (th - by);
        float trunk = step(by, p.y) * step(p.y, th) * step(abs(p.x - tx), F * (0.30 - 0.08 * k) / z);
        float sway = sin(t * 0.8 + fi * 1.3) * 0.05;
        vec2 top = vec2(bx + lean * (th - by), th);
        float L = F * 5.5 / z;
        float crown = 0.0;
        for (int j = 0; j < 6; j++) {
            float fj = float(j);
            float a = -0.4 + fj * 0.75 + sway + 0.2 * hash11(fi * 7.0 + fj);
            crown = max(crown, frond(p, top, a, L * (0.85 + 0.3 * hash11(fj + fi)), 0.5 + 0.3 * cos(a)));
        }
        float fog = 1.0 - exp(-z * 0.022);
        vec3 pc = mix(vec3(0.04, 0.09, 0.06), FOG, fog);
        // trunk rings catching neon from the street
        pc += vec3(1.0, 0.4, 0.3) * 0.05 * step(0.5, fract(p.y * z * 4.0)) * trunk;
        col = mix(col, pc, max(trunk, crown));
    }

    // vines hanging into the top of the frame
    float vxc = uv.x * 45.0;
    float vid = floor(vxc);
    float vlen = 0.46 - 0.16 * hash11(vid) - 0.01 * sin(t * 0.5 + vid);
    float vsw = sin(t * 0.9 + vid * 0.7) * 0.6 * (0.5 - uv.y);
    float vf = fract(vxc + vsw) - 0.5;
    float strand = smoothstep(0.06, 0.02, abs(vf));
    float tuft = smoothstep(0.30, 0.12, length(vec2(vf * 1.4, (fract(uv.y * 140.0 + vid) - 0.5) * 0.9)));
    float vine = step(vlen, uv.y) * step(0.55, hash11(vid * 3.1)) * max(strand, tuft * step(0.45, noise(vec2(vid, uv.y * 40.0))));
    col = mix(col, mix(vec3(0.03, 0.10, 0.05), vec3(0.22, 0.48, 0.16), tuft), vine * 0.95);

    // drizzle
    vec2 rq = vec2(uv.x * 160.0, uv.y * 7.0 + t * 3.0 + hash11(floor(uv.x * 160.0)) * 9.0);
    col += vec3(0.6, 0.8, 0.8) * 0.06 * step(0.95, hash12(floor(rq))) * smoothstep(0.5, 0.0, abs(fract(rq.x) - 0.5));

    vec2 v = fragCoord / iResolution.xy - 0.5;
    col *= 1.0 - 0.5 * dot(v, v);
    col = 1.0 - exp(-col * 1.3);
    fragColor = vec4(col, 1.0);
}
