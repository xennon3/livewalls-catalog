// Neon Grid: a retro synthwave horizon with a striped sun and an endless scrolling grid.

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 sky(vec2 uv, float horizon) {
    float h = uv.y - horizon;
    vec3 col = mix(vec3(1.0, 0.32, 0.55), vec3(0.06, 0.02, 0.16), smoothstep(0.0, 0.42, h));
    col = mix(col, vec3(0.02, 0.01, 0.06), smoothstep(0.35, 0.6, h));

    // Twinkling stars, fading out towards the horizon glow.
    vec2 sp = uv * 90.0;
    vec2 id = floor(sp);
    float r = hash(id);
    float star = step(0.986, r) * smoothstep(0.45, 0.0, length(fract(sp) - 0.5));
    star *= 0.55 + 0.45 * sin(iTime * (1.0 + r * 3.0) + r * 60.0);
    col += star * smoothstep(0.12, 0.35, h);

    // The sun, with stripes that thicken towards its base and slowly drift down.
    vec2 sc = uv - vec2(0.0, horizon + 0.19);
    float d = length(sc);
    float body = smoothstep(0.175, 0.17, d);
    float gap = mix(0.0, 0.6, smoothstep(0.03, -0.17, sc.y));
    float stripes = step(gap, fract(sc.y * 26.0 + iTime * 0.25));
    vec3 sunCol = mix(vec3(1.0, 0.15, 0.55), vec3(1.0, 0.86, 0.35), smoothstep(-0.17, 0.16, sc.y));
    col = mix(col, sunCol, body * stripes);
    col += vec3(1.0, 0.25, 0.55) * 0.35 * exp(-d * 7.0);
    return col;
}

vec3 ground(vec2 uv, float horizon) {
    float depth = horizon - uv.y;
    float z = 0.32 / depth;
    vec2 g = vec2(uv.x * z * 2.2, z + iTime * 1.2);
    vec2 w = abs(fract(g - 0.5) - 0.5) / fwidth(g);
    float line = 1.0 - min(min(w.x, w.y), 1.0);
    line *= smoothstep(0.0, 0.06, depth); // avoid moire at the horizon

    vec3 col = mix(vec3(0.09, 0.0, 0.14), vec3(0.01, 0.0, 0.03), smoothstep(0.0, 0.5, depth));
    col += line * mix(vec3(1.0, 0.3, 0.9), vec3(0.25, 0.8, 1.0), smoothstep(0.0, 0.5, depth));
    col += vec3(1.0, 0.3, 0.6) * 0.6 * exp(-depth * 30.0); // horizon haze
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    uv.x += (iOffset.x - 0.5) * 0.12; // gentle parallax when swiping home screens
    float horizon = -0.06;
    vec3 col = uv.y > horizon ? sky(uv, horizon) : ground(uv, horizon);
    col *= 1.0 - 0.35 * dot(uv, uv); // vignette
    fragColor = vec4(col, 1.0);
}
