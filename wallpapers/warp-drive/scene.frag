// Warp Drive: the view from a cockpit in hyperspace. Stars stretch into streaks, plasma swirls
// around the tunnel and shock rings roll past, framed by the canopy and a softly lit HUD.

const float PI = 3.14159265;
const vec2 VP = vec2(0.0, 0.07);   // vanishing point on screen

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

// Noise that wraps around the tunnel: x is periodic with period `per`.
float noiseWrap(vec2 p, float per) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float i0 = mod(i.x, per);
    float i1 = mod(i.x + 1.0, per);
    return mix(mix(hash12(vec2(i0, i.y)), hash12(vec2(i1, i.y)), u.x),
               mix(hash12(vec2(i0, i.y + 1.0)), hash12(vec2(i1, i.y + 1.0)), u.x), u.y);
}

float fbmWrap(vec2 p, float per) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noiseWrap(p, per);
        p *= 2.0;
        per *= 2.0;
        a *= 0.5;
    }
    return v;
}

vec3 tunnel(vec2 q, float t) {
    float r = length(q);
    float a = atan(q.y, q.x) / (2.0 * PI) + 0.5;        // 0..1 around the tunnel
    float z = 0.12 / max(r, 1e-3);                        // depth along the tunnel
    float spin = t * 0.04;

    // Plasma walls: wrapped noise flowing toward us, domain-warped for swirl.
    vec2 uv = vec2(a + spin + 0.05 * sin(z * 2.0 + t * 0.5), z * 0.9 - t * 1.6);
    float w = fbmWrap(uv * vec2(8.0, 1.0), 8.0);
    float plasma = fbmWrap(uv * vec2(8.0, 1.0) + vec2(w * 1.5, w * 0.8), 8.0);
    float fil = pow(smoothstep(0.42, 0.80, plasma), 1.6);
    // Thin bright filaments streaming along the tunnel.
    float strands = pow(1.0 - abs(noiseWrap(vec2(uv.x * 24.0 + w * 2.0, uv.y * 0.6), 24.0) * 2.0 - 1.0), 8.0);
    vec3 cA = vec3(0.15, 0.35, 1.0);
    vec3 cB = vec3(0.65, 0.25, 1.0);
    vec3 cC = vec3(0.30, 0.95, 1.0);
    vec3 col = mix(cA, cB, smoothstep(0.3, 0.7, noiseWrap(uv * vec2(3.0, 0.4), 3.0)));
    col = mix(col, cC, fil * 0.6);
    float wall = smoothstep(0.02, 0.25, r) * (0.12 + 1.5 * fil + 0.25 * plasma + 0.9 * strands);
    col *= wall * (0.55 + 0.45 * smoothstep(1.2, 0.15, r));

    // Hot core at the vanishing point.
    col += vec3(0.75, 0.85, 1.0) * exp(-r * 22.0) * 1.5 + vec3(0.4, 0.5, 1.0) * exp(-r * 6.0) * 0.4;

    // Shock rings rolling outward.
    for (int i = 0; i < 2; i++) {
        float ph = fract(t * 0.18 + float(i) * 0.5);
        float rr = 0.03 / max(1.0 - ph, 0.02) - 0.03;
        float ring = exp(-pow((r - rr) / (0.01 + rr * 0.08), 2.0)) * (1.0 - ph) * smoothstep(0.0, 0.1, ph);
        col += vec3(0.6, 0.85, 1.0) * ring * (0.5 + 0.5 * noiseWrap(vec2(a * 40.0, float(i)), 40.0)) * 0.9;
    }

    // Star streaks in four depth layers.
    for (int L = 0; L < 4; L++) {
        float fl = float(L);
        float n = 90.0 + fl * 50.0;
        float cell = floor(a * n);
        float ca = (a * n - cell) - 0.5;
        float h = hash11(cell * 1.7 + fl * 31.0);
        if (h < 0.45) continue;
        float sp = 0.25 + 0.35 * hash11(cell + fl * 11.0);
        float ph = fract(h * 7.0 + t * sp);
        float rs = 0.02 + 1.1 * ph * ph * ph;            // accelerates outward
        float len = 0.01 + rs * (0.22 + 0.1 * fl);
        float off = (hash11(cell * 3.1 + fl) - 0.5) * 0.6;
        float ad = abs(ca - off) * (2.0 * PI * r / n);    // angular distance in screen units
        float width = 0.0008 + rs * 0.0025;
        float radial = smoothstep(rs - len, rs, r) * step(r, rs);
        float s = smoothstep(width, 0.0, ad) * radial;
        vec3 sc = mix(vec3(0.7, 0.85, 1.0), vec3(1.0, 0.85, 0.95), hash11(cell + 5.0));
        col += sc * s * (0.4 + 1.6 * ph) * (1.2 - fl * 0.2);
    }
    return col;
}

