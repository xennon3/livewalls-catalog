// Space Elevator: twilight over the ocean. A tether climbs from an offshore anchor station into the
// stars, still catching the sun high up, while climber pods ride it toward orbit.

const float PITCH = 0.30;                 // camera tilted up so the tether towers overhead
const float TX = 160.0;                   // tether position (metres) in the station plane
const float TZ = 3000.0;                  // distance to the station plane
const float EYE = 18.0;
const float LIT_ALT = 900.0;              // above this altitude the tether is still in sunlight
const vec3 SUN = vec3(-0.85, -0.06, 0.52); // just below the horizon, to the left

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

float sdBox(vec2 p, vec2 c, vec2 h) {
    vec2 d = abs(p - c) - h;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

vec3 sky(vec3 rd, float t) {
    float e = rd.y;
    vec3 sun = normalize(SUN);
    float toward = dot(normalize(vec3(rd.x, 0.0, rd.z)), normalize(vec3(sun.x, 0.0, sun.z))) * 0.5 + 0.5;
    // Afterglow: hot near the horizon on the sun side, fading up into deep blue.
    vec3 hor = mix(vec3(0.55, 0.30, 0.45), vec3(1.0, 0.48, 0.22), pow(toward, 2.0));
    vec3 col = mix(hor, vec3(0.62, 0.30, 0.48), smoothstep(0.0, 0.10, e));
    col = mix(col, vec3(0.20, 0.16, 0.42), smoothstep(0.06, 0.30, e));
    col = mix(col, vec3(0.03, 0.04, 0.12), smoothstep(0.25, 0.75, e));
    col += vec3(1.0, 0.55, 0.25) * pow(toward, 8.0) * exp(-max(e, 0.0) * 14.0) * 0.6;

    // Thin high clouds, lit pink from below.
    if (e > 0.01) {
        vec2 cp = rd.xz / e * 0.35 + vec2(t * 0.003, 0.0);
        float c = fbm(cp * vec2(1.0, 3.0));
        float a = smoothstep(0.52, 0.78, c) * smoothstep(0.01, 0.08, e) * (1.0 - smoothstep(0.35, 0.6, e));
        vec3 cc = mix(vec3(1.0, 0.55, 0.45), vec3(0.45, 0.25, 0.50), smoothstep(0.05, 0.4, e));
        cc = mix(cc * 0.6, cc * 1.3, pow(toward, 3.0));
        col = mix(col, cc, a * 0.8);
        // Stars and the occasional satellite.
        vec2 sg = vec2(atan(rd.x, rd.z), asin(e)) * 260.0;
        vec2 id = floor(sg);
        float h = hash12(id);
        float st = step(0.975, h) * smoothstep(0.3, 0.0, length(fract(sg) - 0.5));
        float tw = 0.6 + 0.4 * sin(t * (1.5 + h * 3.0) + h * 50.0);
        col += vec3(0.85, 0.9, 1.0) * st * tw * smoothstep(0.2, 0.55, e) * (1.0 - a) * 1.2;
    }
    return col;
}

// Everything in the station plane: tether, climbers, beacons and the anchor station.
// q is the hit point in metres (x across, y up); fp is one pixel's size in metres there.
vec4 stationPlane(vec2 q, float fp, float t, bool reflection) {
    vec3 col = vec3(0.0);
    float a = 0.0;
    float x = q.x - TX;

    // Tether: a dark ribbon that turns gold where it still sees the sun.
    float tw = 2.2;
    float tet = smoothstep(tw + fp, tw - fp, abs(x)) * step(0.0, q.y);
    float sunlit = smoothstep(LIT_ALT - 150.0, LIT_ALT + 150.0, q.y);
    vec3 tc = mix(vec3(0.05, 0.05, 0.07), vec3(1.0, 0.72, 0.45) * 1.2, sunlit);
    tc += vec3(0.6, 0.8, 1.0) * exp(-q.y / 120.0) * 0.6;   // floodlit at the base
    col = mix(col, tc, tet);
    a = max(a, tet);
    // Faint glow around the tether in the evening haze.
    col += mix(vec3(0.4, 0.6, 1.0) * exp(-q.y / 200.0), vec3(1.0, 0.7, 0.4), sunlit) * exp(-abs(x) / (fp * 6.0 + 4.0)) * 0.15 * step(0.0, q.y);

    // Beacons every 400 m, blinking in a wave that runs up the tether.
    float seg = floor(q.y / 400.0 + 0.5);
    vec2 bq = vec2(x, q.y - seg * 400.0);
    float blink = step(0.75, fract(t * 0.5 - seg * 0.08));
    float br = max(fp * 1.5, 1.5);
    col += vec3(1.0, 0.15, 0.10) * exp(-dot(bq, bq) / (br * br * 4.0)) * blink * 2.5 * step(200.0, q.y);

    // Climber pods: one rising, one descending.
    for (int i = 0; i < 2; i++) {
        float fi = float(i);
        float cyc = fract(t / 120.0 + fi * 0.5);
        float alt = fi < 0.5 ? 40.0 + cyc * 4200.0 : 4200.0 - cyc * 4200.0;
        vec2 cq = vec2(x, q.y - alt);
        float pod = sdBox(cq, vec2(0.0, 0.0), vec2(9.0, 14.0));
        pod = min(pod, sdBox(cq, vec2(0.0, 0.0), vec2(13.0, 3.0)));
        float podCov = smoothstep(fp, -fp, pod);
        float podLit = smoothstep(LIT_ALT - 150.0, LIT_ALT + 150.0, alt);
        vec3 pc = mix(vec3(0.07, 0.07, 0.10), vec3(1.0, 0.80, 0.55), podLit * 0.8);
        // Window band and running lights.
        pc += vec3(0.6, 0.85, 1.0) * step(abs(cq.y - 4.0), 2.0) * step(abs(cq.x), 7.0) * 0.8;
        col = mix(col, pc, podCov);
        a = max(a, podCov);
        float lr = max(fp * 1.6, 2.0);
        vec2 l1 = cq - vec2(-13.0, 0.0);
        vec2 l2 = cq - vec2(13.0, 0.0);
        float fl = 0.6 + 0.4 * step(0.5, fract(t * 1.2 + fi * 0.3));
        col += vec3(0.4, 0.9, 1.0) * (exp(-dot(l1, l1) / (lr * lr * 3.0)) + exp(-dot(l2, l2) / (lr * lr * 3.0))) * fl * 2.0;
        col += vec3(0.5, 0.8, 1.0) * exp(-length(cq) / (fp * 20.0 + 30.0)) * 0.25;
    }

    // Anchor station on the sea.
    float d = sdBox(q, vec2(TX, 22.0), vec2(230.0, 9.0));                         // deck
    d = min(d, sdBox(q, vec2(TX - 175.0, 6.0), vec2(9.0, 8.0)));                  // legs
    d = min(d, sdBox(q, vec2(TX - 60.0, 6.0), vec2(9.0, 8.0)));
    d = min(d, sdBox(q, vec2(TX + 60.0, 6.0), vec2(9.0, 8.0)));
    d = min(d, sdBox(q, vec2(TX + 175.0, 6.0), vec2(9.0, 8.0)));
    float taper = clamp((q.y - 30.0) / 150.0, 0.0, 1.0);
    d = min(d, sdBox(q, vec2(TX, 105.0), vec2(mix(34.0, 8.0, taper), 75.0)));     // anchor tower
    d = min(d, length(q - vec2(TX - 120.0, 31.0)) - 34.0);                        // dome
    d = min(d, sdBox(q, vec2(TX + 140.0, 70.0), vec2(9.0, 40.0)));                // crane mast
    d = min(d, sdBox(q, vec2(TX + 110.0, 108.0), vec2(48.0, 2.5)));               // crane jib
    d = min(d, sdBox(q, vec2(TX - 200.0, 50.0), vec2(4.0, 20.0)));                // comms mast
    d = max(d, -q.y);
    float st = smoothstep(fp, -fp, d);
    if (st > 0.0) {
        vec3 sc = vec3(0.035, 0.035, 0.05);
        // Lit windows on the deck and tower.
        vec2 wg = vec2(q.x / 6.0, q.y / 5.0);
        float win = step(0.55, hash12(floor(wg))) * step(0.3, fract(wg.x)) * step(0.35, fract(wg.y));
        sc += vec3(1.0, 0.78, 0.5) * win * 0.7 * step(14.0, q.y);
        // Dome glow.
        sc += vec3(0.3, 0.7, 1.0) * smoothstep(34.0, 20.0, length(q - vec2(TX - 120.0, 31.0))) * 0.35;
        col = mix(col, sc, st);
        a = max(a, st);
    }
    // Warning lights on the station's high points.
    vec2 w1 = q - vec2(TX + 140.0, 112.0);
    vec2 w2 = q - vec2(TX - 200.0, 72.0);
    float wr = max(fp * 1.5, 1.5);
    float wb = step(0.5, fract(t * 0.7));
    col += vec3(1.0, 0.2, 0.1) * (exp(-dot(w1, w1) / (wr * wr * 4.0)) + exp(-dot(w2, w2) / (wr * wr * 4.0)) * (1.0 - wb)) * 2.0;
    // Floodlights washing up the base of the tether.
    col += vec3(0.5, 0.75, 1.0) * exp(-abs(x) / 25.0) * exp(-max(q.y - 30.0, 0.0) / 90.0) * 0.25 * step(25.0, q.y);
    return vec4(col, a);
}

vec3 rayDir(vec2 p) {
    vec3 rd = normalize(vec3(p.x, p.y, 1.0));
    return vec3(rd.x, rd.y * cos(PITCH) + rd.z * sin(PITCH), -rd.y * sin(PITCH) + rd.z * cos(PITCH));
}

vec3 sceneAbove(vec3 ro, vec3 rd, float t, bool reflection) {
    vec3 col = sky(rd, t);
    if (rd.z > 0.0 && ro.z < TZ) {
        float tp = (TZ - ro.z) / rd.z;
        vec3 hp = ro + rd * tp;
        float fp = tp * 1.2 / iResolution.y;
        vec4 sp = stationPlane(hp.xy, fp, t, reflection);
        col = mix(col, sp.rgb, sp.a) + sp.rgb * (1.0 - sp.a);
    }
    // An airliner crossing far away, wingtip strobes and a red beacon.
    vec3 plane = normalize(vec3(-900.0 + mod(t * 25.0, 1800.0), 1500.0, 5200.0) - ro);
    float pa = acos(clamp(dot(plane, rd), -1.0, 1.0));
    float strobe = step(0.92, fract(t * 0.9));
    col += vec3(1.0) * exp(-pa * pa * 1.5e7) * strobe * 2.0 + vec3(1.0, 0.2, 0.2) * exp(-pa * pa * 1.5e7) * step(0.5, fract(t * 0.6)) * 1.2;
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float t = iTime;
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    p.x += (iOffset.x - 0.5) * 0.05;
    vec3 ro = vec3(0.0, EYE, 0.0);
    vec3 rd = rayDir(p);

    vec3 col;
    if (rd.y > 0.0) {
        col = sceneAbove(ro, rd, t, false);
        // Haze right at the horizon.
        col = mix(col, vec3(0.75, 0.42, 0.45), exp(-rd.y * 60.0) * 0.35);
    } else {
        float dist = -ro.y / rd.y;
        vec3 wp = ro + rd * dist;
        vec2 w = wp.xz;
        // Long swells plus ripples, flattened with distance to avoid shimmering.
        float foot = dist * dist / (ro.y * iResolution.y);
        vec2 g = vec2(0.0);
        for (int i = 0; i < 6; i++) {
            float fi = float(i);
            float k = 0.08 * pow(1.8, fi);
            vec2 d = normalize(vec2(sin(fi * 2.4 + 0.3), cos(fi * 2.4 + 0.3)));
            float amp = 0.5 / pow(1.9, fi);
            g += d * amp * k * cos(dot(d, w) * k + t * sqrt(9.8 * k)) * smoothstep(1.0, 0.2, k * foot);
        }
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 r = reflect(rd, n);
        r.y = abs(r.y);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
        vec3 refl = sceneAbove(wp + vec3(0.0, 0.1, 0.0), r, t, true);
        vec3 deep = vec3(0.02, 0.03, 0.07);
        col = mix(deep, refl, clamp(fres * 1.1, 0.0, 1.0));
        // Ship lights dotted along the horizon.
        for (int i = 0; i < 4; i++) {
            float fi = float(i);
            vec3 sp = normalize(vec3(-2500.0 + fi * 1700.0 + 300.0 * hash11(fi) + t * 2.0, 4.0, 4000.0 + 2000.0 * hash11(fi + 3.0)) - ro);
            float sa = acos(clamp(dot(sp, normalize(vec3(rd.x, -rd.y, rd.z))), -1.0, 1.0));
            col += vec3(1.0, 0.85, 0.6) * exp(-sa * sa * 8.0e6) * 0.4;
        }
        col = mix(col, vec3(0.70, 0.40, 0.45), (1.0 - exp(-dist * 0.00035)) * 0.45);
        // Just below the horizon the station's legs stand in front of the far water.
        float tp = (TZ - ro.z) / rd.z;
        if (rd.z > 0.0 && tp < dist) {
            vec3 hp = ro + rd * tp;
            vec4 sp = stationPlane(hp.xy, tp * 1.2 / iResolution.y, t, false);
            col = mix(col, sp.rgb, sp.a) + sp.rgb * (1.0 - sp.a);
        }
    }

    col = col / (1.0 + col * 0.3) * 1.1;
    col *= 1.0 - 0.25 * dot(p * vec2(1.4, 0.9), p * vec2(1.4, 0.9));
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
