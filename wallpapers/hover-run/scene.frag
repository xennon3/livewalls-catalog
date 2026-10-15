// Hover Run: a rider on a hover bike skims an endless ocean at sunset, leaving neon trails and a wake.

const float SPEED = 24.0;                 // metres per second over the water
const float CAM_H = 2.0;                  // camera height above the water
const float HZ = 0.10;                    // horizon height on screen
const vec3 BIKE = vec3(0.6, 0.65, 13.0);  // bike anchor in camera space (x, hover height, depth)

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
        p = p * 2.02 + vec2(3.1, 1.7);
        a *= 0.5;
    }
    return v;
}

// Vertical bob of the bike at time t. The trails replay it, so they ripple like a record of the ride.
float bob(float t) {
    return 0.07 * sin(t * 2.3) + 0.03 * sin(t * 5.1 + 1.0);
}

vec3 sunDir() {
    return normalize(vec3(-0.03, 0.05, 1.0));
}

vec3 skyColor(vec3 rd, bool withClouds, float t) {
    float e = max(rd.y, 0.0);
    vec3 col = mix(vec3(1.0, 0.62, 0.20), vec3(1.0, 0.30, 0.22), smoothstep(0.0, 0.06, e));
    col = mix(col, vec3(0.78, 0.10, 0.42), smoothstep(0.04, 0.16, e));
    col = mix(col, vec3(0.25, 0.04, 0.32), smoothstep(0.14, 0.34, e));
    col = mix(col, vec3(0.03, 0.01, 0.09), smoothstep(0.30, 0.70, e));

    vec3 S = sunDir();
    float sd = max(dot(rd, S), 0.0);
    col += vec3(1.0, 0.45, 0.20) * pow(sd, 30.0) * 0.35;
    col += vec3(1.0, 0.65, 0.35) * pow(sd, 400.0) * 0.6;
    // Sun disc: yellow at the top, hot pink toward the horizon.
    float disc = smoothstep(0.99830, 0.99850, sd);
    vec3 sunCol = mix(vec3(1.0, 0.25, 0.45), vec3(1.0, 0.90, 0.45), smoothstep(-0.01, 0.10, rd.y));
    col = mix(col, sunCol * 1.25, disc);

    if (withClouds && rd.y > 0.012) {
        vec2 cp = rd.xz / rd.y;
        float c = fbm(vec2(cp.x * 0.30 + t * 0.008, cp.y * 0.08));
        float a = smoothstep(0.55, 0.80, c) * smoothstep(0.012, 0.05, rd.y) * (1.0 - smoothstep(0.30, 0.55, rd.y));
        vec3 cc = mix(vec3(1.0, 0.45, 0.35), vec3(0.35, 0.06, 0.30), smoothstep(0.04, 0.28, rd.y));
        cc += vec3(1.0, 0.55, 0.25) * pow(sd, 10.0) * 0.7;
        col = mix(col, cc, a * 0.9);
    }
    return col;
}

// Wave surface: travelling swells plus fine chop. Returns the normal at a world-space point.
vec3 waveNormal(vec2 w, float t, float fade, float foot) {
    vec2 g = vec2(0.0);
    vec2 dirs[5] = vec2[5](vec2(0.9, 0.4), vec2(-0.6, 0.8), vec2(0.2, 1.0), vec2(1.0, -0.3), vec2(-0.3, -1.0));
    float freqs[5] = float[5](0.35, 0.60, 1.0, 1.7, 2.9);
    float amps[5] = float[5](0.32, 0.20, 0.12, 0.06, 0.03);
    for (int i = 0; i < 5; i++) {
        vec2 d = normalize(dirs[i]);
        float k = freqs[i];
        float ph = dot(d, w) * k + t * sqrt(9.8 * k);
        g += d * amps[i] * k * cos(ph) * smoothstep(1.2, 0.25, k * foot);
    }
    // Fine chop from noise, only up close.
    vec2 cw = w * 1.8 + vec2(0.0, t * 0.6);
    float e = 0.15;
    float c0 = fbm(cw);
    g += vec2(fbm(cw + vec2(e, 0.0)) - c0, fbm(cw + vec2(0.0, e)) - c0) / e * 0.35 * smoothstep(0.6, 0.1, foot) * fade;
    return normalize(vec3(-g.x, 1.0, -g.y));
}

float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

