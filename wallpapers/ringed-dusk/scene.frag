// Ringed Dusk: a cloaked figure at a stone balustrade watches a giant ringed world rise over the
// desert. Its night side glitters with cities, its rings cut across the stars, and below the
// dunes a megacity of gold light stretches to the horizon, its avenues alive with traffic.

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
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = p * 2.03 + vec2(1.7, 9.2);
        a *= 0.5;
    }
    return v;
}

const float HZ = -0.06;                  // horizon
const vec2 PC = vec2(0.24, 0.17);        // planet centre
const float PR = 0.36;                   // planet radius
const float RT = -0.42;                  // ring tilt
const float RQ = 0.23;                   // ring squash (how edge-on)

// ring brightness at screen point p; also says whether it's the near half
float ring(vec2 p, out float near) {
    vec2 d = p - PC;
    vec2 r = mat2(cos(RT), sin(RT), -sin(RT), cos(RT)) * d;
    near = step(r.y, 0.0);
    float rr = length(vec2(r.x, r.y / RQ)) / PR;
    if (rr < 1.25 || rr > 2.15) return 0.0;
    float bands = 0.55 + 0.45 * sin(rr * 55.0) * sin(rr * 13.0 + 1.0);
    float gap = smoothstep(0.012, 0.0, abs(rr - 1.72)) + smoothstep(0.02, 0.0, abs(rr - 1.42)) * 0.6;
    float edge = smoothstep(1.25, 1.32, rr) * smoothstep(2.15, 2.0, rr);
    return clamp(bands - gap, 0.0, 1.0) * edge;
}

vec3 sky(vec2 p, float t) {
    float k = clamp((p.y - HZ) / 0.55, 0.0, 1.0);
    vec3 col = mix(vec3(0.55, 0.30, 0.15), vec3(0.01, 0.015, 0.04), pow(k, 0.35));
    col += vec3(1.0, 0.55, 0.25) * 0.5 * exp(-(p.y - HZ) * 30.0);
    // stars, twinkling
    vec2 sg = p * 260.0;
    vec2 si = floor(sg);
    float st = step(0.985, hash12(si)) * smoothstep(0.3, 0.0, length(fract(sg) - 0.5));
    col += vec3(0.9, 0.9, 1.0) * st * (0.6 + 0.4 * sin(t * (1.0 + 3.0 * hash12(si + 1.0)) + hash12(si) * 6.0)) * smoothstep(0.0, 0.2, p.y - HZ);

    float near;
    float rg = ring(p, near);
    vec3 ringCol = vec3(0.85, 0.80, 0.70) * rg * 0.9;

    // far half of the rings sits behind the planet
    col += ringCol * (1.0 - near);

    vec2 d = (p - PC) / PR;
    float r2 = dot(d, d);
    if (r2 < 1.0) {
        vec3 n = vec3(d, sqrt(1.0 - r2));
        vec3 L = normalize(vec3(-0.80, -0.05, -0.60));       // the sun is behind it, off to the left
        float diff = max(dot(n, L), 0.0);
        // slowly turning surface: banded storms in latitude, swirls
        float lon = atan(n.x, n.z) + t * 0.01;
        vec2 sp = vec2(lon * 1.6, n.y * 3.0);
        float storms = fbm(sp * 3.0 + vec2(fbm(sp * 2.0) * 1.5, 0.0));
        vec3 surf = mix(vec3(0.35, 0.25, 0.18), vec3(0.85, 0.65, 0.42), storms);
        surf = mix(surf, vec3(0.55, 0.40, 0.28), 0.5 * sin(n.y * 14.0 + storms * 4.0) * 0.5 + 0.25);
        vec3 lit = surf * diff * 1.6;
        // night side: glittering city lights
        float night = smoothstep(0.15, 0.0, diff);
        float web = smoothstep(0.50, 0.62, storms) + 0.5 * smoothstep(0.03, 0.0, abs(fract(storms * 6.0) - 0.5));
        float cities = step(0.72, hash12(floor(sp * 90.0))) * web;
        lit += vec3(1.0, 0.68, 0.22) * cities * night * 1.1;
        lit += surf * vec3(0.10, 0.07, 0.05) * night;      // ring-shine on the night side
        // thin atmosphere glowing on the sunlit limb
        float limb = pow(1.0 - n.z, 3.0);
        lit += vec3(1.0, 0.75, 0.45) * pow(limb, 0.7) * smoothstep(-0.35, 0.4, dot(vec3(n.xy, 0.0), vec3(L.xy, 0.0))) * 1.6;
        // ring shadow across the disc
        float sn;
        float rs = ring(p + vec2(0.03, 0.025), sn);
        lit *= 1.0 - 0.5 * rs * (1.0 - sn);
        float aa = smoothstep(1.0, 0.995, r2);
        col = mix(col, lit, aa);
    }
    // near half of the rings passes in front
    col = mix(col, col * 0.3 + ringCol, near * rg * 0.85);

    // a shuttle drifting up from the city every 40 s
    float ph = fract(t / 40.0);
    vec2 sh = vec2(-0.12 + ph * 0.25, HZ + ph * 0.5);
    float trail = smoothstep(0.002, 0.0, abs((p.x - sh.x) * 0.9 - (p.y - sh.y) * 0.45)) * step(p.y, sh.y) * smoothstep(0.15, 0.0, sh.y - p.y);
    col += vec3(1.0, 0.8, 0.5) * (trail * 0.6 + smoothstep(0.004, 0.0, length(p - sh)) * 2.0) * step(0.1, ph) * step(ph, 0.9);
    return col;
}