// Canopy frame, dashboard and HUD. Returns colour in .rgb and opacity in .a.
vec4 cockpit(vec2 p, float t, vec3 light) {
    float aa = 1.5 / iResolution.y;
    float ar = iResolution.x / iResolution.y;

    // Dashboard: a gently curved top edge across the bottom of the screen.
    float dashTop = -0.36 + 0.05 * (1.0 - pow(p.x / (ar * 0.5), 2.0));
    float dash = smoothstep(aa, -aa, p.y - dashTop);
    // Canopy struts rising from the dash toward the top corners.
    float sx = ar * 0.5;
    float strutL = abs((p.x + sx * 0.84) + (p.y + 0.36) * 0.07) - 0.022;
    float strutR = abs((p.x - sx * 0.84) - (p.y + 0.36) * 0.07) - 0.022;
    float strut = smoothstep(aa, -aa, min(strutL, strutR)) * step(dashTop, p.y);
    // Top canopy bow.
    float bow = smoothstep(aa, -aa, abs(p.y - (0.47 - 0.02 * pow(p.x / sx, 2.0))) - 0.03);
    float frame = max(max(dash, strut), bow);

    vec3 metal = vec3(0.025, 0.025, 0.035);
    // Tunnel light catching the edges.
    float rim = smoothstep(0.012, 0.0, abs(p.y - dashTop)) * dash;
    metal += light * rim * 0.9;
    metal += light * 0.06 * (strut + bow);
    // Panel seams and indicator lights on the dash.
    if (dash > 0.0) {
        vec2 g = vec2(p.x * 14.0, (p.y - dashTop) * 20.0);
        metal *= 0.85 + 0.15 * step(0.08, fract(g.x)) * step(0.1, fract(-g.y));
        vec2 lg = vec2(p.x * 40.0, (p.y + 0.42) * 40.0);
        vec2 lid = floor(lg);
        float led = step(0.6, hash12(lid)) * smoothstep(0.16, 0.06, length((fract(lg) - 0.5) * vec2(0.6, 1.6))) * step(abs(p.y + 0.42), 0.03);
        float blink = step(0.3, fract(t * (0.5 + hash12(lid + 2.0)) + hash12(lid)));
        vec3 lc = hash12(lid + 4.0) > 0.7 ? vec3(1.0, 0.35, 0.2) : vec3(0.2, 0.9, 1.0);
        metal += lc * led * blink * 1.5;
        // A small radar sweep display.
        vec2 rp = p - vec2(0.0, -0.44);
        float rr = length(rp);
        if (rr < 0.045) {
            float sweep = fract(atan(rp.y, rp.x) / (2.0 * PI) - t * 0.4);
            vec3 scr = vec3(0.02, 0.10, 0.12);
            scr += vec3(0.2, 1.0, 0.9) * pow(1.0 - sweep, 8.0) * 0.6;
            scr += vec3(0.2, 1.0, 0.9) * smoothstep(0.002, 0.0, abs(fract(rr / 0.015) - 0.5) * 0.015 - 0.0) * 0.15;
            metal = scr;
        }
    }
    return vec4(metal, frame);
}

// HUD projected on the glass: reticle, arcs, speed tapes and bar readouts. Returns intensity.
float hud(vec2 p, float t) {
    vec2 h = p - VP;
    float r = length(h);
    float ang = atan(h.y, h.x);
    float v = 0.0;
    v += smoothstep(0.0015, 0.0, abs(r - 0.085)) * step(0.5, fract(ang / (2.0 * PI) * 4.0 + t * 0.03));
    v += smoothstep(0.0012, 0.0, abs(r - 0.13)) * step(0.82, fract(ang / (2.0 * PI) * 36.0)) * 0.8;
    v += smoothstep(0.0012, 0.0, abs(h.y)) * step(0.10, abs(h.x)) * step(abs(h.x), 0.16);
    v += smoothstep(0.0012, 0.0, abs(h.x)) * step(0.10, abs(h.y)) * step(abs(h.y), 0.13);
    // Side ladders with ticks that scroll like a speed tape.
    float side = abs(h.x) - 0.17;
    float tape = smoothstep(0.0012, 0.0, abs(side)) * step(abs(h.y), 0.12);
    tape += smoothstep(0.0012, 0.0, abs(fract(h.y * 25.0 + t * 2.0) - 0.5) * 0.04) * step(0.0, side) * step(side, 0.012) * step(abs(h.y), 0.12);
    v += tape * 0.8;
    // Little bar readouts under the reticle.
    vec2 b = h - vec2(-0.05, -0.17);
    if (b.y > 0.0 && b.y < 0.008 && b.x > 0.0 && b.x < 0.1) {
        float bar = floor(b.x * 100.0);
        float lvl = noise(vec2(bar * 0.7, t * 1.5));
        v += step(fract(b.x * 100.0), 0.7) * step(b.y / 0.008, lvl) * 0.8;
    }
    return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float t = iTime;
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    // A slow drift of the ship, plus parallax from the home-screen swipe.
    vec2 drift = vec2(0.012 * sin(t * 0.21), 0.008 * sin(t * 0.17 + 1.0)) + vec2((iOffset.x - 0.5) * 0.04, 0.0);
    vec2 q = p - VP - drift;

    vec3 col = tunnel(q, t);
    // Average tunnel light for lighting the cockpit.
    vec3 light = vec3(0.35, 0.55, 1.0) * (0.8 + 0.2 * sin(t * 1.7));
    col += vec3(0.35, 1.0, 0.85) * hud(p, t) * 0.55;
    vec4 ck = cockpit(p, t, light);
    col = mix(col, ck.rgb, ck.a);

    // Glass reflections: faint streak across the canopy.
    col += vec3(0.25, 0.35, 0.6) * smoothstep(0.02, 0.0, abs(p.x * 0.6 + p.y - 0.35)) * 0.05;

    col = col / (1.0 + col * 0.45) * 1.2;
    col *= 1.0 - 0.3 * dot(p * vec2(1.4, 0.9), p * vec2(1.4, 0.9));
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
