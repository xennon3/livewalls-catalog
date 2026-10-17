// Maple Moon: a zen garden above a neon city, under a moon wrapped in a space station.
// Maple leaves drift down from the red tree, the canopy rustles, a bullet train glides along the
// elevated line, lights circle the station's rings, satellites blink, light pulses through the
// raked sand, the water channel ripples and the lanterns flicker.
//
// iChannel0  art.jpg    the owner's painting
// iChannel1  maps.png   RGB masks: R depth (parallax), G maple canopy (rustles), B water
// The app uploads images bottom row first and premultiplies alpha, so maps.png has no alpha and
// image y (top to bottom) is sampled at v = 1 - y.

const float FLIP = 0.0;
const vec2 IMG_PX = vec2(941.0, 1672.0);

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

vec3 art(vec2 q) {
    q = clamp(q, vec2(0.001), vec2(0.999));
    return texture(iChannel0, vec2(q.x, mix(1.0 - q.y, q.y, FLIP))).rgb;
}

vec3 maps(vec2 q) {
    q = clamp(q, vec2(0.001), vec2(0.999));
    return texture(iChannel1, vec2(q.x, mix(1.0 - q.y, q.y, FLIP))).rgb;
}

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// The bullet train on the front elevated line, in painting px: centre line and half height.
float trainY(float x) { return 1064.0 + (x - 705.0) * 0.302; }
float trainH(float x) { return (10.0 + (x - 705.0) * 0.064) * 0.92; }

