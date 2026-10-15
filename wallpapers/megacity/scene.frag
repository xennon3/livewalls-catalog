// Megacity: a night skyline seen from high up. Towers stack into the haze, billboards flicker,
// streams of flying cars thread between the layers and a holographic koi drifts through it all.

const float HZ = 0.16;          // horizon height on screen
const int LAYERS = 7;

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

vec3 neon(float h) {
    if (h < 0.30) return vec3(1.0, 0.16, 0.62);
    if (h < 0.55) return vec3(0.10, 0.85, 1.0);
    if (h < 0.72) return vec3(0.62, 0.30, 1.0);
    if (h < 0.88) return vec3(1.0, 0.58, 0.12);
    return vec3(0.25, 1.0, 0.55);
}

vec3 hazeColor(float y) {
    return mix(vec3(0.55, 0.16, 0.42), vec3(0.10, 0.08, 0.22), smoothstep(HZ - 0.2, HZ + 0.25, y));
}

vec3 sky(vec2 p, float t) {
    float e = p.y - HZ;
    vec3 col = mix(vec3(0.42, 0.10, 0.36), vec3(0.06, 0.05, 0.16), smoothstep(-0.05, 0.25, e));
    col = mix(col, vec3(0.01, 0.015, 0.05), smoothstep(0.2, 0.5, e));

    // Moon behind thin cloud.
    vec2 mp = p - vec2(0.12, 0.40);
    float md = length(mp);
    vec3 moon = vec3(0.85, 0.82, 0.95) * (0.85 + 0.15 * noise(mp * 60.0));
    col = mix(col, moon, smoothstep(0.052, 0.049, md));
    col += vec3(0.45, 0.40, 0.70) * exp(-md * 12.0) * 0.35;

    // Cloud deck lit from below by the city.
    vec2 cp = vec2(p.x * 2.2 + t * 0.006, e * 7.0);
    float c = fbm(cp + vec2(fbm(cp * 0.7 + t * 0.004), 0.0));
    float band = smoothstep(0.02, 0.10, e) * (1.0 - smoothstep(0.30, 0.48, e));
    float a = smoothstep(0.42, 0.75, c) * band;
    vec3 cc = mix(vec3(0.85, 0.28, 0.55), vec3(0.20, 0.12, 0.32), smoothstep(0.05, 0.35, e));
    cc *= 0.7 + 0.5 * smoothstep(0.5, 0.9, c);
    col = mix(col, cc, a * 0.85);

    // Stars in the gaps.
    vec2 sg = p * 160.0;
    float st = step(0.985, hash12(floor(sg))) * smoothstep(0.35, 0.0, length(fract(sg) - 0.5));
    col += vec3(0.8, 0.85, 1.0) * st * smoothstep(0.25, 0.45, e) * (1.0 - a) * (0.5 + 0.5 * sin(t * 2.0 + hash12(floor(sg)) * 30.0));
    return col;
}

// Searchlight beams sweeping up into the clouds.
vec3 beams(vec2 p, float t) {
    vec3 col = vec3(0.0);
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        vec2 o = vec2(-0.20 + 0.20 * fi, HZ - 0.02);
        float ang = 0.35 * sin(t * (0.15 + 0.05 * fi) + fi * 2.0);
        vec2 dir = vec2(sin(ang), cos(ang));
        vec2 d = p - o;
        float along = dot(d, dir);
        float across = abs(d.x * dir.y - d.y * dir.x);
        float w = 0.004 + along * 0.06;
        float b = exp(-pow(across / w, 2.0)) * smoothstep(0.0, 0.05, along) * exp(-along * 2.2);
        col += mix(vec3(0.7, 0.85, 1.0), vec3(1.0, 0.7, 0.9), fi * 0.5) * b * 0.30;
    }
    return col;
}