vec3 city(vec2 p, float t) {
    float dy = p.y - HZ;
    float z = 0.30 * 1.0 / max(-dy, 1e-3);           // depth (km), camera 1 km up
    float X = p.x * z / 0.30;
    vec3 col = vec3(0.06, 0.035, 0.02);
    // blocks of warm light, denser along the avenues
    vec2 g = vec2(X * 22.0, z * 10.0);
    float district = smoothstep(0.35, 0.6, noise(vec2(X * 0.4, z * 0.5)));
    float lit = step(0.62 - 0.25 * district, hash12(floor(g))) * smoothstep(0.45, 0.1, length(fract(g) - 0.5));
    col += vec3(1.0, 0.66, 0.28) * lit * 0.9 * exp(-z * 0.06);
    col += vec3(1.0, 0.55, 0.22) * district * 0.10 * exp(-z * 0.05);
    // avenues converging on the horizon, with flowing traffic
    float av = abs(fract(X * 0.5) - 0.5);
    float avenue = smoothstep(0.012 + 0.004 * z, 0.0, av);
    float flow = step(0.7, fract(z * 4.0 - t * 0.8 + floor(X * 0.5) * 0.37));
    col += vec3(1.0, 0.85, 0.55) * avenue * (0.4 + 0.8 * flow) * exp(-z * 0.05);
    // the great highway sweeping across
    float hw = abs(X - (z * 0.9 - 4.0));
    col += vec3(1.0, 0.92, 0.75) * smoothstep(0.25, 0.0, hw) * (0.8 + 0.4 * step(0.5, fract(z * 6.0 - t * 1.5)));
    // haze toward the horizon and the dunes beyond
    col = mix(col, vec3(0.75, 0.42, 0.20), smoothstep(4.0, 30.0, z) * 0.75);
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    vec2 p = uv + vec2((iOffset.x - 0.5) * 0.06, 0.0);
    vec3 col = p.y > HZ ? sky(p, t) : city(p, t);

    // dunes along the horizon, lit orange from behind
    float dune = HZ + 0.018 + 0.012 * sin(p.x * 18.0 + 1.3) + 0.008 * sin(p.x * 41.0);
    if (p.y < dune && p.y > HZ - 0.012) {
        col = mix(vec3(0.55, 0.28, 0.12), vec3(0.95, 0.55, 0.25), smoothstep(dune - 0.025, dune, p.y));
    }

    // the balcony: a carved column on the left, a balustrade running down to the right
    vec2 q = uv + vec2((iOffset.x - 0.5) * 0.015, 0.0);
    float railY = -0.24 - (q.x + 0.22) * 0.32;
    if (q.y < railY + 0.012) {
        vec3 stone = vec3(0.06, 0.045, 0.04);
        float top = smoothstep(0.004, 0.0, abs(q.y - railY - 0.008));
        stone += vec3(0.9, 0.5, 0.25) * top * 0.35;                        // dusk on the handrail
        // balusters with gaps showing the city
        float post = fract((q.x + 0.3) * 55.0);
        float postShape = step(abs(post - 0.5), 0.22 + 0.10 * sin((railY - q.y) * 90.0));
        float band = step(railY - 0.075, q.y) * step(q.y, railY - 0.002);
        float solid = max(step(q.y, railY - 0.075), step(railY - 0.002, q.y));
        float m = max(solid, band * postShape);
        stone += vec3(0.6, 0.3, 0.15) * 0.15 * band * postShape * smoothstep(0.35, 0.5, post);
        col = mix(col, stone, m);
    }
    float colX = -0.185 - 0.012 * smoothstep(0.38, 0.40, q.y) - 0.012 * smoothstep(-0.36, -0.38, q.y);
    if (q.x < colX) {
        float flute = 0.5 + 0.5 * sin(q.x * 300.0);
        vec3 pillar = vec3(0.05, 0.04, 0.035) * (0.7 + 0.3 * flute);
        pillar += vec3(0.8, 0.45, 0.2) * 0.12 * smoothstep(colX - 0.02, colX, q.x);
        float carve = smoothstep(0.55, 0.75, fbm(q * vec2(40.0, 30.0)));
        pillar *= 1.0 - 0.4 * carve * step(0.1, q.y);
        col = mix(col, pillar, smoothstep(colX, colX - 0.002, q.x));
    }

    // the watcher: a hooded, cloaked figure at the rail, breathing, its hem stirring
    vec2 f = q - vec2(-0.115, -0.30);
    float breathe = 1.0 + 0.01 * sin(t * 1.1);
    float hem = 0.004 * sin(t * 1.7 + f.x * 200.0);
    float cloakW = (mix(0.030, 0.019, smoothstep(-0.045, 0.07, f.y)) - 0.006 * smoothstep(0.075, 0.11, f.y)) * breathe;
    float cloak = step(abs(f.x + 0.06 * max(f.y + 0.045, 0.0) * 0.1), cloakW) * step(-0.045 + hem, f.y) * step(f.y, 0.105);
    vec2 hq = (f - vec2(0.001, 0.118)) * vec2(1.0, 0.80);
    float hood = step(length(hq), 0.0145 - 0.25 * max(hq.y, 0.0));
    float figure = max(cloak, hood);
    vec3 fc = vec3(0.02, 0.015, 0.015);
    fc += vec3(0.9, 0.5, 0.25) * 0.25 * smoothstep(0.004, 0.0, abs(f.x + cloakW - 0.002)) * step(-0.04, f.y);   // rim light
    col = mix(col, fc, figure);

    vec2 v = fragCoord / iResolution.xy - 0.5;
    col *= 1.0 - 0.5 * dot(v, v);
    col = 1.0 - exp(-col * 1.5);
    fragColor = vec4(col, 1.0);
}
