// Holo District: a figure on a wet rooftop above a city of giant holograms. The holo screens
// flicker and glitch, the beam on the central tower pulses with a light circling its ring,
// searchlights sweep the clouds, the pool shimmers, and flying cars hover and stream past.
//
// iChannel0  art.jpg         the painting, with the small flying cars painted out
// iChannel1  maps.png        R depth (parallax, hides cars behind near things), G holo screens,
//                            B wet rooftop (RGB only)
// iChannel3  cloth.png       the coat's loose tail
// iChannel2  cars_atlas.png  the cars, cut out of the painting

// The app uploads images bottom row first (GL convention), so the painting's top is at v = 1.
// FLIP = 1.0 would read them top row first; the app needs 0.0.
const float FLIP = 0.0;

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

vec3 art(vec2 q) {
    q = clamp(q, vec2(0.001), vec2(0.999));
    return texture(iChannel0, vec2(q.x, mix(1.0 - q.y, q.y, FLIP))).rgb;
}

vec4 maps(vec2 q) {
    q = clamp(q, vec2(0.001), vec2(0.999));
    return texture(iChannel1, vec2(q.x, mix(1.0 - q.y, q.y, FLIP)));
}

// Android premultiplies image alpha, so masks never live in an alpha channel: maps.png is RGB
// and the coat's mask is a greyscale image of its own.
float cloth(vec2 q) {
    q = clamp(q, vec2(0.001), vec2(0.999));
    return texture(iChannel3, vec2(q.x, mix(1.0 - q.y, q.y, FLIP))).r;
}

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// ---------------------------------------------------------------- flying cars
const vec2 IMG_PX = vec2(941.0, 1672.0);
const vec2 ATLAS_PX = vec2(512.0, 161.0);
const int NSPR = 6;
// sprite source rects in the painting (x, y, w, h) and their atlas corners
const vec4 SPR_SRC[NSPR] = vec4[NSPR](
    vec4(182.0, 503.0, 149.0, 71.0), vec4(106.0, 595.0, 182.0, 79.0), vec4(360.0, 554.0, 88.0, 45.0),
    vec4(784.0, 838.0, 134.0, 70.0), vec4(812.0, 947.0, 87.0, 53.0),  vec4(615.0, 855.0, 77.0, 45.0));
const vec2 SPR_ATL[NSPR] = vec2[NSPR](
    vec2(4.0, 4.0), vec2(157.0, 4.0), vec2(343.0, 4.0), vec2(4.0, 87.0), vec2(142.0, 87.0), vec2(233.0, 87.0));

const int NINST = 10;
// sprite index, mode (0 = hovers where it was painted, 1 = flies across), scale, lap length (px)
const vec4 INST_A[NINST] = vec4[NINST](
    vec4(0.0, 0.0, 1.0, 0.0),     // the two cars parked in the air by the pink holo
    vec4(1.0, 0.0, 1.0, 0.0),
    vec4(2.0, 1.0, 1.0, 1500.0),  // painted traffic, now moving
    vec4(3.0, 1.0, 1.0, 1500.0),
    vec4(4.0, 1.0, 1.0, 1600.0),
    vec4(5.0, 1.0, 1.0, 1400.0),
    vec4(1.0, 1.0, 0.55, 1500.0), // extra traffic on other lanes
    vec4(3.0, 1.0, 0.70, 1500.0),
    vec4(2.0, 1.0, 0.80, 1500.0),
    vec4(0.0, 1.0, 0.85, 1600.0));
// lane centre (painting px) and heading (x, y) with speed (px/s)
const vec4 INST_B[NINST] = vec4[NINST](
    vec4(256.0, 538.0, 0.0, 0.0),
    vec4(197.0, 634.0, 0.0, 0.0),
    vec4(404.0, 576.0, -50.0, 0.0),
    vec4(851.0, 873.0, 65.0, 3.0),
    vec4(855.0, 973.0, -120.0, 0.0),
    vec4(653.0, 877.0, 45.0, 0.0),
    vec4(520.0, 705.0, -70.0, 1.5),
    vec4(500.0, 760.0, 80.0, 2.0),
    vec4(560.0, 470.0, -60.0, 0.0),
    vec4(600.0, 1010.0, -90.0, -2.0));