// one falling maple leaf: coverage at painting position p (px)
float leaf(vec2 p, vec2 c, float size, float ang, float flip) {
    vec2 d = p - c;
    float s = sin(ang), co = cos(ang);
    d = vec2(co * d.x - s * d.y, s * d.x + co * d.y);
    d.x /= max(abs(flip), 0.25);                     // tumbling: the leaf turns edge-on
    float r = length(d) / size;
    float a = atan(d.y, d.x);
    float lobes = 0.72 + 0.28 * abs(cos(a * 2.5));   // five points
    return smoothstep(lobes, lobes - 0.25, r);
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
    vec2 sway = vec2(sin(t * 0.09), cos(t * 0.07)) * 0.002;
    float depth = maps(q + vec2(pan, 0.0)).r;
    q += vec2(pan, 0.0) + (vec2(pan, 0.0) * 0.18 + sway) * (depth - 0.3);

    vec3 m = maps(q);
    float far = 1.0 - smoothstep(0.25, 0.45, m.r);

    // the maple canopy rustles in gusts
    float gust = 0.55 + 0.45 * sin(t * 0.31) * sin(t * 0.17 + 1.0);
    q += m.g * gust * vec2(0.0035 * sin(t * 1.3 + q.y * 22.0) + 0.0018 * sin(t * 2.9 + q.x * 37.0),
                           0.0018 * sin(t * 1.7 + q.x * 25.0));

    // the water channel and the wet deck ripple
    q += m.b * vec2(sin(q.y * 300.0 + t * 2.2), cos(q.x * 140.0 + t * 1.7)) * 0.0010;

    // satellites and drones bob in place
    vec2 qp = q * IMG_PX;
    for (int i = 0; i < 3; i++) {
        vec4 dr = i == 0 ? vec4(282.0, 452.0, 75.0, 28.0) : i == 1 ? vec4(868.0, 352.0, 50.0, 40.0) : vec4(845.0, 495.0, 45.0, 30.0);
        float w = smoothstep(1.0, 0.6, length((qp - dr.xy) / dr.zw));
        q.y += w * 0.0025 * sin(t * (1.0 + 0.3 * float(i)) + float(i) * 2.0);
    }
    qp = q * IMG_PX;

    // the sky's clouds churn slowly (not the moon, its station or the city)
    float moonR = length(qp - vec2(608.0, 316.0));
    float cloudy = smoothstep(0.47, 0.42, q.y) * smoothstep(265.0, 305.0, moonR) * step(qp.x, 900.0) * far * (1.0 - m.g);
    q.x += cloudy * (fbm(vec2(q.x * 3.0 - t * 0.04, q.y * 7.0)) - 0.5) * 0.012;
    q.y += cloudy * (fbm(vec2(q.x * 3.0 + 5.0, q.y * 7.0 - t * 0.03)) - 0.5) * 0.006;

    // the moon's outer orbital rings swing slowly about the moon
    float ring = smoothstep(246.0, 256.0, moonR) * smoothstep(305.0, 292.0, moonR) * smoothstep(560.0, 470.0, qp.y);
    if (ring > 0.0) {
        float ra = 0.11 * sin(t * 0.13);
        vec2 rc = qp - vec2(608.0, 316.0);
        rc = mat2(cos(ra), -sin(ra), sin(ra), cos(ra)) * rc;
        q = mix(q, (rc + vec2(608.0, 316.0)) / IMG_PX, ring);
    }
    qp = q * IMG_PX;

    vec3 col = art(q);

    // the train glides along the line: its pixels stream towards us; the loop's seam hides
    // behind the pagoda tower on the left
    if (qp.x > 690.0) {
        float rel = (qp.y - trainY(qp.x)) / trainH(qp.x);
        if (abs(rel) < 1.0) {
            float span = 941.0 - 705.0;
            float sx = 705.0 + mod(qp.x - 705.0 - t * 38.0, span);
            vec2 src = vec2(sx, trainY(sx) + rel * trainH(sx));
            float w = smoothstep(1.0, 0.8, abs(rel)) * smoothstep(690.0, 708.0, qp.x);
            col = mix(col, art(src / IMG_PX), w);
        }
    }
    float L = lum(col);

    // windows in the city and stars in the sky twinkle
    float moonD = length(qp - vec2(608.0, 316.0));
    vec2 cell = floor(qp / 4.0);
    float tw = noise(vec2(hash12(cell) * 50.0, t * (0.2 + 0.5 * hash12(cell + 7.0))));
    float sky = smoothstep(0.47, 0.40, q.y);
    float notMoon = smoothstep(238.0, 256.0, moonD) * step(qp.x, 845.0 + 1000.0 * step(560.0, qp.y));
    col *= 1.0 + far * notMoon * smoothstep(0.35, 0.75, L) * (tw - 0.5) * mix(0.45, 1.1, sky);

    // the moon: a soft breathing glow, and lights racing round the station's rings
    vec2 mc = qp - vec2(608.0, 316.0);
    float mr = length(mc);
    col += vec3(0.75, 0.82, 1.0) * 0.10 * exp(-max(mr - 232.0, 0.0) * 0.012) * (0.8 + 0.2 * sin(t * 0.5)) * step(222.0, mr);
    float ma = atan(mc.y, mc.x);
    float station = step(qp.x, 830.0) * step(600.0, qp.x + 0.25 * mc.y) * step(mr, 245.0);
    float race = pow(max(cos(ma * 3.0 - t * 1.2), 0.0), 24.0) + pow(max(cos(ma * 2.0 + t * 0.7), 0.0), 30.0);
    float warm = smoothstep(0.04, 0.14, col.r - col.b);       // the station's gold lights, not the moon's surface
    col += vec3(1.0, 0.85, 0.6) * station * warm * smoothstep(0.35, 0.8, L) * race * 1.8;

    // satellites' beacons blink
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        vec2 bp = i == 0 ? vec2(282.0, 470.0) : i == 1 ? vec2(868.0, 380.0) : i == 2 ? vec2(758.0, 30.0)
                : i == 3 ? vec2(395.0, 105.0) : i == 4 ? vec2(915.0, 300.0) : vec2(700.0, 125.0);
        float blink = step(0.85, fract(t * 0.6 + fi * 0.37));
        float d = length(qp - bp);
        col += mix(vec3(1.0, 0.25, 0.2), vec3(0.8, 0.9, 1.0), step(3.0, fi)) * blink * (exp(-d * 0.35) * 1.5 + exp(-d * 0.08) * 0.25);
    }

    // moonlit cloud wisps drifting through the sky
    float c1 = fbm(vec2(q.x * 3.0 - t * 0.012, q.y * 9.0));
    float cb = smoothstep(0.24, 0.32, q.y) * smoothstep(0.47, 0.40, q.y) + smoothstep(0.30, 0.0, q.x) * smoothstep(0.32, 0.05, q.y) * 0.7;
    col = mix(col, vec3(0.62, 0.62, 0.80) * (0.55 + 0.45 * c1), smoothstep(0.5, 0.8, c1) * cb * 0.35);
    // mist rolling through the city below
    float c2 = fbm(vec2(q.x * 4.0 + t * 0.02, q.y * 10.0 + 4.0));
    col = mix(col, vec3(0.75, 0.72, 0.82), smoothstep(0.55, 0.8, c2) * smoothstep(0.55, 0.65, q.y) * smoothstep(0.80, 0.70, q.y) * far * 0.3);

    // a slow pulse of light radiates through the raked sand's glowing lines
    float sand = smoothstep(0.70, 0.73, q.y) * smoothstep(0.6, 0.75, m.r) * (1.0 - m.b);
    vec2 gd = (q - vec2(0.42, 0.88)) * vec2(1.0, 1.0 / imgAspect);
    float wave = 0.5 + 0.5 * sin(length(gd) * 28.0 - t * 1.4);
    col *= 1.0 + sand * smoothstep(0.45, 0.8, L) * (wave - 0.3) * 0.85;

    // moonlight glitters on the water
    col += vec3(0.8, 0.9, 1.0) * m.b * pow(noise(qp * vec2(0.5, 1.6) + t * 1.3), 12.0) * 1.4;

    // lanterns flicker
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        vec3 lp = i == 0 ? vec3(61.0, 1033.0, 14.0) : i == 1 ? vec3(436.0, 1204.0, 24.0)
                : i == 2 ? vec3(830.0, 1462.0, 34.0) : vec3(14.0, 990.0, 10.0);
        float fl = 0.78 + 0.22 * noise(vec2(t * 6.0, fi * 7.0));
        float d = length(qp - lp.xy) / lp.z;
        col += vec3(1.0, 0.62, 0.28) * (exp(-d * 1.2) * 0.35 + exp(-d * 0.35) * 0.08) * fl;
    }

    // maple leaves drifting down from the tree and across the garden
    float gustX = smoothstep(0.6, 1.0, noise(vec2(t * 0.15, 2.0))) * 260.0;
    for (int i = 0; i < 36; i++) {
        float fi = float(i);
        bool near = i >= 30;                              // a few big leaves right in front of us
        float life = near ? 6.0 + 3.0 * hash11(fi * 3.1) : 9.0 + 7.0 * hash11(fi * 3.1);
        float ph = fract(t / life + hash11(fi * 7.7));
        float cyc = floor(t / life + hash11(fi * 7.7));
        float sx = 30.0 + 470.0 * hash11(fi * 1.9 + cyc * 0.37);
        float sy = 480.0 + 380.0 * hash11(fi * 5.3 + cyc * 0.61);
        if (near) { sx = -60.0 + 700.0 * hash11(fi * 1.9 + cyc * 0.37); sy = 200.0 + 500.0 * hash11(fi * 5.3 + cyc * 0.61); }
        vec2 c = vec2(sx + ph * (180.0 + 160.0 * hash11(fi)) + 30.0 * sin(ph * 9.0 + fi) + gustX * ph,
                      sy + ph * (1750.0 - sy) * (0.7 + 0.3 * hash11(fi * 2.0)));
        float size = near ? 22.0 + 14.0 * hash11(fi * 9.1) : 5.0 + 6.0 * hash11(fi * 9.1) + 4.0 * smoothstep(1000.0, 1600.0, c.y);
        float spin = t * (1.5 + hash11(fi * 4.4)) + fi;
        float cov = leaf(qp, c, size, spin, cos(t * 2.3 + fi * 1.7)) * smoothstep(0.0, 0.05, ph) * smoothstep(1.0, 0.9, ph);
        vec3 lc = mix(vec3(0.55, 0.03, 0.05), vec3(1.0, 0.18, 0.12), 0.5 + 0.5 * cos(t * 2.3 + fi * 1.7));
        if (near) { lc *= 0.75; cov *= 0.85; }            // out of focus, a little darker
        col = mix(col, lc, cov * 0.95);
    }

    // fireflies wander the garden and under the maple
    for (int i = 0; i < 14; i++) {
        float fi = float(i);
        vec2 home = vec2(40.0 + 600.0 * hash11(fi * 2.7), 760.0 + 650.0 * hash11(fi * 5.9));
        vec2 fp = home + vec2(sin(t * (0.3 + 0.2 * hash11(fi)) + fi) * 45.0, cos(t * (0.25 + 0.2 * hash11(fi + 3.0)) + fi * 2.0) * 30.0);
        float pulse = pow(0.5 + 0.5 * sin(t * (1.2 + hash11(fi * 8.0)) + fi * 3.0), 3.0);
        float d = length(qp - fp);
        col += vec3(1.0, 0.85, 0.45) * pulse * (exp(-d * 0.6) * 1.4 + exp(-d * 0.12) * 0.18);
    }

    // now and then a shooting star streaks across the sky
    float st = mod(t, 13.0);
    vec2 s0 = vec2(80.0 + 300.0 * hash11(floor(t / 13.0)), 40.0 + 120.0 * hash11(floor(t / 13.0) + 3.0));
    vec2 sh = s0 + vec2(260.0, 110.0) * clamp(st / 0.9, 0.0, 1.0);
    vec2 sd = qp - sh;
    vec2 dir = normalize(vec2(260.0, 110.0));
    float along = -dot(sd, dir);
    float trail = exp(-abs(dot(sd, vec2(-dir.y, dir.x))) * 1.2) * smoothstep(120.0, 0.0, along) * step(0.0, along);
    col += vec3(0.85, 0.9, 1.0) * trail * step(st, 0.9) * (1.0 - st / 0.9) * 1.4 * smoothstep(258.0, 268.0, length(qp - vec2(608.0, 316.0)));

    // a soft bloom on the brightest lights
    vec3 glow = vec3(0.0);
    for (int i = 0; i < 6; i++) {
        float a = float(i) * 1.0472;
        glow += max(art(q + vec2(cos(a), sin(a) * imgAspect) * 0.012) - 0.6, 0.0);
    }
    col += glow * 0.12;

    vec2 v = s - 0.5;
    col *= 1.0 - 0.4 * dot(v * vec2(1.3, 0.9), v * vec2(1.3, 0.9));
    col += (hash12(fragCoord + fract(t) * 91.0) - 0.5) * 0.01;
    fragColor = vec4(col, 1.0);
}