// Tapered capsule: radius ra at a, rb at b.
float sdTaper(vec2 p, vec2 a, vec2 b, float ra, float rb) {
    p -= a;
    b -= a;
    float h = dot(b, b);
    vec2 q = vec2(dot(p, vec2(b.y, -b.x)), dot(p, b)) / h;
    q.x = abs(q.x);
    float k0 = ra - rb;
    vec2 c = vec2(sqrt(h - k0 * k0), k0);
    float k = c.x * q.y - c.y * q.x;
    float m = dot(c, q);
    float n = dot(q, q);
    if (k < 0.0) return sqrt(h * n) - ra;
    if (k > c.x) return sqrt(h * (n + 1.0 - 2.0 * q.y)) - rb;
    return m - ra;
}

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// The hover bike: a single smooth teardrop hull, raised tail fin and a ring thruster.
float hullSdf(vec2 q) {
    float d = sdTaper(q, vec2(-1.20, 0.40), vec2(1.60, 0.22), 0.21, 0.05);          // main hull
    d = smin(d, sdTaper(q, vec2(-0.85, 0.22), vec2(1.10, 0.17), 0.15, 0.06), 0.12); // belly
    d = smin(d, sdTaper(q, vec2(-0.95, 0.50), vec2(-1.55, 0.78), 0.10, 0.025), 0.08); // tail fin
    d = smin(d, sdTaper(q, vec2(0.25, 0.46), vec2(1.00, 0.34), 0.10, 0.04), 0.10);  // nose cowl
    // Ring thruster at the back: an open ellipse.
    vec2 rq = (q - vec2(-1.32, 0.34)) / vec2(0.10, 0.24);
    float ring = abs(length(rq) - 1.0) * 0.10 - 0.018;
    d = min(d, ring);
    return d;
}

// The rider: a slim armoured figure lying flat along the bike.
float riderSdf(vec2 q) {
    float d = sdTaper(q, vec2(-0.55, 0.72), vec2(0.22, 0.86), 0.14, 0.16);          // torso
    d = smin(d, sdTaper(q, vec2(-0.30, 0.86), vec2(0.12, 0.95), 0.07, 0.05), 0.06); // back armour
    // Helmet: an elongated aero shell, swept back.
    vec2 hq = q - vec2(0.50, 0.92);
    hq = mat2(0.97, 0.24, -0.24, 0.97) * hq;
    float helmet = sdTaper(hq, vec2(-0.14, 0.0), vec2(0.10, 0.0), 0.10, 0.13);
    d = smin(d, helmet, 0.05);
    d = smin(d, sdTaper(q, vec2(0.20, 0.82), vec2(0.55, 0.64), 0.065, 0.05), 0.04); // upper arm
    d = smin(d, sdTaper(q, vec2(0.55, 0.64), vec2(0.86, 0.58), 0.05, 0.04), 0.03);  // forearm
    d = smin(d, sdTaper(q, vec2(-0.55, 0.70), vec2(-0.12, 0.52), 0.11, 0.085), 0.05); // thigh
    d = smin(d, sdTaper(q, vec2(-0.12, 0.52), vec2(-0.58, 0.40), 0.08, 0.05), 0.03); // shin
    return d;
}

float bikeSdf(vec2 q) {
    return smin(hullSdf(q), riderSdf(q), 0.04);
}

// Neon trails from the tail fin and the ring thruster, replaying the bike's bob.
vec3 lights(vec2 q, float t) {
    vec3 col = vec3(0.0);
    float behind = -1.45 - q.x;
    if (behind > 0.0) {
        float b0 = bob(t - behind / SPEED) - bob(t);
        float fade = exp(-behind / 10.0) * smoothstep(0.0, 0.3, behind);
        float w = 0.03 + behind * 0.004;
        float y1 = 0.78 + b0;
        float y2 = 0.34 + b0 * 1.3;
        col += vec3(1.0, 0.18, 0.70) * (exp(-pow((q.y - y1) / (w * 0.7), 2.0)) * 1.5 + exp(-abs(q.y - y1) / (w * 5.0)) * 0.22) * fade;
        col += vec3(0.15, 0.85, 1.0) * (exp(-pow((q.y - y2) / (w * 1.6), 2.0)) * 1.2 + exp(-abs(q.y - y2) / (w * 6.0)) * 0.25) * fade;
    }
    vec2 tl = q - vec2(-1.55, 0.78);
    col += vec3(1.0, 0.25, 0.70) * 0.006 / (dot(tl, tl) + 0.002);
    vec2 hl = q - vec2(1.62, 0.22);
    col += vec3(0.40, 0.95, 1.0) * 0.006 / (dot(hl, hl) + 0.002);
    // Ring thruster: a hot glowing ellipse with a plasma core.
    vec2 rq = (q - vec2(-1.32, 0.34)) / vec2(0.10, 0.24);
    float rr = length(rq);
    col += vec3(0.30, 0.90, 1.0) * (exp(-pow((rr - 1.0) / 0.18, 2.0)) * 1.4 + exp(-rr * 1.6) * 0.6);
    // Hover field: a thin light blade along the belly and its glow on the spray below.
    vec2 tq = (q - vec2(0.10, 0.06)) / vec2(0.95, 0.025);
    col += vec3(0.30, 0.90, 1.0) * exp(-dot(tq, tq)) * 1.6;
    vec2 tg = (q - vec2(0.10, -0.06)) / vec2(1.3, 0.18);
    col += vec3(0.20, 0.70, 1.0) * exp(-dot(tg, tg)) * 0.35;
    return col;
}

