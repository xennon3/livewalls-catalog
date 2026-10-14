// Lava Lamp: warm wax blobs that drift, merge and split.

float field(vec2 p) {
    float f = 0.0;
    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        float speed = 0.08 + 0.035 * fi;
        vec2 c = vec2(
            0.28 * sin(iTime * speed * 0.7 + fi * 2.1),
            0.62 * sin(iTime * speed + fi * 1.7)
        );
        float r = 0.06 + 0.025 * mod(fi * 3.0, 4.0);
        vec2 d = p - c;
        f += r * r / dot(d, d);
    }
    // Pools of wax resting at the top and bottom of the lamp.
    f += 0.012 / max(0.58 + p.y, 0.001) + 0.012 / max(0.58 - p.y, 0.001);
    return f;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float f = field(p);

    vec3 bg = mix(vec3(0.16, 0.02, 0.12), vec3(0.03, 0.0, 0.06), length(p) * 1.4);
    float inside = smoothstep(0.92, 1.08, f);
    vec3 wax = mix(vec3(1.0, 0.25, 0.1), vec3(1.0, 0.75, 0.2), clamp((f - 1.0) * 0.5, 0.0, 1.0));
    wax = mix(wax, vec3(1.0, 0.2, 0.55), smoothstep(0.3, -0.5, p.y)); // pinker towards the bottom

    vec3 col = bg + vec3(1.0, 0.3, 0.2) * 0.25 * smoothstep(0.3, 1.0, f); // glow around blobs
    col = mix(col, wax, inside);
    col += 0.25 * smoothstep(1.6, 3.0, f) * vec3(1.0, 0.9, 0.6); // hot cores
    fragColor = vec4(col, 1.0);
}