// Animated billboard content in local 0..1 coordinates.
vec3 billboard(vec2 uv, float seed, float t) {
    float kind = hash11(seed * 3.3);
    vec3 c1 = neon(hash11(seed + 1.0));
    vec3 c2 = neon(hash11(seed + 2.0));
    vec3 col;
    if (kind < 0.35) {
        // Scrolling columns of glyph blocks.
        vec2 g = vec2(uv.x * 4.0, uv.y * 14.0 + t * (1.5 + hash11(seed) * 2.0));
        float on = step(0.45, hash12(floor(g) + seed));
        col = mix(c1 * 0.15, c1, on * step(0.2, fract(g.x)) * step(0.2, fract(g.y)));
    } else if (kind < 0.7) {
        // Pulsing gradient with a sweeping bar.
        col = mix(c1, c2, uv.y) * (0.5 + 0.5 * sin(uv.y * 8.0 - t * 2.0));
        col += vec3(1.0) * smoothstep(0.04, 0.0, abs(uv.y - fract(t * 0.3))) * 0.7;
    } else {
        // Rotating ring logo.
        vec2 q = uv - 0.5;
        float r = length(q * vec2(1.0, 0.6));
        float ang = atan(q.y, q.x) + t;
        col = c2 * smoothstep(0.02, 0.0, abs(r - 0.28)) * (0.6 + 0.4 * step(0.0, sin(ang * 3.0)));
        col += c1 * 0.25;
    }
    col *= 0.85 + 0.15 * step(0.5, fract(uv.y * 60.0));                   // scanlines
    col *= 0.75 + 0.25 * step(0.08, noise(vec2(t * 6.0, seed)));           // glitch dropouts
    return col;
}