vec4 cars(vec2 qpx, float t, inout vec3 glowAdd) {
    vec4 acc = vec4(0.0);
    for (int n = 0; n < NINST; n++) {
        vec4 a = INST_A[n];
        vec4 b = INST_B[n];
        int s = int(a.x);
        vec4 r = SPR_SRC[s];
        float fn = float(n);
        vec2 centre;
        float fade = 1.0;
        float sc = a.z;
        vec2 dir = vec2(-1.0, 0.0);
        if (a.y < 0.5) {
            // hovering: a slow drift and bob
            centre = b.xy + vec2(sin(t * 0.45 + fn) * 9.0, sin(t * 1.1 + fn * 2.0) * 5.0);
        } else {
            vec2 v = b.zw;
            float speed = length(v);
            dir = v / speed;
            float ph = fract(t * speed / a.w + 0.31 * fn + 0.5);
            centre = b.xy + dir * (ph - 0.5) * a.w;
            fade = smoothstep(0.0, 0.06, ph) * smoothstep(1.0, 0.94, ph);
            // engine glow streaming behind
            vec2 back = qpx - centre;
            float along = -dot(back, dir) / sc;
            float side = abs(dot(back, vec2(-dir.y, dir.x))) / sc;
            float trail = smoothstep(r.z * 1.4, 0.0, along) * step(r.z * 0.3, along) * exp(-side * 0.4);
            glowAdd += mix(vec3(1.0, 0.25, 0.75), vec3(0.3, 0.85, 1.0), step(0.0, dir.x)) * 0.45 * trail * fade;
        }
        vec2 local = (qpx - centre) / sc + r.zw * 0.5;
        if (local.x < 0.0 || local.y < 0.0 || local.x > r.z || local.y > r.w) continue;
        // a car crossing the other way is mirrored, so it always flies nose first
        float flip = (a.y > 0.5 && dir.x > 0.0) != (s == 3 || s == 5) ? 1.0 : 0.0;
        vec2 l2 = vec2(mix(local.x, r.z - local.x, flip), local.y);
        vec2 au = (SPR_ATL[s] + l2) / ATLAS_PX;
        vec4 sp = texture(iChannel2, vec2(au.x, mix(1.0 - au.y, au.y, FLIP)));
        float al = sp.a * fade;
        acc.rgb = acc.rgb * (1.0 - al) + sp.rgb * fade;   // sp is premultiplied
        acc.a = al + acc.a * (1.0 - al);
    }
    return acc;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 s = fragCoord / iResolution.xy;
    float t = iTime;
    vec2 ires = iChannelResolution[0].xy;
    float imgAspect = ires.x / max(ires.y, 1.0);
    float scrAspect = iResolution.x / iResolution.y;

    // cover-fit, zoomed a touch so the parallax never shows an edge
    float zoom = 1.05;
    vec2 q = vec2(0.5 + (s.x - 0.5) * scrAspect / imgAspect, 1.0 - s.y);
    q = 0.5 + (q - 0.5) / zoom;
    float margin = max(0.0, 0.5 - 0.5 * scrAspect / imgAspect / zoom);
    float pan = (iOffset.x - 0.5) * 2.0 * margin * 0.85;
    vec2 sway = vec2(sin(t * 0.11), cos(t * 0.083)) * 0.0025;
    float depth = maps(q + vec2(pan, 0.0)).r;
    q += vec2(pan, 0.0) + (vec2(pan, 0.0) * 0.18 + sway) * (depth - 0.3);

    vec4 m = maps(q);
    float far = 1.0 - smoothstep(0.25, 0.45, m.r);

    // the coat's tail snaps in the wind
    float cl = cloth(q);
    float gust = 0.6 + 0.4 * sin(t * 0.37);
    q.x += cl * gust * (0.011 * sin(t * 2.1 + q.y * 42.0) + 0.005 * sin(t * 3.7 + q.y * 95.0));
    q.y += cl * gust * 0.004 * sin(t * 2.7 + q.x * 30.0);

    // the big car at the lower right hovers in place (it runs off the painting's edge)
    vec2 bc = (q * IMG_PX - vec2(800.0, 1150.0)) / vec2(170.0, 85.0);
    float bigCar = smoothstep(1.0, 0.7, length(bc));
    float bob = sin(t * 1.1) * 0.005 + sin(t * 2.6) * 0.0012;
    q.y += bigCar * bob;

    // the pool ripples
    vec2 pp = q * IMG_PX;
    float pool = smoothstep(560.0, 575.0, pp.x) * smoothstep(720.0, 705.0, pp.x)
               * smoothstep(790.0, 802.0, pp.y) * smoothstep(855.0, 843.0, pp.y);
    q += pool * vec2(sin(pp.y * 0.9 + t * 2.0), cos(pp.x * 0.5 + t * 1.6)) * 0.0006;

    // holo screens glitch: in bursts, slices of the image slide sideways and split colour
    float holo = m.g;
    float burst = step(0.82, noise(vec2(t * 0.9, 3.0)));
    float slice = floor(q.y * 90.0);
    float jump = (hash12(vec2(slice, floor(t * 12.0))) - 0.5) * step(0.6, hash12(vec2(slice * 1.7, floor(t * 12.0)))) * burst;
    vec2 gq = q + vec2(jump * 0.025 * holo, 0.0);
    vec3 col = art(gq);
    if (holo > 0.01) {
        float split = (0.002 + 0.006 * burst) * holo;
        col.r = mix(col.r, art(gq + vec2(split, 0.0)).r, holo);
        col.b = mix(col.b, art(gq - vec2(split, 0.0)).b, holo);
        float scan = 0.82 + 0.18 * sin(q.y * IMG_PX.y * 1.6 - t * 9.0);
        float flick = 0.88 + 0.16 * noise(vec2(t * 7.0, floor(q.x * 8.0)));
        float roll = smoothstep(0.03, 0.0, abs(fract(q.y * 2.0 - t * 0.35) - 0.5) - 0.47) * 0.25;
        col *= mix(1.0, scan * flick + roll, holo);
    }
    float L = lum(col);

    // windows twinkle in the far city
    vec2 cell = floor(q * ires / 5.0);
    float tw = noise(vec2(hash12(cell) * 50.0, t * (0.15 + 0.3 * hash12(cell + 7.0))));
    col *= 1.0 + far * (1.0 - holo) * smoothstep(0.4, 0.75, L) * (tw - 0.5) * 0.5;

    // bloom from the brightest lights
    vec3 glow = vec3(0.0);
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7854;
        vec2 o = vec2(cos(a), sin(a)) * vec2(1.0, imgAspect) * 0.014;
        glow += max(art(q + o) - 0.55, 0.0);
    }
    col += glow * 0.13;

    // the tower beam: pulsing, with light packets racing up it, and a spark circling the ring
    vec2 bp = q * IMG_PX - vec2(659.0, 0.0);
    float beam = exp(-abs(bp.x) * 0.35) * step(bp.y, 1000.0) * far;
    float packets = pow(0.5 + 0.5 * sin(bp.y * 0.03 + t * 6.0), 8.0);
    col += vec3(0.35, 0.85, 1.0) * beam * (0.25 + 0.15 * sin(t * 1.7) + 0.6 * packets);
    vec2 rp = q * IMG_PX - vec2(659.0, 251.0);
    float rr = length(rp);
    float ang = atan(rp.y, rp.x);
    float spark = pow(max(cos(ang - t * 1.8), 0.0), 24.0) + pow(max(cos(ang - t * 1.8 + 3.1416), 0.0), 24.0);
    col += vec3(0.6, 0.95, 1.0) * exp(-abs(rr - 43.0) * 0.35) * (0.25 + 1.4 * spark);
    col += vec3(0.4, 0.9, 1.0) * 0.18 * exp(-rr * 0.02) * (0.7 + 0.3 * sin(t * 1.7));

    // sparkle on the pool
    col += vec3(0.8, 1.0, 1.0) * pool * pow(noise(pp * vec2(0.6, 2.0) + t * 1.5), 10.0) * 1.2;

    // the cars
    vec3 trailGlow = vec3(0.0);
    vec4 cr = cars(q * IMG_PX, t, trailGlow);
    float behind = 1.0 - smoothstep(0.42, 0.55, m.r);
    col = col * (1.0 - cr.a * behind) + cr.rgb * 1.06 * behind;
    col += trailGlow * behind;
    // the big car's tail lights and exhaust pulse
    vec2 tl = (q * IMG_PX - vec2(890.0, 1185.0)) * vec2(0.6, 1.4);
    col += vec3(1.0, 0.2, 0.7) * 0.6 * exp(-length(tl) * 0.03) * (0.7 + 0.3 * sin(t * 4.0)) * bigCar;

    // searchlights sweep the clouds from behind the towers (strongest where there is cloud)
    float fog0 = fbm(vec2(q.x * 3.0 + t * 0.03, q.y * 6.0));
    for (int i = 0; i < 2; i++) {
        float fi = float(i);
        vec2 o = vec2(0.40 + 0.45 * fi, 0.50);
        vec2 d = q - o;
        float a = atan(d.x, -d.y);
        float target = sin(t * (0.18 + 0.05 * fi) + fi * 2.0) * 0.55;
        float cone = exp(-abs(a - target) * 45.0) * smoothstep(0.0, 0.3, -d.y) * smoothstep(0.75, 0.25, length(d)) * (0.6 + 0.4 * fog0);
        col += mix(vec3(1.0, 0.4, 0.85), vec3(0.4, 0.85, 1.0), fi) * cone * 0.12 * far;
    }

    // the red beacon on the mast blinks
    vec2 bk = (q * IMG_PX - vec2(31.0, 522.0));
    float blink = step(0.55, fract(t * 0.7));
    col += vec3(1.0, 0.1, 0.1) * blink * (exp(-length(bk) * 0.08) * 1.2 + exp(-length(bk) * 0.02) * 0.25);

    // clouds rolling between the towers, lit by the city
    vec3 tint = 0.35 + glow * 0.9 + col * 0.6;
    float f1 = fbm(vec2(q.x * 3.0 + t * 0.03, q.y * 6.0 - t * 0.004));
    float f2 = fbm(vec2(q.x * 5.0 - t * 0.045, q.y * 9.0 + 3.0));
    float band = smoothstep(0.15, 0.30, q.y) * smoothstep(0.95, 0.55, q.y);
    float fog = smoothstep(0.45, 0.78, f1 * 0.6 + f2 * 0.5) * band * far * (1.0 - holo * 0.6);
    col = mix(col, tint * vec3(0.80, 0.78, 0.88), fog * 0.42);

    // the wet roof: pink light shivers across it, raindrops ring it
    float wet = m.b;
    float sheen = pow(noise(vec2(q.x * 160.0, q.y * 40.0 + t * 0.6)), 5.0);
    col += col * wet * sheen * 1.6 * smoothstep(0.12, 0.5, L);
    for (int k = 0; k < 2; k++) {
        vec2 g = q * vec2(70.0, 120.0) + float(k) * 13.0;
        vec2 id = floor(g);
        vec2 h = hash22(id);
        float ph = fract(t * (0.9 + 0.4 * h.y) + h.x);
        vec2 f = (fract(g) - 0.5 - (h - 0.5) * 0.5) * vec2(1.0, 0.45);
        float ring = smoothstep(0.07, 0.0, abs(length(f) - ph * 0.35)) * (1.0 - ph) * step(0.35, h.y);
        col += (0.30 + col * 1.8) * ring * wet;
    }

    // rain in two depths
    for (int k = 0; k < 2; k++) {
        float fk = float(k);
        float sc = 140.0 + fk * 110.0;
        vec2 rp2 = vec2(s.x * sc + s.y * 6.0, s.y * (2.5 + fk * 2.0) + t * (1.6 + fk * 1.1));
        float colId = floor(rp2.x);
        rp2.y += hash11(colId + fk * 31.0) * 10.0;
        float streak = step(0.945, hash12(vec2(colId, floor(rp2.y)) + fk * 5.0)) * smoothstep(0.5, 0.15, abs(fract(rp2.x) - 0.5));
        col += (vec3(0.62, 0.58, 0.75) * 0.7 + glow * 0.6) * streak * (0.15 + 0.09 * fk);
    }

    vec2 v = s - 0.5;
    col *= 1.0 - 0.45 * dot(v * vec2(1.3, 0.9), v * vec2(1.3, 0.9));
    col += (hash12(fragCoord + fract(t) * 91.0) - 0.5) * 0.012;
    fragColor = vec4(col, 1.0);
}
