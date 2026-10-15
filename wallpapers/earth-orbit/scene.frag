// Earth Orbit: the planet turning below the station, edged by the thin blue line of its atmosphere.

const float TAU = 6.2831853;
const float LOOP = 300.0;              // one full turn; keep in sync with meta.json "loop"
const vec3 SUN = vec3(-0.85, 0.35, -0.12);

float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
}

float hash12(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}

float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x),
                   mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
                   mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

float fbm3(vec3 p, int octaves) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < octaves; i++) {
        v += a * noise3(p);
        p = p * 2.03 + vec3(1.7, 9.2, 3.1);
        a *= 0.5;
    }
    return v;
}

// Earth-fixed coordinates of a world-space surface normal: axial tilt, then the daily spin.
vec3 toEarth(vec3 n, float spin) {
    float ct = cos(0.41), st = sin(0.41);
    n = vec3(n.x, ct * n.y - st * n.z, st * n.y + ct * n.z);
    float c = cos(spin), s = sin(spin);
    return vec3(c * n.x + s * n.z, n.y, -s * n.x + c * n.z);
}

vec3 planet(vec3 n, vec3 rd, vec3 L, float spin) {
    vec3 q = toEarth(n, spin);
    float h = fbm3(q * 3.2 + 4.0, 5);
    float land = smoothstep(0.525, 0.545, h);
    float lat = abs(q.y);

    vec3 ocean = mix(vec3(0.003, 0.02, 0.07), vec3(0.02, 0.12, 0.26), smoothstep(0.42, 0.525, h));
    float dry = smoothstep(0.45, 0.68, noise3(q * 5.0 + 11.0)) * (1.0 - smoothstep(0.25, 0.55, lat));
    float tex = noise3(q * 24.0);
    vec3 ground = mix(vec3(0.05, 0.12, 0.04), vec3(0.12, 0.20, 0.07), tex);
    ground = mix(ground, vec3(0.50, 0.38, 0.22) * (0.8 + 0.3 * tex), dry);
    ground = mix(ground, vec3(0.28, 0.24, 0.20), smoothstep(0.60, 0.70, h));
    vec3 col = mix(ocean, ground, land);
    float ice = smoothstep(0.80, 0.88, lat + 0.10 * (h - 0.5));
    col = mix(col, vec3(0.80, 0.86, 0.92), ice);

    // Clouds drift twice as fast as the ground.
    vec3 qc = toEarth(n, spin * 2.0);
    vec3 w = qc * 4.0 + 0.6 * vec3(noise3(qc * 6.0), noise3(qc * 6.0 + 5.0), noise3(qc * 6.0 + 9.0));
    float cl = fbm3(w * vec3(1.6, 3.2, 1.6) + 20.0, 4);
    float shadow = smoothstep(0.50, 0.64, fbm3((w + 0.04) * vec3(1.6, 3.2, 1.6) + 20.0, 2));
    cl = smoothstep(0.50, 0.62, cl) * 0.95;
    col *= 1.0 - 0.45 * shadow;

    float ndl = dot(n, L);
    float day = smoothstep(-0.08, 0.30, ndl);
    float diff = max(ndl, 0.0);
    vec3 lit = mix(col, vec3(0.92), cl) * (0.02 + 1.3 * diff);

    // Sun glint on open water.
    vec3 r = reflect(-L, n);
    float glint = pow(max(dot(r, -rd), 0.0), 60.0) * (1.0 - land) * (1.0 - cl) * diff;
    lit += vec3(1.0, 0.9, 0.75) * glint * 1.5;

    // City lights on the night side.
    float region = smoothstep(0.55, 0.80, noise3(q * 14.0)) * smoothstep(0.54, 0.58, h) * (1.0 - ice);
    float city = region * (smoothstep(0.55, 0.85, noise3(q * 150.0)) + 0.25 * smoothstep(0.4, 0.9, noise3(q * 50.0)));
    vec3 night = vec3(1.0, 0.66, 0.32) * city * 1.4 * (1.0 - cl * 0.7);

    vec3 c = mix(night, lit, day);

    // Atmosphere seen against the surface: blue haze that thickens toward the limb.
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    c += vec3(0.25, 0.55, 1.0) * pow(rim, 1.6) * 0.8 * smoothstep(-0.2, 0.4, ndl);
    return c;
}

vec3 stars(vec2 p) {
    vec2 g = p * 90.0;
    vec2 id = floor(g);
    float h = hash12(id);
    if (h < 0.86) return vec3(0.0);
    vec2 pos = vec2(hash12(id + 7.1), hash12(id + 3.7)) - 0.5;
    float d = length(fract(g) - 0.5 - pos * 0.7);
    float tw = 0.65 + 0.35 * sin(iTime * TAU * (3.0 + 4.0 * hash12(id + 1.3)) / 8.0 + h * 40.0);
    float b = smoothstep(0.12, 0.0, d) * (h - 0.86) * 7.0 * tw;
    return vec3(0.85, 0.9, 1.0) * b;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float spin = mod(iTime, LOOP) / LOOP * TAU;
    vec3 L = normalize(SUN);

    // Camera above the planet, pitched up so the curved limb crosses the screen.
    vec3 ro = vec3(0.0, 0.0, -2.0);
    float pitch = 0.43;
    float yaw = (iOffset.x - 0.5) * 0.18;
    vec3 rd = normalize(vec3(p.x, p.y, 1.05));
    rd = vec3(rd.x, rd.y * cos(pitch) + rd.z * sin(pitch), -rd.y * sin(pitch) + rd.z * cos(pitch));
    rd = vec3(rd.x * cos(yaw) + rd.z * sin(yaw), rd.y, -rd.x * sin(yaw) + rd.z * cos(yaw));

    float tca = dot(-ro, rd);
    float d = sqrt(max(dot(ro, ro) - tca * tca, 0.0));
    vec3 col;

    if (tca > 0.0 && d < 1.0) {
        float t = tca - sqrt(1.0 - d * d);
        vec3 n = normalize(ro + rd * t);
        col = planet(n, rd, L, spin);
    } else {
        // Space: stars, then the atmosphere glow around the limb.
        col = stars(p + vec2(yaw * 0.6, 0.0));
        float alt = max(d - 1.0, 0.0);
        vec3 limb = (ro + rd * max(tca, 0.0)) / max(d, 1e-4);
        float ldl = dot(limb, L);
        float lit = smoothstep(-0.30, 0.35, ldl);
        float thin = exp(-alt / 0.0035);
        float haze = exp(-alt / 0.018);
        vec3 atm = vec3(0.45, 0.80, 1.0) * thin * 1.6 + vec3(0.10, 0.30, 0.95) * haze * 0.9;
        // Orange band where the terminator meets the limb.
        float dusk = exp(-pow(ldl / 0.12, 2.0));
        atm += vec3(1.0, 0.45, 0.15) * exp(-alt / 0.004) * dusk * 1.2;
        float mask = clamp(haze * 1.5, 0.0, 1.0);
        col = col * (1.0 - mask * lit) + atm * max(lit, dusk * 0.8);
    }

    // Faint sun haze from the upper left, as through a station window.
    col += vec3(0.25, 0.35, 0.55) * 0.12 * smoothstep(0.9, 0.0, length(p - vec2(-0.35, 0.55)));

    col = 1.0 - exp(-col * 1.4);
    col = pow(col, vec3(0.92));
    fragColor = vec4(col, 1.0);
}