float sdBox(vec2 p, vec2 c, vec2 h) {
    vec2 d = abs(p - c) - h;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// One layer of towers. Each slot holds one tower with its own architecture: up to three setback
// tiers, a roof style (flat with plant, chamfered, needle spire or open crown) and a facade style
// (ribbon glass, punched windows, vertical fins or an exoskeleton). Near layers add LED edge
// strips, vertical signs, billboards and sky bridges. Returns colour in .rgb, coverage in .a.
vec4 towers(vec2 p, int layer, float t, float px) {
    float fl = float(layer);
    float depth = 1.0 - fl / float(LAYERS - 1);           // 1 far ... 0 near
    float cw = 0.018 + fl * fl * 0.0042;                   // slot width
    float x = p.x + (iOffset.x - 0.5) * (0.01 + fl * 0.012) + fl * 0.137;
    float id = floor(x / cw);
    float lx = (fract(x / cw) - 0.5) * cw;                 // offset from the slot centre
    float h1 = hash11(id * 1.31 + fl * 17.0);
    float h2 = hash11(id * 2.17 + fl * 31.0);
    float h3 = hash11(id * 3.71 + fl * 7.0);
    float h4 = hash11(id * 5.13 + fl * 13.0);
    float halfW = (0.5 - 0.06 - 0.16 * h2) * cw;
    float base = HZ - 0.02 - fl * 0.05;
    float height = (0.04 + 0.10 * h1 + fl * 0.035 * h1 + 0.04 * step(0.8, h2)) * (0.7 + 0.5 * fl / 6.0);
    float top = base + height;
    float y = p.y;
    if (y > top + 0.1) return vec4(0.0);               // above anything this tower can reach

    // Setback tiers.
    float t1 = base + height * (0.55 + 0.15 * h3);
    float t2 = base + height * (0.82 + 0.08 * h4);
    float tiers = 1.0 + step(0.35, h3) + step(0.7, h3);
    float e1 = tiers > 1.0 ? t1 : top;
    float d = sdBox(vec2(lx, y), vec2(0.0, (base - 1.0 + e1) * 0.5), vec2(halfW, (e1 - base + 1.0) * 0.5));
    if (tiers > 1.0) {
        float e2 = tiers > 2.0 ? t2 : top;
        d = min(d, sdBox(vec2(lx, y), vec2(0.0, (t1 + e2) * 0.5), vec2(halfW * 0.78, (e2 - t1) * 0.5 + px)));
    }
    if (tiers > 2.0) d = min(d, sdBox(vec2(lx, y), vec2(0.0, (t2 + top) * 0.5), vec2(halfW * 0.56, (top - t2) * 0.5 + px)));
    float topW = halfW * (tiers > 2.0 ? 0.56 : (tiers > 1.0 ? 0.78 : 1.0));
    float tierW = halfW * (y > t2 && tiers > 2.0 ? 0.56 : (y > t1 && tiers > 1.0 ? 0.78 : 1.0));

    // Roof styles.
    float roof = floor(h4 * 4.0);
    float spire = 1e3;
    if (roof == 1.0) {
        // Chamfered: cut the top corners at 45 degrees.
        d = max(d, (abs(lx) + y) - (top + topW * 0.4));
    } else if (roof == 2.0) {
        // Needle spire with a tapering shaft.
        float sh = 0.03 + 0.06 * h1;
        float sw = mix(topW * 0.35, px, clamp((y - top) / sh, 0.0, 1.0));
        spire = max(abs(lx) - sw, max(top - y, y - top - sh));
        d = min(d, spire);
    } else if (roof == 3.0) {
        // Open crown frame: two prongs.
        float ch = topW * 1.2;
        float prong = max(abs(abs(lx) - topW * 0.8) - topW * 0.12, max(top - y, y - top - ch));
        d = min(d, prong);
    } else {
        // Flat roof with plant boxes.
        d = min(d, sdBox(vec2(lx, y), vec2(-topW * 0.4, top + topW * 0.12), vec2(topW * 0.25, topW * 0.12)));
        d = min(d, sdBox(vec2(lx, y), vec2(topW * 0.35, top + topW * 0.08), vec2(topW * 0.18, topW * 0.08)));
    }
    // Antenna mast.
    float mast = step(0.6, h1) * step(roof, 1.5) * smoothstep(px * 1.5, 0.0, abs(lx - topW * 0.2)) * step(y, top + 0.02 + 0.03 * h2) * step(top, y);

    // Sky bridges to the neighbouring towers (the gap hash is shared by both slots).
    float bridge = 0.0;
    float bY = 0.0;
    float bh = 0.0035 + fl * 0.0008;
    if (layer >= 2) {
        float gid = lx > 0.0 ? id : id - 1.0;
        if (hash11(gid * 7.7 + fl * 3.0) > 0.55) {
            bY = base + height * 0.0 + (0.03 + 0.12 * hash11(gid * 9.1 + fl)) * (0.7 + 0.5 * fl / 6.0);
            bridge = step(halfW, abs(lx)) * smoothstep(px, -px, abs(y - bY) - bh);
        }
    }

    // Vertical neon sign hanging off one side.
    float sgn = 0.0;
    vec2 suv = vec2(0.0);
    float signSide = h1 > 0.5 ? 1.0 : -1.0;
    if (layer >= 3 && h3 > 0.45) {
        float sw = 0.006 + fl * 0.0015;
        float sh = height * 0.28;
        float sy = base + height * (0.45 + 0.2 * h2);
        vec2 sc = vec2(signSide * (halfW + sw * 0.5 + px), sy);
        sgn = smoothstep(px, -px, sdBox(vec2(lx, y), sc, vec2(sw * 0.5, sh * 0.5)));
        suv = (vec2(lx, y) - sc) / vec2(sw, sh) + 0.5;
    }

    float body = smoothstep(px, -px, d);
    float covAll = max(max(body, mast), max(bridge, sgn));
    if (covAll <= 0.0) return vec4(0.0);

    // ---- Facade shading ----
    float style = floor(h2 * 4.0);
    vec3 col = mix(vec3(0.03, 0.03, 0.07), vec3(0.16, 0.07, 0.20), smoothstep(base - 0.1, top, y));
    col *= (0.8 + 0.4 * h1) * mix(0.55, 1.0, depth);
    // Sky reflection streaks across the glass.
    col += vec3(0.25, 0.12, 0.30) * smoothstep(0.6, 0.9, noise(vec2(lx / cw * 3.0 + id, y * 3.0))) * 0.25;
    // Pink rim on the left edge of each tier.
    col += vec3(0.35, 0.10, 0.30) * smoothstep(cw * 0.06, 0.0, lx + tierW) * 0.6;

    float wx = cw / (6.0 + floor(h1 * 5.0) + fl);
    float wy = 0.0032 + fl * 0.0008;
    vec2 wg = vec2((lx + cw) / wx, (y - base) / wy);
    vec2 wid = floor(wg);
    vec2 wf = fract(wg);
    float wh = hash12(wid + id * 7.0 + fl * 3.0);
    float floorOn = step(0.15, noise(vec2(wid.y * 0.7 + id, t * 0.05 + fl)));
    vec3 wc = mix(vec3(1.0, 0.75, 0.45), vec3(0.55, 0.80, 1.0), step(0.7, hash12(wid.yy + id)));
    wc = mix(wc, neon(hash12(wid + 9.0)), step(0.94, hash12(wid + 8.0)));
    float lit = 0.0;
    if (style == 0.0) {
        // Ribbon glazing: continuous lit bands over dark spandrels.
        lit = step(0.35, wf.y) * step(wf.y, 0.85) * step(0.45 - 0.2 * depth, hash12(vec2(wid.y, id)));
        lit *= step(0.35, hash12(vec2(floor(wid.x / 3.0), wid.y) + id)) * (0.6 + 0.4 * step(0.3, hash12(wid + 2.0)));
        lit *= step(0.12, wf.x);
        col *= 1.0 - 0.35 * step(wf.y, 0.3);
    } else if (style == 1.0) {
        // Punched windows.
        lit = step(0.55 - 0.15 * depth, wh) * step(0.25, wf.x) * step(wf.x, 0.8) * step(0.3, wf.y) * step(wf.y, 0.8);
    } else if (style == 2.0) {
        // Vertical fins with lit slots between them.
        float fin = step(0.7, fract(wg.x * 0.5));
        lit = (1.0 - fin) * step(0.3, wf.y) * step(0.5, wh);
        col += vec3(0.20, 0.14, 0.28) * fin * 0.35;
    } else {
        // Exoskeleton: diagonal bracing over dim glass.
        lit = step(0.6, wh) * step(0.3, wf.x) * step(wf.x, 0.75) * step(0.35, wf.y) * step(wf.y, 0.75);
        float bay = max(height * 0.12, wy * 3.0);
        float u = fract((y - base) / bay);
        float v = fract((lx + tierW) / (tierW * 2.0) * 2.0);
        float brace = min(abs(u - v), abs(u - (1.0 - v)));
        col = mix(col, vec3(0.10, 0.09, 0.14) * mix(0.6, 1.0, depth), smoothstep(0.08, 0.03, brace) * smoothstep(1.0, 3.0, fl));
    }
    lit *= floorOn;
    col += wc * lit * (0.30 + 0.45 * hash12(wid + 3.0)) * (0.6 + 0.6 * wf.y) * (layer > 1 ? 1.0 : 0.6);
    // Floor slabs on the closer towers.
    float detail = smoothstep(2.0, 5.0, fl);
    col *= 1.0 - detail * 0.35 * smoothstep(0.16, 0.0, wf.y);

    // Tier ledges catch light; a neon trim runs along some of them.
    float ledge = smoothstep(px * 2.0, 0.0, abs(y - t1)) * step(1.5, tiers) + smoothstep(px * 2.0, 0.0, abs(y - t2)) * step(2.5, tiers);
    col += vec3(0.5, 0.3, 0.6) * ledge * 0.4;
    col += neon(hash11(id * 3.7 + fl)) * ledge * step(0.5, hash11(id + fl * 5.0)) * 1.4;
    // A row of lights along flat roof edges.
    float roofLine = smoothstep(px * 2.0, 0.0, abs(y - top)) * step(abs(lx), topW);
    col += vec3(1.0, 0.9, 0.8) * roofLine * step(0.5, fract(lx / (px * 6.0))) * 0.6 * step(roof, 0.5);

    // LED strips up the tower edges, with a pulse running upward.
    if (layer >= 2 && h3 > 0.3) {
        float edge = smoothstep(px * 2.0, 0.0, abs(abs(lx) - halfW + px)) * step(y, tiers > 1.0 ? t1 : top);
        float pulse = 0.35 + 0.65 * pow(fract((y - base) / (height * 0.4) - t * 0.25 + h1), 6.0);
        col += neon(hash11(id * 1.9 + fl * 2.0)) * edge * pulse * 1.5;
    }
    // Spire glows toward its tip.
    if (roof == 2.0 && y > top) {
        vec3 sc = neon(hash11(id + 21.0));
        col += sc * smoothstep(px * 2.5, 0.0, abs(spire + px)) * 0.9;
        col += sc * step(0.6, fract((y - top) / 0.012 - t * 0.5)) * smoothstep(px, -px, spire) * 0.25;
    }

    // Billboards on wide near towers.
    if (layer >= 3 && h2 > 0.45 && style != 3.0) {
        float bbh = height * 0.30;
        float by = base + height * (0.15 + 0.2 * h1);
        vec2 buv = vec2((lx + halfW * 0.85) / (halfW * 1.7), (y - by) / bbh);
        if (buv.x > 0.0 && buv.x < 1.0 && buv.y > 0.0 && buv.y < 1.0) {
            col = billboard(buv, id + fl * 13.0, t) * 1.5;
        }
    }

    // Sky bridge: lit corridor with a glass band.
    if (bridge > 0.0 && body < 0.5) {
        float band = step(abs(y - bY), bh * 0.45);
        vec3 bc = vec3(0.06, 0.05, 0.10) + vec3(0.7, 0.85, 1.0) * band * (0.35 + 0.3 * step(0.5, fract(lx / (px * 5.0))));
        col = mix(col, bc, bridge);
    }
    // Vertical sign: stacked glyph blocks in a neon frame.
    if (sgn > 0.0) {
        vec3 nc = neon(hash11(id * 4.3 + fl));
        vec2 g = vec2(suv.x * 2.0, suv.y * 9.0);
        float blk = step(0.4, hash12(floor(g) + id)) * step(0.2, fract(g.x)) * step(0.15, fract(g.y));
        float frame = step(min(min(suv.x, 1.0 - suv.x) * 3.0, min(suv.y, 1.0 - suv.y) * 30.0), 0.25);
        float flick = 0.75 + 0.25 * step(0.1, noise(vec2(t * 7.0, id)));
        vec3 sc = vec3(0.02, 0.01, 0.03) + nc * (blk * 1.1 + frame * 1.5) * flick;
        col = mix(col, sc, sgn);
    }

    // Red aircraft-warning light on the roof, blinking.
    vec2 rl = vec2(lx, y - (roof == 2.0 ? top + 0.03 + 0.06 * h1 : top));
    float blink = step(0.5, fract(t * 0.6 + h1));
    col += vec3(1.0, 0.12, 0.10) * exp(-dot(rl, rl) / (px * px * 6.0)) * blink * 2.0;
    col = mix(col, vec3(0.06, 0.06, 0.08), mast * (1.0 - body));

    // Atmospheric haze grows with distance.
    col = mix(col, hazeColor(y), depth * 0.72);
    return vec4(col, covAll);
}

// Lanes of flying traffic. Each car is a white headlight and a red tail with a short light trail.
vec3 traffic(vec2 p, int lane, float t, float px) {
    vec3 sum = vec3(0.0);
    for (int k = 0; k < 2; k++) {
    float fl = float(lane) + float(k) * 0.5;
    float depth = 1.0 - fl / float(LAYERS - 1);
    float y0 = HZ + 0.015 - fl * 0.035 + 0.02 * hash11(fl + 70.0);
    float y = y0 + 0.012 * sin(p.x * (3.0 + fl) + fl * 2.0);
    float dir = hash11(fl + 71.0) < 0.5 ? -1.0 : 1.0;
    float spacing = 0.022 + 0.006 * fl;
    float speed = (0.02 + 0.015 * fl) * dir;
    float u = (p.x - t * speed) / spacing;
    float id = floor(u);
    float f = fract(u) - 0.5;
    if (hash11(id + fl * 11.0) < 0.35) continue;
    float size = px * (1.2 + fl * 0.5);
    float dy = (p.y - y - (hash11(id + 3.0) - 0.5) * 0.006) / size;
    float dx = f * spacing / size;
    // Trail extends behind the direction of travel.
    float behind = -dx * dir;
    float trail = exp(-dy * dy) * smoothstep(0.0, 1.0, behind) * exp(-behind / (6.0 + fl * 3.0));
    float head = exp(-(dx * dx + dy * dy) * 0.8);
    vec3 col = vec3(1.0, 0.95, 0.85) * head * 1.4 + vec3(1.0, 0.15, 0.2) * trail * 0.7;
    if (hash11(id + 9.0) > 0.8) col = col.bgr * vec3(1.0, 0.9, 1.0);   // the odd neon-blue car
    sum += col * (1.0 - depth * 0.5);
    }
    return sum;
}

// A holographic koi drifting through the towers.
vec3 koi(vec2 p, float t) {
    vec2 c = vec2(0.03 + 0.10 * sin(t * 0.07), HZ + 0.12 + 0.03 * sin(t * 0.11));
    float ang = 0.25 * sin(t * 0.07 + 1.57) + 3.14159 * step(0.0, cos(t * 0.07));
    vec2 q = p - c;
    q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * q;
    q /= 0.09;
    // Body bends with a travelling wave.
    q.y += 0.12 * sin(q.x * 4.0 + t * 3.0) * smoothstep(-0.2, 0.9, q.x);
    float body = length(q * vec2(1.0, 2.6)) - 0.35;
    body = min(body, length((q - vec2(0.42, 0.0)) * vec2(1.0, 4.0)) - 0.25);
    // Tail fan.
    vec2 tq = q - vec2(0.62, 0.0);
    float lobe1 = length((tq - vec2(0.12, 0.09)) * vec2(1.4, 2.2)) - 0.17;
    float lobe2 = length((tq - vec2(0.12, -0.09)) * vec2(1.4, 2.2)) - 0.17;
    float tail = min(lobe1, lobe2);
    // Side fins.
    float fin = length((q - vec2(-0.05, 0.16)) * vec2(2.5, 1.2)) - 0.12;
    fin = min(fin, length((q - vec2(-0.05, -0.16)) * vec2(2.5, 1.2)) - 0.12);
    float d = min(min(body, tail), fin);
    float edge = smoothstep(0.03, 0.0, abs(d));
    float fill = smoothstep(0.01, -0.01, d);
    vec3 col = vec3(0.20, 0.95, 1.0) * (edge * 1.2 + fill * 0.18);
    // Scales and koi spots.
    float spots = smoothstep(0.55, 0.7, noise(q * 4.0 + 3.0)) * fill;
    col += vec3(1.0, 0.35, 0.55) * spots * 0.5;
    col += vec3(0.4, 1.0, 1.0) * fill * step(0.5, fract(q.y * 18.0)) * 0.08;
    col *= 0.85 + 0.15 * step(0.5, fract(p.y * 500.0));                    // hologram scanlines
    col *= 0.7 + 0.3 * step(0.06, noise(vec2(t * 8.0, 5.0)));             // flicker
    col += vec3(0.2, 0.9, 1.0) * exp(-max(d, 0.0) * 6.0) * 0.10;           // glow
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float t = iTime;
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float px = 1.0 / iResolution.y;

    // Composite front to back so we can stop as soon as the near towers hide everything behind.
    vec3 col = vec3(0.0);
    float rem = 1.0;                                   // how much of what lies behind still shows
    float hazeA = 0.03 * smoothstep(HZ, HZ - 0.4, p.y);
    vec3 haze = hazeColor(p.y);
    for (int i = LAYERS - 1; i >= 0; i--) {
        // Haze between layers, thicker near the street far below.
        col += rem * hazeA * haze;
        rem *= 1.0 - hazeA;
        col += rem * traffic(p, i, t, px);
        if (i == 2) col += rem * koi(p, t);
        vec4 tw = towers(p, i, t, px);
        if (i == 1) col += rem * beams(p, t) * (1.0 - tw.a * 0.7);
        col += rem * tw.a * tw.rgb;
        rem *= 1.0 - tw.a;
        if (rem < 0.004) break;
    }
    if (rem > 0.0) col += rem * sky(p, t);

    // Glow rising from the streets at the bottom.
    col += vec3(0.6, 0.15, 0.45) * smoothstep(-0.2, -0.5, p.y) * 0.25;

    col = col / (1.0 + col * 0.35) * 1.15;
    col *= 1.0 - 0.3 * dot(p * vec2(1.5, 0.9), p * vec2(1.5, 0.9));
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
