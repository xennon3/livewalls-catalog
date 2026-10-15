// Golden Spire: a lone figure on a rain-slick rooftop above a megacity at night.
//
// The painting is iChannel0 (art.jpg). iChannel1 (maps.png) holds hand-made masks for it:
//   R  depth: 0 = far city, 1 = rooftop and figure (drives the parallax)
//   G  hovering vehicles (they bob)
//   B  wet rooftop (splashes and moving highlights)
//   A  the coat's loose tail (it flaps in the wind)
// Everything else is layered on top: drifting fog, rain, a breathing glow on the spire, twinkling
// windows, flickering lanterns, extra air traffic, clouds crossing the moon.

// Texture rows run top to bottom (Android bitmap order), so image v = 1 - screen v.
const float FLIP = 1.0;

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

// image space: x 0..1 left to right, y 0..1 top to bottom (as in the painting)
vec3 art(vec2 q) {
    q = clamp(q, vec2(0.001), vec2(0.999));
    return texture(iChannel0, vec2(q.x, mix(1.0 - q.y, q.y, FLIP))).rgb;
}

vec4 maps(vec2 q) {
    q = clamp(q, vec2(0.001), vec2(0.999));
    return texture(iChannel1, vec2(q.x, mix(1.0 - q.y, q.y, FLIP)));
}

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 s = fragCoord / iResolution.xy;           // screen 0..1, y up
    float t = iTime;
    vec2 ires = iChannelResolution[0].xy;
    float imgAspect = ires.x / max(ires.y, 1.0);
    float scrAspect = iResolution.x / iResolution.y;

    // cover-fit the painting, zoomed a touch so the parallax never shows an edge
    float zoom = 1.05;
    vec2 q = vec2(0.5 + (s.x - 0.5) * scrAspect / imgAspect, 1.0 - s.y);
    q = 0.5 + (q - 0.5) / zoom;
    float margin = max(0.0, 0.5 - 0.5 * scrAspect / imgAspect / zoom);

    // swipe pans across the painting; near layers slide further than the city
    float pan = (iOffset.x - 0.5) * 2.0 * margin * 0.85;
    vec2 sway = vec2(sin(t * 0.11), cos(t * 0.083)) * 0.0025;
    float depth = maps(q + vec2(pan, 0.0)).r;
    q += vec2(pan, 0.0) + (vec2(pan, 0.0) * 0.18 + sway) * (depth - 0.3);

    vec4 m = maps(q);
    // the coat's tail snaps in the wind; the hovering cars bob
    float gust = 0.6 + 0.4 * sin(t * 0.37);
    q.x += m.a * gust * (0.010 * sin(t * 2.1 + q.y * 42.0) + 0.005 * sin(t * 3.7 + q.y * 95.0));
    q.y += m.a * gust * 0.004 * sin(t * 2.7 + q.x * 30.0);
    q.y += m.g * 0.0028 * sin(t * 1.2 + q.x * 4.0);

    vec3 col = art(q);
    float L = lum(col);

    // windows in the far city breathe and twinkle
    float far = 1.0 - smoothstep(0.25, 0.45, m.r);
    vec2 cell = floor(q * ires / 3.0);
    float tw = noise(vec2(hash12(cell) * 50.0, t * (0.3 + hash12(cell + 7.0))));
    col *= 1.0 + far * smoothstep(0.35, 0.7, L) * (tw - 0.5) * 0.55;

    // soft bloom from the brightest lights
    vec3 glow = vec3(0.0);
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7854;
        vec2 o = vec2(cos(a), sin(a)) * vec2(1.0, imgAspect) * 0.014;
        vec3 c = art(q + o);
        glow += max(c - 0.55, 0.0);
    }
    col += glow * 0.09;

    // the spire: a slow breath of gold and a pulse climbing its light shaft
    vec2 sp = q - vec2(0.728, 0.22);
    float spire = exp(-abs(sp.x) * 30.0) * smoothstep(0.45, 0.0, q.y);
    col += vec3(1.0, 0.68, 0.30) * spire * (0.035 + 0.03 * sin(t * 0.8));
    float climb = fract(-t * 0.09);
    col += vec3(1.0, 0.82, 0.50) * exp(-abs(sp.x) * 160.0) * exp(-abs(q.y - climb * 0.45) * 30.0) * 0.6 * step(q.y, 0.45);

    // moon behind passing cloud
    vec2 mq = (q - vec2(0.245, 0.062)) * vec2(1.0, 1.0 / imgAspect);
    float cloud = fbm(vec2(q.x * 7.0 - t * 0.02, q.y * 14.0));
    col += vec3(0.7, 0.75, 0.9) * 0.25 * exp(-length(mq) * 40.0) * (1.0 - smoothstep(0.45, 0.7, cloud));
    col *= 1.0 - 0.25 * smoothstep(0.5, 0.75, cloud) * smoothstep(0.2, 0.0, q.y);

    // drifting fog between the towers, tinted by the city light around it
    vec3 tint = 0.35 + glow * 0.9 + col * 0.6;
    float f1 = fbm(vec2(q.x * 3.0 + t * 0.012, q.y * 6.0));
    float f2 = fbm(vec2(q.x * 5.0 - t * 0.02, q.y * 9.0 + 3.0));
    float band = smoothstep(0.14, 0.24, q.y) * smoothstep(0.36, 0.26, q.y) + smoothstep(0.45, 0.60, q.y) * 0.9;
    float fog = smoothstep(0.42, 0.75, f1 * 0.6 + f2 * 0.5) * band * far;
    col = mix(col, tint * vec3(0.75, 0.80, 0.88), fog * 0.35);

    // extra air traffic gliding along the lanes behind the rooftop
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float lane = 0.20 + 0.075 * fi + 0.01 * hash11(fi);
        float dir = mod(fi, 2.0) * 2.0 - 1.0;
        float x = fract(hash11(fi * 3.7) + dir * t * (0.012 + 0.008 * hash11(fi))) * 1.3 - 0.15;
        vec2 d = (q - vec2(x, lane)) * vec2(1.0, 1.0 / imgAspect);
        vec3 lc = dir > 0.0 ? vec3(1.0, 0.35, 0.25) : vec3(0.75, 0.95, 1.0);
        float dot1 = exp(-length(d) * 900.0);
        float trail = exp(-abs(d.y) * 2500.0) * smoothstep(0.03, 0.0, d.x * dir) * step(0.0, d.x * dir);
        col += lc * (dot1 * 1.6 + trail * 0.35) * far;
    }

    // lanterns on the rooftop flicker
    float fl = 0.80 + 0.20 * noise(vec2(t * 7.0, 1.0));
    for (int i = 0; i < 2; i++) {
        vec2 lp = i == 0 ? vec2(0.012, 0.605) : vec2(0.113, 0.513);
        vec2 d = (q - lp) * vec2(1.0, 1.0 / imgAspect);
        col += vec3(1.0, 0.62, 0.25) * (exp(-length(d) * 55.0) * 0.45) * fl;
    }
    // ...and their light shivers across the wet roof
    float wet = m.b;
    float sheen = pow(noise(vec2(q.x * 160.0, q.y * 40.0 + t * 0.6)), 5.0);
    col += col * wet * sheen * 1.5 * smoothstep(0.15, 0.5, L);

    // raindrops landing on the roof: brief bright rings
    for (int k = 0; k < 2; k++) {
        vec2 g = q * vec2(70.0, 120.0) + float(k) * 13.0;
        vec2 id = floor(g);
        vec2 h = hash22(id);
        float ph = fract(t * (0.9 + 0.4 * h.y) + h.x);
        vec2 f = (fract(g) - 0.5 - (h - 0.5) * 0.5) * vec2(1.0, 0.45);
        float ring = smoothstep(0.06, 0.0, abs(length(f) - ph * 0.35)) * (1.0 - ph) * step(0.5, h.y);
        col += (0.25 + col * 1.5) * ring * wet * 0.6;
    }

    // rain over the whole frame, in two depths, catching the light it falls through
    for (int k = 0; k < 2; k++) {
        float fk = float(k);
        float sc = 140.0 + fk * 110.0;
        vec2 rp = vec2(s.x * sc + s.y * 6.0, s.y * (2.5 + fk * 2.0) + t * (1.6 + fk * 1.1));
        float colId = floor(rp.x);
        rp.y += hash11(colId + fk * 31.0) * 10.0;
        float streak = step(0.955, hash12(vec2(colId, floor(rp.y)) + fk * 5.0)) * smoothstep(0.5, 0.15, abs(fract(rp.x) - 0.5));
        col += (vec3(0.55, 0.62, 0.72) * 0.6 + glow * 0.5) * streak * (0.10 + 0.06 * fk);
    }

    // grade: lift the neon a little, deepen the corners
    col = pow(max(col, 0.0), vec3(1.02, 1.0, 0.97));
    vec2 v = s - 0.5;
    col *= 1.0 - 0.45 * dot(v * vec2(1.3, 0.9), v * vec2(1.3, 0.9));
    col += (hash12(fragCoord + fract(t) * 91.0) - 0.5) * 0.012;
    fragColor = vec4(col, 1.0);
}
