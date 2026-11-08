/* people.js: procedural, fully animated low-poly people (no model files).
   Each person is a jointed figure: hips, torso, head, two-segment arms and legs.
   Poses are blended from state values: walk, sit, talk, wave, type. */
(function () {
  var SO = (window.SO = window.SO || {});
  var T = THREE;

  function mat(c, r) { return new T.MeshStandardMaterial({ color: c, roughness: r == null ? 0.75 : r, metalness: 0 }); }
  function cyl(rt, rb, h, seg) { return new T.CylinderGeometry(rt, rb, h, seg || 10); }
  function sph(r, w, h) { return new T.SphereGeometry(r, w || 12, h || 10); }
  function mesh(g, m, x, y, z, parent) {
    var o = new T.Mesh(g, m);
    o.position.set(x || 0, y || 0, z || 0);
    o.castShadow = true;
    if (parent) parent.add(o);
    return o;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function damp(a, b, k, dt) { return a + (b - a) * (1 - Math.exp(-k * dt)); }

  /* a limb = shoulder/hip group, upper segment, joint group, lower segment, end piece */
  function limb(parent, px, py, pz, len1, len2, r1, r2, mUp, mLow, endMesh) {
    var up = new T.Group();
    up.position.set(px, py, pz);
    parent.add(up);
    mesh(cyl(r1, r1 * 0.9, len1, 10), mUp, 0, -len1 / 2, 0, up);
    mesh(sph(r1 * 1.02, 10, 8), mUp, 0, 0, 0, up);
    var lo = new T.Group();
    lo.position.y = -len1;
    up.add(lo);
    mesh(sph(r1 * 0.92, 10, 8), mLow, 0, 0, 0, lo);
    mesh(cyl(r2, r2 * 0.85, len2, 10), mLow, 0, -len2 / 2, 0, lo);
    if (endMesh) { endMesh.position.y = -len2; lo.add(endMesh); }
    return { up: up, lo: lo };
  }

  SO.makePerson = function (o) {
    o = Object.assign({
      name: '', skin: 0xd8a27a, shirt: 0x2a9d8f, pants: 0x2b2d42, hair: 0x1b1b1b, hairStyle: 'short',
      shoes: 0x1a1a1a, scale: 0.96, coat: false, glasses: false, beard: false
    }, o || {});
    var root = new T.Group();
    var sk = mat(o.skin, 0.6), sh = mat(o.shirt, 0.8), pa = mat(o.pants, 0.85), ha = mat(o.hair, 0.9), shoe = mat(o.shoes, 0.7);
    var skHands = sk;

    var hips = new T.Group();
    hips.position.y = 0.92;
    root.add(hips);
    var pel = mesh(sph(0.19, 12, 10), pa, 0, 0, 0, hips);
    pel.scale.set(1.05, 0.7, 0.8);

    var torso = new T.Group();
    hips.add(torso);
    mesh(cyl(0.2, 0.17, 0.52, 14), sh, 0, 0.28, 0, torso);
    var shoulders = mesh(sph(0.2, 14, 10), sh, 0, 0.54, 0, torso);
    shoulders.scale.set(1.08, 0.55, 0.8);
    if (o.coat) {
      var coat = mesh(cyl(0.215, 0.24, 0.6, 14), mat(0xf4f4f2, 0.9), 0, 0.14, 0, torso);
      coat.scale.set(1, 1, 0.86);
    }
    mesh(cyl(0.05, 0.055, 0.1, 8), sk, 0, 0.62, 0, torso);

    var head = new T.Group();
    head.position.y = 0.74;
    torso.add(head);
    var skull = mesh(sph(0.15, 18, 14), sk, 0, 0.07, 0, head);
    skull.scale.set(1, 1.06, 1);
    var eyeM = mat(0x16130f, 0.4);
    mesh(sph(0.018, 8, 6), eyeM, 0.055, 0.09, 0.135, head);
    mesh(sph(0.018, 8, 6), eyeM, -0.055, 0.09, 0.135, head);
    var smile = mesh(new T.TorusGeometry(0.035, 0.007, 6, 12, Math.PI), mat(0x7a2e2e, 0.6), 0, 0.02, 0.143, head);
    smile.rotation.z = Math.PI;
    smile.castShadow = false;
    mesh(sph(0.02, 8, 6), sk, 0, 0.055, 0.15, head); // nose

    function cap(rad, tl, sy, oy, oz) {
      var g = new T.SphereGeometry(rad, 16, 12, 0, Math.PI * 2, 0, tl);
      var m = mesh(g, ha, 0, oy, oz, head);
      m.scale.set(1, sy, 1);
      return m;
    }
    if (o.hairStyle === 'short') { cap(0.158, Math.PI * 0.58, 1.05, 0.09, -0.005); }
    else if (o.hairStyle === 'long') {
      cap(0.16, Math.PI * 0.62, 1.05, 0.09, -0.008);
      var back = mesh(cyl(0.15, 0.1, 0.34, 12), ha, 0, -0.05, -0.07, head);
      back.scale.set(1, 1, 0.7);
    } else if (o.hairStyle === 'bun') {
      cap(0.158, Math.PI * 0.6, 1.05, 0.09, -0.01);
      mesh(sph(0.065, 10, 8), ha, 0, 0.25, -0.07, head);
    } else if (o.hairStyle === 'curly') {
      cap(0.17, Math.PI * 0.6, 1.1, 0.09, -0.01);
      for (var i = 0; i < 7; i++) { var a = (i / 7) * 6.28; mesh(sph(0.045, 8, 6), ha, Math.cos(a) * 0.12, 0.16, Math.sin(a) * 0.12 - 0.02, head); }
    }
    if (o.beard) {
      var bd = new T.SphereGeometry(0.152, 16, 12, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.3);
      var bm = mesh(bd, ha, 0, 0.07, 0.012, head);
      bm.scale.set(1, 1.05, 1.02);
    }
    if (o.glasses) {
      var gm = mat(0x111111, 0.4);
      [-0.055, 0.055].forEach(function (x) {
        var r = mesh(new T.TorusGeometry(0.036, 0.005, 6, 14), gm, x, 0.09, 0.14, head);
        r.castShadow = false;
      });
    }

    var armL = limb(torso, 0.255, 0.52, 0, 0.3, 0.27, 0.057, 0.047, sh, sk, mesh(sph(0.055, 10, 8), skHands, 0, 0, 0));
    var armR = limb(torso, -0.255, 0.52, 0, 0.3, 0.27, 0.057, 0.047, sh, sk, mesh(sph(0.055, 10, 8), skHands, 0, 0, 0));

    function foot() {
      var f = new T.Mesh(new T.BoxGeometry(0.11, 0.07, 0.27), shoe);
      f.castShadow = true;
      f.position.z = 0.05;
      var g = new T.Group();
      g.add(f);
      return g;
    }
    var legL = limb(hips, 0.105, -0.02, 0, 0.45, 0.43, 0.085, 0.065, pa, pa, foot());
    var legR = limb(hips, -0.105, -0.02, 0, 0.45, 0.43, 0.085, 0.065, pa, pa, foot());
    legL.lo.children[legL.lo.children.length - 1].position.y = -0.43 - 0.03;
    legR.lo.children[legR.lo.children.length - 1].position.y = -0.43 - 0.03;

    root.scale.setScalar(o.scale);

    var p = {
      name: o.name,
      group: root,
      st: { walk: 0, phase: Math.random() * 6, sit: 0, talk: 0, wave: 0, type: 0, look: 0, lookP: 0, sitTarget: 0 },
      _h: 0, _hp: 0, _seed: Math.random() * 10,
      j: { hips: hips, torso: torso, head: head, armL: armL, armR: armR, legL: legL, legR: legR }
    };

    p.update = function (dt, t) {
      var st = p.st, j = p.j, ph = st.phase, w = st.walk, s = st.sit, tk = st.talk, wv = st.wave, ty = st.type;
      var sP = Math.sin(ph), cP = Math.cos(ph), seed = p._seed;

      /* ---- standing pose (walk cycle + idle + talk + wave) ---- */
      var thL = -0.64 * sP * w, thR = 0.64 * sP * w;
      var knL = w * (0.1 + 0.9 * Math.max(0, cP)), knR = w * (0.1 + 0.9 * Math.max(0, -cP));
      var idleSway = Math.sin(t * 1.3 + seed) * 0.02 * (1 - w);
      var arL = 0.58 * sP * w + idleSway;
      var arR = -0.58 * sP * w - idleSway;
      var elL = -(0.1 + 0.28 * Math.max(0, -sP)) * w - 0.08 * (1 - w);
      var elR = -(0.1 + 0.28 * Math.max(0, sP)) * w - 0.08 * (1 - w);
      var armRz = 0, armLz = 0, elRz = 0;
      var gest = tk * (1 - wv);
      arR = lerp(arR, -0.85 + 0.32 * Math.sin(t * 3.1 + seed), gest * 0.9);
      elR = lerp(elR, -1.05 + 0.38 * Math.sin(t * 4.3 + 1 + seed), gest * 0.9);
      arL = lerp(arL, -0.3 + 0.18 * Math.sin(t * 2.3 + 2 + seed), gest * 0.6);
      elL = lerp(elL, -0.6 + 0.25 * Math.sin(t * 3.4 + seed), gest * 0.6);
      arR = lerp(arR, 0, wv);
      armRz = -2.25 * wv;
      elR = lerp(elR, -0.1, wv);
      elRz = 0.5 * Math.sin(t * 9) * wv;

      /* ---- sitting pose (typing / seated talk) ---- */
      var sThL = -1.52, sThR = -1.52, sKnL = 1.5, sKnR = 1.5;
      var tj = Math.sin(t * 15 + seed) * 0.05 * ty, tj2 = Math.sin(t * 13 + 1 + seed) * 0.05 * ty;
      var sArL = -0.62 + tj, sArR = -0.62 + tj2, sElL = -1.2 + tj2 * 1.5, sElR = -1.2 + tj * 1.5;
      sArR = lerp(sArR, -0.95 + 0.3 * Math.sin(t * 3 + seed), tk * (1 - ty));
      sElR = lerp(sElR, -1.1 + 0.35 * Math.sin(t * 4 + seed), tk * (1 - ty));

      var thLf = lerp(thL, sThL, s), thRf = lerp(thR, sThR, s);
      j.legL.up.rotation.x = thLf; j.legR.up.rotation.x = thRf;
      j.legL.lo.rotation.x = lerp(knL, sKnL, s); j.legR.lo.rotation.x = lerp(knR, sKnR, s);
      j.legL.up.rotation.z = 0.02 * s; j.legR.up.rotation.z = -0.02 * s;

      j.armL.up.rotation.x = lerp(arL, sArL, s); j.armR.up.rotation.x = lerp(arR, sArR, s);
      j.armL.lo.rotation.x = lerp(elL, sElL, s); j.armR.lo.rotation.x = lerp(elR, sElR, s);
      j.armR.up.rotation.z = armRz; j.armR.lo.rotation.z = elRz;
      j.armL.up.rotation.z = lerp(0.04 + 0.03 * w, 0.1, s); j.armL.lo.rotation.z = 0;
      if (wv < 0.02) j.armR.up.rotation.z = lerp(-0.04 - 0.03 * w, -0.1, s);

      /* body */
      var bob = 0.035 * (Math.abs(cP) - 0.5) * w;
      j.hips.position.y = lerp(0.92 + bob, 0.52, s);
      j.hips.position.x = 0.02 * sP * w;
      j.torso.rotation.y = 0.15 * sP * w + 0.05 * Math.sin(t * 0.7 + seed) * (1 - w) * tk;
      j.torso.rotation.x = lerp(0.05 * w, 0.0 - 0.06 * ty, s);
      j.torso.scale.y = 1 + 0.012 * Math.sin(t * 1.9 + seed);

      /* head: smooth look-at plus talk nods */
      p._h = damp(p._h, Math.max(-1.0, Math.min(1.0, st.look)), 5, dt);
      p._hp = damp(p._hp, st.lookP, 5, dt);
      j.head.rotation.y = p._h - j.torso.rotation.y * 0.8 + 0.05 * Math.sin(t * 0.9 + seed) * (1 - tk);
      j.head.rotation.x = p._hp + 0.07 * Math.sin(t * 4.6 + seed) * tk + 0.03 * Math.sin(t * 1.1 + seed) - 0.06 * ty * s;
    };

    return p;
  };
})();