// The same lights mirrored in the water: vertical streaks broken up by the waves.
vec3 lightReflections(vec2 q, float waterY, float t, vec2 world) {
    float below = waterY - q.y;
    if (below < 0.0) return vec3(0.0);
    float shimmer = 0.35 + 0.9 * smoothstep(0.35, 0.75, noise(vec2(world.x * 2.0, below * 9.0 - t * 2.0)));
    float drop = exp(-below / 0.7) * smoothstep(0.0, 0.35, below) * shimmer;
    vec3 col = vec3(0.0);
    float behind = -1.45 - q.x;
    if (behind > 0.0) {
        float fade = exp(-behind / 10.0) * smoothstep(0.0, 2.0, behind);
        col += (vec3(1.0, 0.18, 0.70) * 0.45 + vec3(0.15, 0.85, 1.0) * 0.55) * fade * 0.9;
    }
    // Pool of cyan light under the thrusters.
    float pool = exp(-pow(q.x / 1.3, 2.0)) * exp(-below / 0.5);
    col += vec3(0.20, 0.80, 1.0) * pool * 1.2;
    return col * drop;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float t = iTime;
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    p.x += (iOffset.x - 0.5) * 0.06;

    vec3 ro = vec3(0.0, CAM_H, 0.0);
    vec3 rd = normalize(vec3(p.x, p.y - HZ, 1.0));

    // Where the bike sits on screen; q is the pixel in metres on the bike's plane.
    float by = BIKE.y + bob(t);
    vec2 bikeScreen = vec2(BIKE.x, by - CAM_H) / BIKE.z + vec2(0.0, HZ);
    vec2 q = (p - bikeScreen) * BIKE.z;
    float waterY = -by;  // the water surface at the bike's depth, in q units

    vec3 col;
    if (rd.y > 0.0) {
        col = skyColor(rd, true, t);
    } else {
        float dist = -CAM_H / rd.y;
        vec2 pos = ro.xz + rd.xz * dist;
        vec2 world = pos + vec2(SPEED * t, 0.0);
        float fade = 1.0 / (1.0 + dist * 0.04);
        float foot = dist * dist / (CAM_H * iResolution.y);
        vec3 n = waveNormal(world, t, fade, foot);

        vec3 r = reflect(rd, n);
        r.y = abs(r.y);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
        vec3 water = vec3(0.02, 0.01, 0.05) + vec3(0.12, 0.02, 0.10) * (1.0 - fade);
        col = mix(water, skyColor(r, false, t) * 0.95, fres);

        // Glitter path toward the sun.
        float sd = max(dot(r, sunDir()), 0.0);
        col += vec3(1.0, 0.65, 0.35) * (pow(sd, 600.0) * 4.0 + pow(sd, 60.0) * 0.30);

        // Wake behind the bike: a Kelvin V plus churned water down the middle.
        vec2 rel = pos - BIKE.xz;
        float back = -rel.x;
        if (back > -2.0) {
            float b = max(back, 0.0);
            float foamN = fbm(vec2(world.x * 1.1, pos.y * 2.2 + t * 0.4));
            float arm = abs(abs(rel.y) - b * 0.34) / (0.20 + b * 0.05);
            float v = exp(-arm * arm) * exp(-b / 25.0) * smoothstep(-2.0, 0.5, back);
            float core = exp(-rel.y * rel.y / (0.15 + b * 0.05)) * exp(-b / 14.0) * smoothstep(-2.0, 0.0, back);
            float foam = clamp((v * 0.9 + core * 1.5) * (0.3 + 1.3 * foamN), 0.0, 1.0);
            col = mix(col, vec3(1.0, 0.80, 0.85), foam * 0.8 * fade);
        }

        col += lightReflections(q, waterY, t, world);
        col = mix(col, vec3(1.0, 0.45, 0.30), smoothstep(40.0, 600.0, dist) * 0.55);
    }

    // Spray and mist kicked up behind the thrusters.
    if (q.x < -0.3 && q.x > -14.0) {
        float b = -0.3 - q.x;
        float h = q.y - waterY;
        float mist = fbm(vec2((q.x + SPEED * t) * 1.1, h * 4.0 - t * 2.5));
        float top = 0.55 + b * 0.10;
        float shape = exp(-max(h, 0.0) / top) * smoothstep(-0.35, 0.05, h) * exp(-b / 6.0) * smoothstep(0.0, 1.2, b);
        float a = clamp(shape * smoothstep(0.45, 0.85, mist) * 1.2, 0.0, 0.8);
        col = mix(col, vec3(1.0, 0.82, 0.86), a);
        vec2 dg = vec2(mod((q.x + SPEED * t * 0.85) * 6.0, 512.0), (h + t * 0.5) * 6.0);
        vec2 id = floor(dg);
        float dd = length(fract(dg) - 0.5 - (vec2(hash12(id + 2.3), hash12(id + 5.1)) - 0.5) * 0.6);
        col += vec3(1.0, 0.8, 0.75) * smoothstep(0.10, 0.0, dd) * step(0.90, hash12(id)) * shape * 1.2;
    }

    // The bike: a backlit silhouette with a hot rim from the sun, neon seams and a lit visor.
    float aa = BIKE.z * 1.5 / iResolution.y;
    // Only pixels near the bike pay for its shapes.
    bool nearBike = q.x > -1.9 && q.x < 2.0 && q.y > -0.3 && q.y < 1.4;
    float d = nearBike ? bikeSdf(q) : 1.0;
    float body = smoothstep(aa, -aa, d);
    float rim = 0.0;
    if (abs(d) < 0.12) {
        vec2 e = vec2(0.01, 0.0);
        vec2 gr = vec2(bikeSdf(q + e.xy) - bikeSdf(q - e.xy), bikeSdf(q + e.yx) - bikeSdf(q - e.yx));
        rim = body * smoothstep(-0.04, -0.006, d) * smoothstep(-0.1, 0.7, normalize(gr).y);
    }
    float hull = nearBike ? hullSdf(q) : 1.0;
    float rider = nearBike ? riderSdf(q) : 1.0;
    // Gloss: hull panels are a touch lighter on top, like polished carbon catching the sky.
    vec3 bodyCol = vec3(0.025, 0.02, 0.05) + vec3(0.10, 0.04, 0.12) * smoothstep(0.1, 0.55, q.y) * step(hull, rider);
    bodyCol += vec3(1.0, 0.55, 0.35) * rim;
    // Neon seam that follows the hull's contour, inset from the edge.
    float seam = smoothstep(0.012, 0.0, abs(hull + 0.05)) * step(hull, rider) * smoothstep(0.15, 0.3, q.y);
    bodyCol += vec3(0.20, 0.85, 1.0) * seam * 1.3;
    // Panel line across the hull.
    bodyCol += vec3(1.0, 0.25, 0.70) * smoothstep(0.012, 0.0, abs(q.x + 0.35 - (q.y - 0.3) * 0.6)) * step(hull, -0.02) * step(hull, rider) * 0.8;
    // Suit light lines: along the spine and down the arm and leg.
    float suit = sdCapsule(q, vec2(-0.25, 0.88), vec2(0.08, 0.96), 0.0);
    suit = min(suit, sdCapsule(q, vec2(0.32, 0.77), vec2(0.52, 0.66), 0.0));
    suit = min(suit, sdCapsule(q, vec2(-0.40, 0.62), vec2(-0.22, 0.55), 0.0));
    bodyCol += vec3(1.0, 0.25, 0.75) * smoothstep(0.014, 0.0, suit) * step(rider, -0.015) * 1.2;
    // Visor: a bright strip wrapping the front of the helmet.
    vec2 hq = mat2(0.97, 0.24, -0.24, 0.97) * (q - vec2(0.50, 0.92));
    float visor = smoothstep(0.012, 0.0, abs(hq.y - 0.01) - 0.03) * smoothstep(0.02, 0.08, hq.x) * step(rider, -0.01);
    bodyCol += mix(vec3(0.3, 0.9, 1.0), vec3(1.0), 0.3) * visor * 1.4;
    col = mix(col, bodyCol, body);
    col += vec3(0.4, 0.9, 1.0) * exp(-length(hq - vec2(0.12, 0.01)) / 0.08) * 0.15 * (1.0 - body);
    col += vec3(1.0, 0.45, 0.35) * exp(-max(d, 0.0) / 0.05) * 0.08 * (1.0 - body);
    col += lights(q, t);

    col = col / (1.0 + 0.18 * col) * 1.18;
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
