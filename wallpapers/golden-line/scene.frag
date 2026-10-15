// Golden Line: a plant-filled loft at golden hour. Through the tall window the city runs down to
// a glittering sea, the low sun pours through dust and leaves, and every so often a teal
// commuter train curves along the line below. Swipe to shift your seat in the room.

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

const float HZ = 0.06;                 // sea horizon
const vec2 SUN = vec2(-0.05, 0.10);
const float WIN_L = -0.10;             // window's left edge
const float SILL = -0.24;              // window sill

// the commuter line: x as a function of y, curving from the sill up into the city
float trackX(float y) {
    float k = (y - SILL) / (HZ - 0.02 - SILL);       // 0 at the sill, 1 far away
    return mix(0.02, 0.07, k) - 0.06 * sin(k * 2.6) + 0.02 * k * k;
}

vec3 outside(vec2 p, float t) {
    // sky: gold at the horizon, clear blue above, the sun low on the left
    float k = clamp((p.y - HZ) / 0.45, 0.0, 1.0);
    vec3 col = mix(vec3(1.25, 0.72, 0.30), vec3(0.18, 0.42, 0.85), pow(k, 0.55));
    float sd = length(p - SUN);
    col += vec3(1.0, 0.70, 0.35) * (1.6 * exp(-sd * 10.0) + 0.45 * exp(-sd * 3.0));
    col = mix(col, vec3(4.0, 3.6, 2.8), smoothstep(0.022, 0.016, sd));
    // a few lit wisps of cloud
    float cl = fbm(p * vec2(5.0, 18.0) + vec2(t * 0.01, 0.0));
    col = mix(col, vec3(1.0, 0.86, 0.70), smoothstep(0.55, 0.75, cl) * smoothstep(HZ, HZ + 0.12, p.y) * smoothstep(0.42, 0.2, p.y) * 0.7);

    // the sea strip on the horizon, sparkling under the sun
    if (p.y < HZ) {
        col = mix(vec3(0.95, 0.70, 0.40), vec3(0.20, 0.45, 0.62), smoothstep(-0.05, 0.25, p.x - SUN.x));
        float g = noise(vec2(p.x * 300.0 + t * 0.5, p.y * 1200.0 - t));
        col += vec3(1.0, 0.9, 0.6) * pow(g, 10.0) * 2.0 * exp(-abs(p.x - SUN.x) * 8.0);
    }

    // the city: rows of blocks, small and hazy far away, big and sunlit up close
    for (int r = 0; r < 7; r++) {
        float fr = float(r);
        float base = HZ - 0.035 - fr * fr * 0.006 - fr * 0.012;
        float w = 0.010 + fr * 0.007;
        float cx = (p.x + fr * 0.37) / w;
        float id = floor(cx);
        float h = (0.010 + 0.035 * hash11(id + fr * 31.0)) * (1.0 + fr * 0.45);
        if (r == 2 && abs(p.x - 0.11) < 0.022) h = 0.20;                  // the landmark tower
        float fx = fract(cx);
        float gap = step(0.06, fx) * step(fx, 0.94);
        if (p.y < base + h && p.y > base - 0.06 && gap > 0.0) {
            float lit = step(fx, 0.55);                          // sun from the left
            vec3 c = mix(vec3(0.22, 0.26, 0.40), vec3(1.15, 0.72, 0.40), lit);
            c *= 0.75 + 0.25 * hash11(id * 7.0 + fr);
            vec2 g = vec2(fx * 6.0, (p.y - base) * (90.0 - fr * 6.0));
            float win = step(0.4, fract(g.x)) * step(0.5, fract(g.y));
            c = mix(c, c * 0.65, win);
            c += vec3(1.0, 0.9, 0.6) * win * lit * step(0.85, hash12(floor(g) + id)) * 0.8;  // glints
            float roof = smoothstep(0.003, 0.0, abs(p.y - (base + h)));
            c += vec3(1.0, 0.85, 0.6) * roof * 0.4;
            c = mix(c, vec3(1.05, 0.72, 0.45), 0.50 * exp(-fr * 0.7));   // golden haze
            col = c;
        }
    }
    // trees between the blocks near the line
    float tr = fbm(p * vec2(60.0, 80.0));
    float treeMask = smoothstep(0.58, 0.62, tr) * smoothstep(-0.06, -0.22, p.y);
    col = mix(col, mix(vec3(0.15, 0.30, 0.10), vec3(0.55, 0.62, 0.25), noise(p * 400.0)), treeMask);

    // the railway cutting: two tracks and the train
    float tx = trackX(p.y);
    float depth = clamp((p.y - SILL) / (HZ - SILL), 0.0, 1.0);
    float tw = mix(0.035, 0.004, pow(depth, 0.6));
    float dxp = p.x - tx;
    if (abs(dxp) < tw * 1.6 && p.y < HZ - 0.02) {
        vec3 bed = vec3(0.30, 0.27, 0.25);
        float rails = smoothstep(0.08, 0.0, abs(fract(dxp / tw * 2.0 + 0.5) - 0.5) - 0.38);
        bed = mix(bed, vec3(0.75, 0.70, 0.62), rails * 0.6);
        bed += vec3(1.0, 0.8, 0.5) * 0.15;
        // the train: a run of teal cars along the line, every 36 s
        float ph = fract(t / 36.0);
        float head = mix(1.4, -0.6, ph);                   // in "depth" units, coming towards us
        float along = depth - head;
        float on = step(0.0, along) * step(along, 0.45) * step(abs(dxp + tw * 0.4), tw * 0.55);
        if (on > 0.0) {
            float car = fract(along * 16.0);
            vec3 tc = vec3(0.10, 0.60, 0.62);
            tc = mix(tc, vec3(0.85, 0.95, 0.9), step(0.55, fract((p.y - SILL) * 300.0)) * step(0.2, car) * step(car, 0.85) * step(0.0, -dxp - tw * 0.1) * 0.6);
            tc *= 0.8 + 0.2 * step(0.06, car);
            tc += vec3(1.0, 0.8, 0.5) * 0.25 * step(0.0, -(dxp + tw * 0.4));    // sunlit flank
            bed = tc;
        }
        col = mix(col, bed, smoothstep(tw * 1.6, tw * 1.2, abs(dxp)));
    }
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    float par = (iOffset.x - 0.5);
    vec2 po = uv + vec2(par * 0.05, 0.0);         // far city moves more than the room
    vec2 pi = uv + vec2(par * 0.015, 0.0);

    vec3 col;
    bool glass = pi.x > WIN_L && pi.y > SILL;
    if (glass) {
        col = outside(po, t);
        col = mix(col, col * vec3(0.92, 0.95, 1.0), 0.15);           // the pane's tint
        // a vertical mullion where two panes meet
        float mul = smoothstep(0.004, 0.002, abs(pi.x - 0.12));
        col = mix(col, vec3(0.08, 0.06, 0.05), mul);
    } else {
        // the room: dark warm walls, a bookcase, a floor washed by sunlight
        col = vec3(0.10, 0.07, 0.06);
        if (pi.x < WIN_L - 0.01 && pi.y > -0.12) {
            vec2 b = vec2(pi.x * 90.0, pi.y * 22.0);
            float shelf = smoothstep(0.08, 0.0, fract(b.y));
            float book = step(0.12, fract(b.x + hash11(floor(b.y)) )) * step(0.25, fract(b.y));
            vec3 spine = mix(vec3(0.35, 0.14, 0.10), vec3(0.20, 0.30, 0.35), hash12(floor(b)));
            col = mix(col, spine * (0.5 + 0.5 * hash12(floor(b) + 3.0)), book * 0.8);
            col = mix(col, vec3(0.20, 0.13, 0.08), shelf);
        }
        if (pi.y < SILL) {
            vec3 floorc = mix(vec3(0.20, 0.11, 0.07), vec3(0.30, 0.16, 0.10), noise(vec2(pi.x * 8.0, pi.y * 120.0)));
            // a red rug
            vec2 rq = pi - vec2(-0.02, -0.40);
            float rug = step(abs(rq.x + rq.y * 0.4), 0.16) * step(abs(rq.y), 0.08);
            float motif = noise(rq * 160.0) * 0.5 + 0.5 * step(0.5, fract((abs(rq.x) + abs(rq.y)) * 55.0));
            vec3 rugc = mix(vec3(0.32, 0.07, 0.07), vec3(0.12, 0.10, 0.22), motif * 0.6);
            rugc = mix(rugc, vec3(0.45, 0.30, 0.12), smoothstep(0.012, 0.0, abs(abs(rq.y) - 0.07)) * 0.6);
            floorc = mix(floorc, rugc, rug * 0.85);
            col = floorc;
            // the window's sunlight thrown across the floor
            float sx = pi.x + (pi.y - SILL) * 0.9;
            col += vec3(1.0, 0.70, 0.40) * 0.55 * step(WIN_L, sx) * step(sx, 0.20) * smoothstep(-0.50, -0.30, pi.y);
        }
        // the window frame
        col = mix(col, vec3(0.16, 0.10, 0.07), smoothstep(0.008, 0.004, abs(pi.x - WIN_L)) * step(SILL, pi.y));
        col = mix(col, vec3(0.30, 0.20, 0.13), smoothstep(0.010, 0.004, abs(pi.y - SILL)) * step(WIN_L, pi.x));
    }

    // hanging lamps glowing warm in the room
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        vec2 lp = vec2(-0.19 + fi * 0.035, 0.12 - fi * 0.05 + 0.004 * sin(t * 0.7 + fi));
        float d = length(pi - lp);
        col += vec3(1.0, 0.55, 0.20) * (smoothstep(0.012, 0.008, d) * 1.6 + 0.10 / (1.0 + d * d * 1500.0));
        col = mix(col, vec3(0.05, 0.04, 0.03), smoothstep(0.0012, 0.0, abs(pi.x - lp.x)) * step(lp.y, pi.y));
    }

    // potted plants on the sill, rim-lit by the sun
    float pl = fbm(vec2(pi.x * 26.0, pi.y * 18.0) + 4.0);
    float top = SILL + 0.04 + 0.07 * pl * smoothstep(-0.12, 0.05, pi.x) + 0.05 * smoothstep(0.6, 0.8, noise(vec2(pi.x * 50.0, 1.0)));
    float plant = step(pi.y, top) * step(SILL - 0.005, pi.y) * step(WIN_L - 0.02, pi.x);
    vec3 pcol = mix(vec3(0.05, 0.10, 0.04), vec3(0.25, 0.42, 0.12), noise(pi * 300.0) * 0.6);
    pcol += vec3(1.0, 0.75, 0.35) * smoothstep(top - 0.008, top, pi.y) * 0.8;
    col = mix(col, pcol, plant);

    // vines trailing down from the top of the window
    float vc = pi.x * 55.0;
    float vid = floor(vc);
    float vlen = 0.30 + 0.12 * hash11(vid) + 0.01 * sin(t * 0.6 + vid);
    float vf = fract(vc + sin(t * 0.8 + vid) * 0.3 * (0.5 - pi.y)) - 0.5;
    float leaf = smoothstep(0.30, 0.12, length(vec2(vf * 1.3, (fract(pi.y * 110.0 + vid * 0.37) - 0.5) * 0.9)));
    float vine = step(vlen, pi.y) * step(0.45, hash11(vid * 2.3)) * max(smoothstep(0.05, 0.02, abs(vf)), leaf * step(0.4, noise(vec2(vid, pi.y * 30.0))));
    vec3 vcol = mix(vec3(0.05, 0.12, 0.04), vec3(0.55, 0.70, 0.20), leaf * step(WIN_L, pi.x) * 0.7);
    col = mix(col, vcol, vine);

    // god rays through the window and dust turning in them
    vec2 rd = uv - SUN;
    float ang = atan(rd.y, rd.x);
    float beam = pow(noise(vec2(ang * 9.0, t * 0.05)), 3.0) * smoothstep(0.0, -0.6, rd.y) * step(rd.y, 0.0);
    col += vec3(1.0, 0.70, 0.38) * beam * 0.55 * smoothstep(0.9, 0.1, length(rd));
    vec2 dq = uv * 60.0 + vec2(t * 0.15, sin(t * 0.2) * 0.8);
    float mote = step(0.985, hash12(floor(dq))) * smoothstep(0.25, 0.0, length(fract(dq) - 0.5));
    col += vec3(1.0, 0.85, 0.6) * mote * beam * 3.0;

    vec2 v = fragCoord / iResolution.xy - 0.5;
    col *= 1.0 - 0.55 * dot(v, v);
    col = 1.0 - exp(-col * 1.35);
    col = pow(col, vec3(0.92, 1.0, 1.12));          // golden-hour grade
    fragColor = vec4(col, 1.0);
}
