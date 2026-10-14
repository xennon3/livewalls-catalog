// Aurora: northern lights rippling over a mountain lake.

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.03;
        a *= 0.5;
    }
    return v;
}

float mountains(float x) {
    return -0.15 + 0.12 * fbm(vec2(x * 1.6 + 3.0, 1.0)) + 0.03 * sin(x * 5.0);
}

vec3 scene(vec2 uv) {
    float t = iTime;
    vec3 col = mix(vec3(0.02, 0.06, 0.12), vec3(0.0, 0.0, 0.02), smoothstep(-0.1, 0.5, uv.y));

    vec2 sp = uv * 110.0;
    float r = hash(floor(sp));
    col += step(0.988, r) * smoothstep(0.45, 0.0, length(fract(sp) - 0.5)) *
           (0.6 + 0.4 * sin(t * 2.0 + r * 50.0));

    // Three curtains: a sharp lower edge that fades upward, with fine vertical rays.
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float base = -0.07 + 0.09 * fi + 0.14 * fbm(vec2(uv.x * 1.2 + fi * 4.0, t * 0.06 + fi));
        float d = uv.y - base;
        float curtain = smoothstep(-0.015, 0.01, d) * exp(-max(d, 0.0) * (6.0 - fi));
        float rays = 0.45 + 0.55 * fbm(vec2(uv.x * 30.0 + fi * 9.0 + t * 0.15, fi));
        vec3 c = mix(vec3(0.1, 1.0, 0.55), vec3(0.55, 0.25, 1.0), clamp(d * 3.0 + fi * 0.3, 0.0, 1.0));
        col += c * curtain * rays * (0.55 - fi * 0.12);
    }

    float m = mountains(uv.x);
    float edge = smoothstep(0.0, 0.004, m - uv.y);
    col = mix(col, vec3(0.01, 0.02, 0.035), edge);
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    uv.x += (iOffset.x - 0.5) * 0.1;
    float lake = -0.13;
    vec3 col;
    if (uv.y > lake) {
        col = scene(uv);
    } else {
        // Mirror the sky in the lake, broken up by small ripples.
        float ripple = 0.004 * sin(uv.y * 160.0 + iTime * 2.0) * (lake - uv.y + 0.05) * 6.0;
        col = scene(vec2(uv.x + ripple, 2.0 * lake - uv.y)) * 0.55;
        col += vec3(0.02, 0.04, 0.06) * smoothstep(0.0, 0.3, lake - uv.y);
    }
    fragColor = vec4(col, 1.0);
}
