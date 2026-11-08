/* office.js: builds the 3D office (rooms, walls, sliding doors, furniture, boards).
   Coordinates in metres: x east, z south. Everything is procedural. */
(function () {
  var SO = (window.SO = window.SO || {});
  var T = THREE;
  var FONT = '"Fredoka","Nunito","Trebuchet MS",Verdana,sans-serif';
  var WH = 3.1, WT = 0.22, DH = 2.5;

  var mats = {};
  function mm(c, r, m) {
    var k = c + '|' + (r == null ? 0.8 : r) + '|' + (m || 0);
    return mats[k] || (mats[k] = new T.MeshStandardMaterial({ color: c, roughness: r == null ? 0.8 : r, metalness: m || 0 }));
  }
  function box(p, w, h, d, c, x, y, z, o) {
    o = o || {};
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), o.mat || mm(c, o.r, o.m));
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = !o.ns; m.receiveShadow = true;
    p.add(m);
    return m;
  }
  function cylm(p, rt, rb, h, c, x, y, z, o) {
    o = o || {};
    var m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, o.seg || 14), o.mat || mm(c, o.r, o.m));
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = !o.ns; m.receiveShadow = true;
    p.add(m);
    return m;
  }
  function sphm(p, r, c, x, y, z, o) {
    o = o || {};
    var m = new T.Mesh(new T.SphereGeometry(r, 14, 10), o.mat || mm(c, o.r));
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = !o.ns; m.receiveShadow = true;
    if (o.sy) m.scale.y = o.sy;
    p.add(m);
    return m;
  }
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function ctex(c, rep) {
    var t = new T.CanvasTexture(c);
    t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; }
    return t;
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function wrapText(g, text, x, y, maxW, lh) {
    var words = text.split(' '), line = '';
    for (var i = 0; i < words.length; i++) {
      var t = line + words[i] + ' ';
      if (g.measureText(t).width > maxW && i > 0) { g.fillText(line, x, y); line = words[i] + ' '; y += lh; } else line = t;
    }
    g.fillText(line, x, y);
    return y;
  }

  SO.labelSprite = function (title, sub) {
    var c = cv(512, 128), g = c.getContext('2d');
    g.font = '600 46px ' + FONT;
    var w = Math.max(g.measureText(title).width, sub ? g.measureText(sub).width * 0.7 : 0) + 56;
    g.clearRect(0, 0, 512, 128);
    rr(g, (512 - w) / 2, 14, w, 100, 50); g.fillStyle = 'rgba(255,255,255,.94)'; g.fill();
    g.textAlign = 'center'; g.fillStyle = '#25324a'; g.font = '600 46px ' + FONT;
    g.fillText(title, 256, sub ? 62 : 80);
    if (sub) { g.font = '500 30px ' + FONT; g.fillStyle = '#6b7a93'; g.fillText(sub, 256, 98); }
    var t = ctex(c);
    var s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    s.scale.set(2.1, 0.525, 1);
    return s;
  };

  SO.buildOffice = function (scene) {
    var W = { colliders: [], walls: [], doors: [], hot: [], blink: [], beacons: [], redraw: [], scroll: [], rooms: {}, slides: null };
    var root = new T.Group();
    scene.add(root);

    function col(cx, cz, w, d) { W.colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 }); }
    function labelPlane(text, w, h, bg, fg, font) {
      var c = cv(512, Math.round(512 * h / w)), g = c.getContext('2d');
      function draw() {
        g.clearRect(0, 0, c.width, c.height);
        rr(g, 4, 4, c.width - 8, c.height - 8, c.height * 0.28); g.fillStyle = bg; g.fill();
        g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
        var fs = Math.round(c.height * 0.5);
        g.font = (font || '600 ') + fs + 'px ' + FONT;
        while (g.measureText(text).width > c.width - 40 && fs > 12) { fs -= 2; g.font = (font || '600 ') + fs + 'px ' + FONT; }
        g.fillText(text, c.width / 2, c.height / 2 + 2);
        t.needsUpdate = true;
      }
      var t = ctex(c);
      draw(); W.redraw.push(draw);
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: t, transparent: true }));
      return m;
    }

    /* ---------- floors ---------- */
    function floorTex(kind, w, d) {
      var c = cv(256, 256), g = c.getContext('2d');
      if (kind === 'wood') {
        g.fillStyle = '#d6b184'; g.fillRect(0, 0, 256, 256);
        for (var i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#cfa878' : '#dcb98d'; g.fillRect(0, i * 32, 256, 31); g.fillStyle = 'rgba(80,50,20,.18)'; g.fillRect(0, i * 32 + 31, 256, 1.5); }
      } else if (kind === 'darkwood') {
        g.fillStyle = '#8a5a3a'; g.fillRect(0, 0, 256, 256);
        for (var j = 0; j < 8; j++) { g.fillStyle = j % 2 ? '#81533a' : '#93623f'; g.fillRect(0, j * 32, 256, 31); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, j * 32 + 31, 256, 1.5); }
      } else if (kind === 'tile') {
        g.fillStyle = '#eef3f6'; g.fillRect(0, 0, 256, 256);
        g.fillStyle = '#dfe8ee'; g.fillRect(0, 0, 128, 128); g.fillRect(128, 128, 128, 128);
        g.strokeStyle = 'rgba(120,140,160,.25)'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256);
      } else if (kind === 'carpet') {
        g.fillStyle = '#8fa9cc'; g.fillRect(0, 0, 256, 256);
        for (var k = 0; k < 500; k++) { g.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.07 + ')'; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 2); }
        g.fillStyle = 'rgba(40,70,120,.10)'; for (var q = 0; q < 256; q += 64) g.fillRect(q, 0, 2, 256);
      } else if (kind === 'lounge') {
        g.fillStyle = '#7cc7b4'; g.fillRect(0, 0, 256, 256);
        for (var n = 0; n < 400; n++) { g.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.08 + ')'; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 2); }
      } else if (kind === 'hall') {
        g.fillStyle = '#d7dbe0'; g.fillRect(0, 0, 256, 256);
        g.fillStyle = '#c7ccd3'; g.fillRect(0, 0, 128, 256);
        g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(126, 0, 4, 256);
      } else { g.fillStyle = '#c9c2b2'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(0,0,0,.1)'; g.strokeRect(0, 0, 256, 256); }
      var t = ctex(c, true); t.repeat.set(w / 3, d / 3);
      return t;
    }
    function floor(name, x1, z1, x2, z2, kind) {
      var w = x2 - x1, d = z2 - z1;
      var m = new T.Mesh(new T.BoxGeometry(w, 0.12, d), new T.MeshStandardMaterial({ map: floorTex(kind, w, d), roughness: 0.9 }));
      m.position.set((x1 + x2) / 2, -0.06, (z1 + z2) / 2);
      m.receiveShadow = true; root.add(m);
      if (name === 'outside') W.plazaMat = m.material;
      W.rooms[name] = { x1: x1, z1: z1, x2: x2, z2: z2 };
    }
    var ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshStandardMaterial({ color: 0x9fd27f, roughness: 1 }));
    W.ground = ground; ground.rotation.x = -Math.PI / 2; ground.position.y = -0.1; ground.receiveShadow = true; root.add(ground);
    floor('outside', -15, 18, 15, 38, 'plaza');
    floor('lobby', -15, 6, 15, 18, 'wood');
    floor('hall', -3, -14, 3, 6, 'hall');
    floor('work', -15, -4, -3, 6, 'carpet');
    floor('lab', -15, -14, -3, -4, 'tile');
    floor('meet', 3, -4, 15, 6, 'wood');
    floor('lounge', 3, -14, 15, -4, 'lounge');
    floor('owner', -6, -24, 6, -14, 'darkwood');

    /* ---------- walls and sliding doors ---------- */
    var glassMat = new T.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.38 });
    function addWallMesh(w, h, d, x, y, z, solid) {
      var mat = new T.MeshStandardMaterial({ color: 0xf3eee3, roughness: 0.95 });
      var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); m.receiveShadow = true; root.add(m);
      var b = new T.Box3().setFromObject(m); b.expandByScalar(0.12);
      W.walls.push({ mesh: m, mat: mat, box: b });
      if (solid) col(x, z, w, d);
      return m;
    }
    function wall(x1, z1, x2, z2, doors) {
      var horiz = z1 === z2;
      var a = horiz ? Math.min(x1, x2) : Math.min(z1, z2), b = horiz ? Math.max(x1, x2) : Math.max(z1, z2);
      var fixed = horiz ? z1 : x1, cur = a;
      function seg(s, e, y, h, solid) {
        var len = e - s, mid = (s + e) / 2;
        if (horiz) addWallMesh(len, h, WT, mid, y, fixed, solid); else addWallMesh(WT, h, len, fixed, y, mid, solid);
      }
      var cuts = (doors || []).slice().sort(function (p, q) { return p.c - q.c; });
      cuts.forEach(function (d) {
        if (d.c - d.w / 2 > cur) seg(cur, d.c - d.w / 2, WH / 2, WH, true);
        seg(d.c - d.w / 2, d.c + d.w / 2, DH + (WH - DH) / 2, WH - DH, false);
        makeDoor(d, horiz, fixed);
        cur = d.c + d.w / 2;
      });
      if (b > cur) seg(cur, b, WH / 2, WH, true);
    }
    function makeDoor(d, horiz, fixed) {
      var o = { horiz: horiz, w: d.w, open: 0, panels: [], x: horiz ? d.c : fixed, z: horiz ? fixed : d.c };
      var half = d.w / 2;
      for (var i = 0; i < 2; i++) {
        var g = new T.Group();
        var pm = new T.Mesh(new T.BoxGeometry(horiz ? half : 0.05, DH - 0.06, horiz ? 0.05 : half), glassMat);
        pm.position.y = (DH - 0.06) / 2 + 0.02; g.add(pm);
        var frame = mm(0x3b4660, 0.5, 0.3);
        var fh = new T.Mesh(new T.BoxGeometry(horiz ? half : 0.08, 0.06, horiz ? 0.08 : half), frame); fh.position.y = DH - 0.05; g.add(fh);
        var hd = new T.Mesh(new T.BoxGeometry(horiz ? 0.06 : 0.1, 0.9, horiz ? 0.1 : 0.06), frame);
        hd.position.set(horiz ? (i ? 0.24 : -0.24) * 0 + (i ? half / 2 - 0.05 : -half / 2 + 0.05) * -1 * 0 : 0, 1.0, 0); g.add(hd);
        o.panels.push(g); root.add(g);
      }
      var bar = box(root, horiz ? d.w + 0.1 : 0.14, 0.1, horiz ? 0.14 : d.w + 0.1, 0x3b4660, o.x, DH + 0.02, o.z, { m: 0.3, r: 0.5 });
      W.doors.push(o);
      if (d.name) {
        var lp = labelPlane(d.name, 2.2, 0.44, '#25324a', '#ffffff');
        lp.position.set(o.x, WH - 0.28, o.z);
        if (horiz) { lp.position.z += (d.face || 1) * (WT / 2 + 0.02); if ((d.face || 1) < 0) lp.rotation.y = Math.PI; }
        else { lp.position.x += (d.face || 1) * (WT / 2 + 0.02); lp.rotation.y = (d.face || 1) > 0 ? Math.PI / 2 : -Math.PI / 2; }
        root.add(lp);
      }
    }
    wall(-15, 18, 15, 18, [{ c: 0, w: 4 }]);
    wall(-15, -14, -15, 18);
    wall(15, -14, 15, 18);
    wall(-15, -14, 15, -14, [{ c: 0, w: 2.6, name: "NAGORI'S OFFICE", face: 1 }]);
    wall(-6, -24, -6, -14);
    wall(6, -24, 6, -14);
    wall(-6, -24, 6, -24);
    wall(-15, 6, 15, 6, [{ c: 0, w: 3, name: 'THE STUDIO', face: 1 }]);
    wall(-3, -14, -3, 6, [{ c: 1.5, w: 2.6, name: 'WORK FLOOR', face: 1 }, { c: -9.5, w: 2.6, name: 'RESEARCH LAB', face: 1 }]);
    wall(3, -14, 3, 6, [{ c: 1.5, w: 2.6, name: 'MEETING ROOM', face: -1 }, { c: -9.5, w: 2.6, name: 'COFFEE LOUNGE', face: -1 }]);
    wall(-15, -4, -3, -4);
    wall(3, -4, 15, -4);

    /* front sign: thin board on the outside of the front wall (fades with it) */
    (function () {
      var c = cv(1024, 160), g = c.getContext('2d');
      function draw() {
        g.clearRect(0, 0, 1024, 160); g.fillStyle = '#25324a'; g.fillRect(0, 0, 1024, 160);
        g.fillStyle = '#ffb703'; g.fillRect(0, 148, 1024, 12);
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '700 84px ' + FONT; g.fillText('SHAFIK STUDIO', 512, 66);
        g.font = '500 32px ' + FONT; g.fillStyle = '#a9c4ff'; g.fillText('Full-stack & applied AI engineering  ·  open for projects', 512, 122);
        t.needsUpdate = true;
      }
      var t = ctex(c); draw(); W.redraw.push(draw);
      var mat = new T.MeshStandardMaterial({ map: t, roughness: 0.8 });
      var m = new T.Mesh(new T.BoxGeometry(6.4, 1.0, 0.06), mat);
      m.position.set(-5.6, 1.9, 18 + WT / 2 + 0.03); root.add(m);
      var b = new T.Box3().setFromObject(m); b.expandByScalar(0.12);
      W.walls.push({ mesh: m, mat: mat, box: b });
    })();

    /* ---------- furniture builders ---------- */
    function plant(x, z, s) {
      var g = new T.Group(); g.position.set(x, 0, z); root.add(g);
      cylm(g, 0.28 * s, 0.22 * s, 0.4 * s, 0xd1895b, 0, 0.2 * s, 0);
      cylm(g, 0.26 * s, 0.26 * s, 0.03, 0x4a3426, 0, 0.4 * s, 0, { ns: true });
      var cs = [0x3fa34d, 0x56b85f, 0x2f8a40];
      for (var i = 0; i < 6; i++) { var a = i / 6 * 6.28; sphm(g, 0.22 * s, cs[i % 3], Math.cos(a) * 0.18 * s, (0.75 + (i % 2) * 0.2) * s, Math.sin(a) * 0.18 * s, { sy: 1.3 }); }
      sphm(g, 0.25 * s, 0x56b85f, 0, 1.1 * s, 0, { sy: 1.2 });
      col(x, z, 0.5 * s, 0.5 * s);
      return g;
    }
    function tree(x, z, s) {
      var g = new T.Group(); g.position.set(x, 0, z); root.add(g);
      cylm(g, 0.18 * s, 0.26 * s, 1.6 * s, 0x8a5f3b, 0, 0.8 * s, 0);
      sphm(g, 1.0 * s, 0x4caf50, 0, 2.2 * s, 0); sphm(g, 0.75 * s, 0x66bb6a, 0.5 * s, 2.8 * s, 0.2 * s); sphm(g, 0.7 * s, 0x43a047, -0.5 * s, 2.6 * s, -0.2 * s);
    }
    function chair(p, x, z, yaw, c) {
      var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; p.add(g);
      c = c || 0x2a3b5e;
      box(g, 0.5, 0.07, 0.5, c, 0, 0.42, 0);
      box(g, 0.5, 0.5, 0.06, c, 0, 0.76, -0.25);
      cylm(g, 0.04, 0.04, 0.4, 0x444c5c, 0, 0.23, 0, { m: 0.5 });
      for (var i = 0; i < 5; i++) { var a = i / 5 * 6.28; box(g, 0.28, 0.04, 0.05, 0x444c5c, Math.cos(a) * 0.14, 0.04, Math.sin(a) * 0.14).rotation.y = -a; }
      return g;
    }
    var codeTex = [];
    function makeCode(seed) {
      var c = cv(256, 512), g = c.getContext('2d');
      g.fillStyle = '#0f1724'; g.fillRect(0, 0, 256, 512);
      var cols = ['#7ee787', '#79c0ff', '#ffa657', '#d2a8ff', '#ff7b72', '#e6edf3'];
      var s = seed * 9301 + 49297;
      function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
      for (var y = 8; y < 512; y += 16) {
        var ind = Math.floor(rnd() * 3) * 16, x = 10 + ind;
        for (var k = 0; k < 1 + Math.floor(rnd() * 3); k++) {
          var w = 20 + rnd() * 60; g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.globalAlpha = 0.85; g.fillRect(x, y, w, 7); x += w + 8;
        }
      }
      var t = ctex(c, true); t.repeat.set(1, 0.5);
      W.scroll.push({ t: t, sp: 0.02 + (seed % 3) * 0.01, off: rnd() });
      return t;
    }
    function monitor(p, x, y, z, w, h, tx) {
      box(p, 0.06, 0.2, 0.06, 0x2d3342, x, y - h / 2 - 0.1, z);
      box(p, 0.28, 0.02, 0.18, 0x2d3342, x, y - h / 2 - 0.2, z);
      box(p, w, h, 0.04, 0x1b2030, x, y, z);
      var sc = new T.Mesh(new T.PlaneGeometry(w - 0.05, h - 0.05), new T.MeshBasicMaterial({ map: tx }));
      sc.position.set(x, y, z - 0.026); sc.rotation.y = Math.PI; p.add(sc);
    }
    /* a desk station: person sits at local origin, facing +z */
    function station(x, z, yaw, seed, o) {
      o = o || {};
      var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; root.add(g);
      box(g, 1.5, 0.05, 0.8, o.top || 0xe8d5b5, 0, 0.74, 0.95);
      [[-0.7, 0.6], [0.7, 0.6], [-0.7, 1.3], [0.7, 1.3]].forEach(function (p) { box(g, 0.05, 0.72, 0.05, 0x4b5365, p[0], 0.36, p[1]); });
      monitor(g, 0, 1.08, 1.2, 0.62, 0.38, makeCode(seed));
      if (o.dual) monitor(g, 0.66, 1.08, 1.2, 0.5, 0.34, makeCode(seed + 3));
      box(g, 0.4, 0.02, 0.14, 0x2d3342, 0, 0.78, 0.75);
      cylm(g, 0.04, 0.04, 0.08, 0xffffff, -0.6, 0.81, 0.7);
      chair(g, 0, 0, 0, o.chair);
      var cx = x + Math.sin(yaw) * 0.95, cz = z + Math.cos(yaw) * 0.95;
      var vert = Math.abs(Math.sin(yaw)) > 0.5;
      col(cx, cz, vert ? 0.8 : 1.5, vert ? 1.5 : 0.8);
      return g;
    }
    W.station = station;

    function sofa(x, z, yaw, w, c) {
      var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; root.add(g);
      c = c || 0xe76f51;
      box(g, w, 0.4, 0.9, c, 0, 0.25, 0);
      box(g, w, 0.55, 0.22, c, 0, 0.62, -0.34);
      box(g, 0.22, 0.55, 0.9, c, -w / 2 + 0.11, 0.5, 0); box(g, 0.22, 0.55, 0.9, c, w / 2 - 0.11, 0.5, 0);
      var n = Math.max(2, Math.round(w / 0.8));
      for (var i = 0; i < n; i++) box(g, (w - 0.44) / n - 0.03, 0.14, 0.62, 0xffffff * 0 + c + 0x151515, -((w - 0.44) / 2) + ((w - 0.44) / n) * (i + 0.5), 0.5, 0.08);
      var vert = Math.abs(Math.sin(yaw)) > 0.5;
      col(x, z, vert ? 0.9 : w, vert ? w : 0.9);
      return g;
    }
    function table(x, z, w, d, h, c) { var g = new T.Group(); g.position.set(x, 0, z); root.add(g); box(g, w, 0.06, d, c || 0xd9b98a, 0, h, 0); box(g, 0.08, h, d * 0.7, 0x4b5365, -w / 2 + 0.3, h / 2, 0); box(g, 0.08, h, d * 0.7, 0x4b5365, w / 2 - 0.3, h / 2, 0); col(x, z, w, d); return g; }
    function rug(x, z, w, d, c, rot) { var m = box(root, w, 0.02, d, c, x, 0.01, z, { ns: true }); m.rotation.y = rot || 0; return m; }
    function shelf(x, z, yaw, w, h) {
      var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; root.add(g);
      box(g, w, h, 0.35, 0x8d6a4a, 0, h / 2, 0);
      var cols = [0xe63946, 0x457b9d, 0xf4a261, 0x2a9d8f, 0xe9c46a, 0x6d597a];
      for (var r = 0; r < 4; r++) for (var i = 0; i < Math.floor(w / 0.16); i++) { if ((i + r) % 5 === 0) continue; box(g, 0.09, 0.3, 0.22, cols[(i * 3 + r) % cols.length], -w / 2 + 0.14 + i * 0.16, 0.38 + r * 0.42, 0.04, { ns: true }); }
      var vert = Math.abs(Math.sin(yaw)) > 0.5; col(x, z, vert ? 0.4 : w, vert ? w : 0.4);
    }
    function hot(obj, info) { obj.userData.hot = info; W.hot.push(obj); }
    function beacon(x, y, z, info) {
      var g = new T.Group(); g.position.set(x, y, z);
      var m = new T.Mesh(new T.OctahedronGeometry(0.13), new T.MeshBasicMaterial({ color: 0xffc233 }));
      var ring = new T.Mesh(new T.RingGeometry(0.2, 0.25, 24), new T.MeshBasicMaterial({ color: 0xffc233, transparent: true, opacity: 0.6, side: T.DoubleSide }));
      ring.rotation.x = -Math.PI / 2.4;
      g.add(m); g.add(ring); root.add(g);
      m.userData.hot = info; W.hot.push(m);
      W.beacons.push({ g: g, y: y, ring: ring, ph: Math.random() * 6 });
    }

    /* ---------- OUTSIDE ---------- */
    var outStart = root.children.length;
    (function () {
      box(root, 3.2, 0.03, 20, 0xcfc6b5, 0, 0.015, 28, { ns: true });
      for (var i = 0; i < 8; i++) { box(root, 0.5, 0.035, 0.12, 0xffffff, 0, 0.02, 20.5 + i * 2.2, { ns: true }); }
      [[-9, 21], [9, 21], [-12, 29], [12, 29], [-7, 35], [8, 36], [-13, 36], [13, 24]].forEach(function (p) { tree(p[0], p[1], 0.9 + (p[0] % 3) * 0.08); });
      [[-3.2, 20], [3.2, 20]].forEach(function (p) { plant(p[0], p[1], 1.3); });
      // bench
      var b = new T.Group(); b.position.set(7, 0, 27); root.add(b);
      box(b, 1.6, 0.08, 0.5, 0x8a5f3b, 0, 0.45, 0); box(b, 1.6, 0.5, 0.06, 0x8a5f3b, 0, 0.8, -0.22); box(b, 0.08, 0.45, 0.4, 0x3b4660, -0.7, 0.22, 0); box(b, 0.08, 0.45, 0.4, 0x3b4660, 0.7, 0.22, 0);
      // lamp posts
      [[-2.4, 24], [2.4, 24], [-2.4, 31], [2.4, 31]].forEach(function (p) {
        cylm(root, 0.05, 0.06, 2.6, 0x3b4660, p[0], 1.3, p[1]);
        sphm(root, 0.18, 0xfff1b8, p[0], 2.7, p[1], { mat: new T.MeshBasicMaterial({ color: 0xfff1b8 }) });
      });
      // welcome sign
      var s = labelPlane('Welcome in!', 2.4, 0.6, '#ffb703', '#25324a');
      s.position.set(-5, 1.15, 25); root.add(s);
      cylm(root, 0.05, 0.05, 1.1, 0x3b4660, -5.9, 0.55, 25); cylm(root, 0.05, 0.05, 1.1, 0x3b4660, -4.1, 0.55, 25);
      col(-5, 25, 2.4, 0.3);
    })();

    W.outMats = [];
    root.children.slice(outStart).forEach(function (ch) {
      ch.traverse(function (m) {
        if (m.isMesh && m.material && m.material.isMeshStandardMaterial) { m.material = m.material.clone(); W.outMats.push({ mat: m.material, c: m.material.color.clone() }); }
      });
    });

    /* ---------- LOBBY / RECEPTION ---------- */
    (function () {
      rug(0, 14.2, 7, 4.2, 0x3d5a80);
      rug(0, 14.2, 6.4, 3.6, 0x4f77a8);
      // reception desk
      var g = new T.Group(); g.position.set(0, 0, 11.4); root.add(g);
      box(g, 4.4, 1.05, 0.9, 0xf2e9dc, 0, 0.52, 0);
      box(g, 4.5, 0.07, 1.0, 0x25324a, 0, 1.07, 0.03);
      box(g, 3.2, 0.7, 0.04, 0xffb703, 0, 0.55, 0.47, { ns: true });
      var lg = labelPlane('SHAFIK STUDIO', 2.6, 0.5, '#25324a', '#ffffff'); lg.position.set(0, 0.55, 0.5); g.add(lg);
      box(g, 0.5, 0.04, 0.3, 0x2d3342, 1.4, 1.12, 0);
      var bell = cylm(g, 0.1, 0.12, 0.06, 0xffc233, -1.5, 1.14, 0.15, { m: 0.6, r: 0.3 });
      var bs = sphm(g, 0.08, 0xffc233, -1.5, 1.17, 0.15, { sy: 0.7, r: 0.3 });
      var mon = new T.Group(); mon.position.set(0.3, 0, -0.05); g.add(mon);
      monitor(mon, 0, 1.45, 0, 0.55, 0.34, makeCode(11));
      col(0, 11.4, 4.6, 1.0);
      // back wall panel with logo ring behind receptionist
      var back = labelPlane('Hi there. How can we help?', 3.6, 0.6, 'rgba(255,255,255,0.85)', '#25324a');
      back.position.set(-6.5, 2.0, 6.15); root.add(back);
      // sofa area
      sofa(-10.5, 15.2, Math.PI / 2, 3, 0xe76f51);
      sofa(-8.2, 9.2, 0, 2.2, 0x2a9d8f);
      table(-8.2, 13.6, 1.2, 0.8, 0.42, 0xe9d8b8);
      sofa(10.5, 15.2, -Math.PI / 2, 3, 0x457b9d);
      table(8.2, 12.5, 1.1, 0.7, 0.42, 0xe9d8b8);
      plant(-13.6, 7.2, 1.3); plant(13.6, 7.2, 1.3); plant(-13.6, 16.8, 1.2); plant(13.6, 16.8, 1.2); plant(5.5, 7.3, 1);
      // frames on the wall
      var fr = [['Clean code', '#f4a261'], ['Ship it', '#2a9d8f'], ['AI + ML', '#6d597a']];
      fr.forEach(function (f, i) { var p = labelPlane(f[0], 1.5, 0.9, f[1], '#ffffff'); p.position.set(6.4 + i * 2.7, 1.9, 6.15); root.add(p); });
      // plaque of availability
      var av = labelPlane('Open for freelance + remote team work', 3.4, 0.5, '#2a9d8f', '#ffffff');
      av.position.set(-12, 2.0, 17.88); av.rotation.y = Math.PI; root.add(av);
      // glass table lamps
      [-11.5, 11.5].forEach(function (x) { cylm(root, 0.03, 0.03, 1.5, 0x3b4660, x, 0.75, 8.2); sphm(root, 0.2, 0xfff1b8, x, 1.6, 8.2, { mat: new T.MeshBasicMaterial({ color: 0xfff1b8 }) }); });
    })();

    /* ---------- HALL ---------- */
    (function () {
      rug(0, -4, 2, 17, 0x6d8bb0);
      plant(-2.3, -2.3, 0.9); plant(2.3, 5.2, 0.9); plant(-2.3, 5.2, 0.9); plant(2.3, -12.8, 0.9); plant(-2.3, -12.8, 0.9);
      cylm(root, 0.04, 0.04, 2.0, 0x3b4660, -2.7, 1.0, -4.5);
    })();

    /* ---------- WORK FLOOR ---------- */
    (function () {
      var projects = [
        { x: -5.9, key: 'erp', title: 'ERP & Stock Platform', sub: 'Enterprise data platform', c1: '#183a5c', c2: '#2a6f97', chips: ['Angular', 'Node.js', 'Express', 'MySQL'], art: 'erp' },
        { x: -9.2, key: 'safety', title: "Women's Safety Alerts", sub: 'Emergency response core', c1: '#5c1a2b', c2: '#c0392b', chips: ['SMS API', 'Live location', 'Real-time'], art: 'safety' },
        { x: -12.5, key: 'movie', title: 'MovieDB · MERN', sub: 'Full-stack catalogue app', c1: '#2d2250', c2: '#6c4ab6', chips: ['MongoDB', 'Express', 'React', 'Node.js'], art: 'movie' }
      ];
      function art(g, kind, W0, H0) {
        g.save();
        if (kind === 'erp') {
          var cols = ['#ffb703', '#8ecae6', '#90e0a0', '#ffb703', '#8ecae6', '#90e0a0'], hs = [90, 150, 120, 200, 170, 230];
          for (var i = 0; i < 6; i++) { g.fillStyle = cols[i]; rr(g, 560 + i * 62, 360 - hs[i], 44, hs[i], 8); g.fill(); }
          g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.beginPath(); g.moveTo(560, 250); g.lineTo(650, 210); g.lineTo(740, 240); g.lineTo(850, 150); g.lineTo(930, 120); g.stroke();
          ['Angular', 'API', 'MySQL'].forEach(function (n, i) { g.fillStyle = 'rgba(255,255,255,.14)'; rr(g, 70 + i * 160, 300, 140, 64, 14); g.fill(); g.fillStyle = '#fff'; g.font = '600 26px ' + FONT; g.textAlign = 'center'; g.fillText(n, 140 + i * 160, 340); if (i < 2) { g.fillStyle = '#ffb703'; g.fillText('⇄', 222 + i * 160, 340); } });
        } else if (kind === 'safety') {
          g.fillStyle = 'rgba(255,255,255,.12)'; rr(g, 700, 90, 170, 300, 26); g.fill();
          g.strokeStyle = '#fff'; g.lineWidth = 5; rr(g, 700, 90, 170, 300, 26); g.stroke();
          g.fillStyle = '#ff4d4d'; g.beginPath(); g.arc(785, 250, 52, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '700 38px ' + FONT; g.textAlign = 'center'; g.fillText('SOS', 785, 263);
          for (var r = 1; r < 4; r++) { g.strokeStyle = 'rgba(255,255,255,' + (0.5 - r * 0.1) + ')'; g.lineWidth = 4; g.beginPath(); g.arc(785, 250, 52 + r * 32, 0, 7); g.stroke(); }
          g.fillStyle = '#ffd166'; g.beginPath(); g.arc(560, 170, 26, 0, 7); g.fill(); g.beginPath(); g.moveTo(540, 185); g.lineTo(560, 230); g.lineTo(580, 185); g.fill();
          g.fillStyle = '#fff'; g.font = '600 26px ' + FONT; g.textAlign = 'left'; g.fillText('Police + family', 480, 300); g.fillText('SMS with live location', 480, 336);
        } else if (kind === 'movie') {
          var pc = ['#ff6b6b', '#ffd166', '#4ecdc4', '#a29bfe', '#74b9ff', '#fd79a8'];
          for (var k = 0; k < 6; k++) { var px = 520 + (k % 3) * 150, py = 110 + Math.floor(k / 3) * 170; g.fillStyle = pc[k]; rr(g, px, py, 125, 150, 12); g.fill(); g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '700 22px ' + FONT; g.textAlign = 'center'; g.fillText('★ 8.' + (k + 1), px + 62, py + 135); g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(px + 62, py + 60, 26, 0, 7); g.fill(); }
        }
        g.restore();
      }
      projects.forEach(function (p, idx) {
        var c = cv(1024, 640), g = c.getContext('2d');
        function draw() {
          var gr = g.createLinearGradient(0, 0, 1024, 640); gr.addColorStop(0, p.c1); gr.addColorStop(1, p.c2);
          g.fillStyle = gr; g.fillRect(0, 0, 1024, 640);
          g.fillStyle = 'rgba(255,255,255,.07)'; for (var i = 0; i < 12; i++) g.fillRect(0, 20 + i * 54, 1024, 2);
          g.fillStyle = '#ffd166'; g.font = '600 30px ' + FONT; g.textAlign = 'left'; g.fillText(p.sub.toUpperCase(), 56, 84);
          g.fillStyle = '#fff'; g.font = '700 60px ' + FONT; g.fillText(p.title, 56, 154);
          art(g, p.art, 1024, 640);
          var x = 56; g.font = '600 26px ' + FONT;
          p.chips.forEach(function (ch) { var w = g.measureText(ch).width + 36; g.fillStyle = 'rgba(255,255,255,.18)'; rr(g, x, 520, w, 54, 27); g.fill(); g.fillStyle = '#fff'; g.fillText(ch, x + 18, 556); x += w + 12; });
          t.needsUpdate = true;
        }
        var t = ctex(c); draw(); W.redraw.push(draw);
        var bd = new T.Group(); bd.position.set(p.x, 1.85, -3.8); root.add(bd);
        box(bd, 2.9, 1.9, 0.08, 0x1b2030, 0, 0, 0);
        var sc = new T.Mesh(new T.PlaneGeometry(2.76, 1.72), new T.MeshBasicMaterial({ map: t })); sc.position.z = 0.05; bd.add(sc);
        hot(sc, { id: p.key });
        beacon(p.x, 3.25, -3.5, { id: p.key });
        // little pedestal
        box(root, 0.5, 0.05, 0.5, 0x25324a, p.x, 0.03, -3.0, { ns: true });
      });
      // two rows of desks facing north toward the boards (people sit facing -z)
      var xs = [-13, -10.5, -8];
      xs.forEach(function (x, i) { station(x, 2.5, Math.PI, 20 + i, { chair: 0x2a9d8f }); station(x, 5.3, Math.PI, 30 + i, { chair: 0xf4a261, dual: i === 1 }); });
      plant(-14, -2.4, 1.1); plant(-14, 5.3, 1.1); plant(-3.9, 5.2, 1);
      shelf(-3.5, -2.4, -Math.PI / 2, 1.6, 2.0);
      // sticky-note wall
      var sw = labelPlane('Sprint board · ship weekly', 2.4, 0.5, '#fff3b0', '#5a4a00'); sw.position.set(-3.14, 2.3, 4.5); sw.rotation.y = -Math.PI / 2; root.add(sw);
    })();

    /* ---------- LAB ---------- */
    (function () {
      // causal DAG whiteboard
      var c = cv(1280, 640), g = c.getContext('2d');
      function draw() {
        g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, 1280, 640);
        g.fillStyle = '#25324a'; g.font = '700 46px ' + FONT; g.textAlign = 'left'; g.fillText('Causal AI · credit risk', 40, 70);
        g.font = '500 26px ' + FONT; g.fillStyle = '#6b7a93'; g.fillText('LogReg vs Random Forest vs Gradient Boosting, then counterfactual fairness', 40, 112);
        var N = { age: [220, 280], inc: [220, 480], hist: [520, 380], emp: [520, 190], risk: [860, 290], dec: [1090, 440], prot: [1090, 170] };
        var lab = { age: 'Age', inc: 'Income', hist: 'Credit history', emp: 'Employment', risk: 'Default risk', dec: 'Approval', prot: 'Protected attribute' };
        var E = [['age', 'hist'], ['inc', 'hist'], ['emp', 'hist'], ['hist', 'risk'], ['emp', 'risk'], ['risk', 'dec'], ['prot', 'dec']];
        E.forEach(function (e, i) {
          var a = N[e[0]], b = N[e[1]], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          var sx = a[0] + Math.cos(ang) * 70, sy = a[1] + Math.sin(ang) * 40, ex = b[0] - Math.cos(ang) * 78, ey = b[1] - Math.sin(ang) * 46;
          g.strokeStyle = e[0] === 'prot' ? '#e63946' : '#457b9d'; g.lineWidth = 5; g.setLineDash(e[0] === 'prot' ? [14, 10] : []);
          g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);
          g.fillStyle = g.strokeStyle; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - Math.cos(ang - 0.4) * 20, ey - Math.sin(ang - 0.4) * 20); g.lineTo(ex - Math.cos(ang + 0.4) * 20, ey - Math.sin(ang + 0.4) * 20); g.fill();
        });
        Object.keys(N).forEach(function (k) {
          var p = N[k]; g.fillStyle = k === 'prot' ? '#ffe3e3' : (k === 'risk' || k === 'dec' ? '#fff0c2' : '#dff1ff');
          g.strokeStyle = '#25324a'; g.lineWidth = 4; g.beginPath(); g.ellipse(p[0], p[1], 78, 44, 0, 0, 7); g.fill(); g.stroke();
          g.fillStyle = '#25324a'; g.font = '600 24px ' + FONT; g.textAlign = 'center'; g.fillText(lab[k], p[0], p[1] + 8);
        });
        g.fillStyle = '#e63946'; g.font = '600 26px ' + FONT; g.textAlign = 'left'; g.fillText('What if this one thing changed?  (counterfactual)', 40, 600);
        t.needsUpdate = true;
      }
      var t = ctex(c); draw(); W.redraw.push(draw);
      var bd = new T.Group(); bd.position.set(-9, 1.85, -13.75); root.add(bd);
      box(bd, 5.3, 2.7, 0.08, 0xdfe5ea, 0, 0, 0, { m: 0.2 });
      var sc = new T.Mesh(new T.PlaneGeometry(5.1, 2.55), new T.MeshBasicMaterial({ map: t })); sc.position.z = 0.05; bd.add(sc);
      hot(sc, { id: 'causal' });
      beacon(-9, 3.45, -13.4, { id: 'causal' });
      // pipeline server racks along west wall
      var rackY = [];
      for (var i = 0; i < 4; i++) {
        var z = -12 + i * 1.6;
        var r = new T.Group(); r.position.set(-14.25, 0, z); root.add(r);
        box(r, 0.8, 2.1, 1.1, 0x222a38, 0, 1.05, 0, { m: 0.4, r: 0.5 });
        for (var u = 0; u < 7; u++) {
          box(r, 0.04, 0.16, 0.9, 0x151b27, 0.41, 0.35 + u * 0.26, 0, { ns: true });
          var led = new T.Mesh(new T.BoxGeometry(0.03, 0.05, 0.05), new T.MeshBasicMaterial({ color: 0x00ff88 }));
          led.position.set(0.44, 0.35 + u * 0.26, -0.3); r.add(led); W.blink.push({ m: led, ph: Math.random() * 20, sp: 2 + Math.random() * 5 });
          var led2 = led.clone(); led2.material = new T.MeshBasicMaterial({ color: 0xffa200 }); led2.position.z = -0.2; r.add(led2); W.blink.push({ m: led2, ph: Math.random() * 20, sp: 1 + Math.random() * 3 });
        }
        col(-14.25, z, 0.9, 1.15);
        r.children[0].userData.hot = { id: 'pipeline' }; W.hot.push(r.children[0]);
      }
      beacon(-14.0, 2.55, -9.6, { id: 'pipeline' });
      // pipeline poster
      var pc = cv(1024, 320), pg = pc.getContext('2d');
      function drawP() {
        pg.fillStyle = '#16233a'; pg.fillRect(0, 0, 1024, 320);
        pg.fillStyle = '#ffd166'; pg.font = '600 28px ' + FONT; pg.textAlign = 'left'; pg.fillText('DATA PIPELINE RESEARCH', 40, 54);
        var st = ['Messy records', 'ETL', 'Features', 'Hybrid ML model'];
        for (var s = 0; s < 4; s++) { var x = 40 + s * 245; pg.fillStyle = ['#e63946', '#457b9d', '#2a9d8f', '#ffb703'][s]; rr(pg, x, 100, 200, 120, 18); pg.fill(); pg.fillStyle = '#fff'; pg.font = '600 30px ' + FONT; pg.textAlign = 'center'; pg.fillText(st[s], x + 100, 170); if (s < 3) { pg.fillStyle = '#fff'; pg.fillText('→', x + 222, 170); } }
        pg.fillStyle = '#a9c4ff'; pg.font = '500 26px ' + FONT; pg.textAlign = 'left'; pg.fillText('inconsistent product data in, learnable structure out', 40, 280);
        pt.needsUpdate = true;
      }
      var pt = ctex(pc); drawP(); W.redraw.push(drawP);
      var pp = new T.Mesh(new T.PlaneGeometry(3, 0.94), new T.MeshBasicMaterial({ map: pt })); pp.position.set(-14.88, 2.2, -5.2); pp.rotation.y = Math.PI / 2; root.add(pp);
      // research desks
      station(-9, -6.0, Math.PI, 40, { dual: true, chair: 0x6d597a, top: 0xf0f0f0 });
      station(-6.2, -6.0, Math.PI, 41, { chair: 0x6d597a, top: 0xf0f0f0 });
      plant(-3.9, -13.2, 1); plant(-14, -4.8, 1);
    })();

    /* ---------- MEETING ROOM ---------- */
    (function () {
      var slideDefs = [
        { h: 'About', lines: ['Nagori Shafik', 'Full-stack and applied AI engineer', 'Web platforms with machine learning built in', 'MSc Data & AI'] },
        { h: 'Languages', lines: ['Python  ·  TypeScript  ·  JavaScript', 'SQL  ·  Java  ·  Shell'] },
        { h: 'AI & ML', lines: ['scikit-learn  ·  TensorFlow', 'Feature engineering', 'Model evaluation  ·  Causal reasoning'] },
        { h: 'Backend & data', lines: ['Node.js  ·  Express  ·  REST', 'JWT / OAuth', 'MySQL  ·  PostgreSQL  ·  MongoDB  ·  SQL Server'] },
        { h: 'Frontend & delivery', lines: ['React  ·  Angular', 'TDD  ·  CI/CD  ·  Git  ·  AWS / GCP', 'Agile  ·  code review  ·  clear docs'] }
      ];
      var c = cv(1280, 720), g = c.getContext('2d');
      var t = ctex(c), cur = 0;
      function draw(i) {
        var s = slideDefs[i];
        var gr = g.createLinearGradient(0, 0, 1280, 720); gr.addColorStop(0, '#13294b'); gr.addColorStop(1, '#274c77');
        g.fillStyle = gr; g.fillRect(0, 0, 1280, 720);
        g.fillStyle = '#ffd166'; g.fillRect(70, 90, 90, 8);
        g.fillStyle = '#fff'; g.textAlign = 'left'; g.font = '700 84px ' + FONT; g.fillText(s.h, 70, 200);
        g.font = '500 46px ' + FONT; g.fillStyle = '#d6e4ff';
        s.lines.forEach(function (l, k) { g.fillText(l, 70, 310 + k * 90); });
        for (var d = 0; d < slideDefs.length; d++) { g.fillStyle = d === i ? '#ffd166' : 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(70 + d * 34, 660, 9, 0, 7); g.fill(); }
        t.needsUpdate = true;
      }
      draw(0); W.redraw.push(function () { draw(cur); });
      W.slides = { next: function () { cur = (cur + 1) % slideDefs.length; draw(cur); }, set: function (i) { cur = i; draw(i); } };
      var bd = new T.Group(); bd.position.set(9, 1.9, -3.8); root.add(bd);
      box(bd, 5.2, 2.95, 0.08, 0x1b2030, 0, 0, 0);
      var sc = new T.Mesh(new T.PlaneGeometry(5.0, 2.8125), new T.MeshBasicMaterial({ map: t })); sc.position.z = 0.05; bd.add(sc);
      hot(sc, { id: 'skills' });
      beacon(9, 3.55, -3.5, { id: 'skills' });
      // table and chairs
      table(9, 2.6, 5.4, 1.4, 0.75, 0xe2c79b);
      for (var i = 0; i < 3; i++) chair(root, 7.2 + i * 1.8, 4.0, Math.PI, 0xf4a261);
      for (var j = 0; j < 3; j++) chair(root, 7.2 + j * 1.8, 1.2, 0, 0xf4a261);
      chair(root, 5.9, 2.6, Math.PI / 2, 0xf4a261); chair(root, 12.1, 2.6, -Math.PI / 2, 0xf4a261);
      // laptops on the table
      for (var k = 0; k < 3; k++) { box(root, 0.36, 0.02, 0.26, 0x9aa4b5, 7.2 + k * 1.8, 0.79, 3.3); var lid = box(root, 0.36, 0.24, 0.02, 0x2d3342, 7.2 + k * 1.8, 0.92, 3.18); lid.rotation.x = -0.25; }
      cylm(root, 0.1, 0.08, 0.2, 0xffffff, 9, 0.88, 2.3);
      plant(14, 5.2, 1.2); plant(14, -2.8, 1.1); plant(3.9, 5.2, 0.9);
      shelf(14.7, 1.5, Math.PI / 2 * -1, 2.4, 2.0);
      var wl = labelPlane('Plan. Build. Review. Ship.', 3.2, 0.5, '#2a9d8f', '#fff'); wl.position.set(14.88, 2.5, -0.5); wl.rotation.y = -Math.PI / 2; root.add(wl);
    })();

    /* ---------- LOUNGE ---------- */
    (function () {
      rug(9.5, -8.2, 5.2, 3.6, 0xf4a261); rug(9.5, -8.2, 4.6, 3.0, 0xf6bd7f);
      // kitchen counter along the north wall
      var k = new T.Group(); k.position.set(7, 0, -13.35); root.add(k);
      box(k, 6.4, 0.9, 0.7, 0xfdf6e3, 0, 0.45, 0); box(k, 6.5, 0.06, 0.78, 0x3b4660, 0, 0.93, 0);
      for (var i = 0; i < 6; i++) box(k, 1.0, 0.8, 0.02, 0x2a9d8f, -2.6 + i * 1.04, 0.45, 0.36, { ns: true });
      col(7, -13.35, 6.5, 0.8);
      // coffee machine
      var cm = new T.Group(); cm.position.set(5.4, 0.96, -13.25); root.add(cm);
      var body = box(cm, 0.5, 0.62, 0.42, 0x25324a, 0, 0.31, 0, { m: 0.3, r: 0.4 });
      box(cm, 0.54, 0.1, 0.46, 0xd7263d, 0, 0.66, 0);
      box(cm, 0.12, 0.2, 0.1, 0x9aa4b5, 0, 0.3, 0.26);
      var led = new T.Mesh(new T.BoxGeometry(0.05, 0.05, 0.02), new T.MeshBasicMaterial({ color: 0x00ff88 })); led.position.set(0.15, 0.5, 0.22); cm.add(led); W.blink.push({ m: led, ph: 0, sp: 3 });
      hot(body, { id: 'coffee' });
      beacon(5.4, 2.0, -12.9, { id: 'coffee' });
      cylm(root, 0.07, 0.06, 0.1, 0xffffff, 6.2, 0.99, -13.3);
      cylm(root, 0.07, 0.06, 0.1, 0xffb703, 6.5, 0.99, -13.2);
      // fridge
      box(root, 0.9, 1.9, 0.75, 0xe9eef2, 11.0, 0.95, -13.3, { m: 0.2 }); col(11, -13.3, 0.9, 0.75);
      // sofas and tv
      sofa(9.5, -6.0, Math.PI, 3.4, 0x457b9d);
      sofa(4.9, -6.9, Math.PI / 2, 2.4, 0xe76f51);
      table(9.5, -8.4, 1.5, 0.8, 0.4, 0xfff1d6);
      var tv = new T.Group(); tv.position.set(14.85, 1.4, -8.2); tv.rotation.y = -Math.PI / 2; root.add(tv);
      box(tv, 2.2, 1.25, 0.06, 0x111111, 0, 0, 0);
      var tc = cv(704, 400), tg = tc.getContext('2d');
      var hellos = [['Hello', 'English'], ['Namaste', 'Hindi'], ['Kem cho', 'Gujarati']], hi = 0;
      var tt = ctex(tc);
      function drawTv() { tg.fillStyle = '#16233a'; tg.fillRect(0, 0, 704, 400); tg.fillStyle = '#ffd166'; tg.textAlign = 'center'; tg.font = '700 110px ' + FONT; tg.fillText(hellos[hi][0], 352, 210); tg.fillStyle = '#a9c4ff'; tg.font = '500 38px ' + FONT; tg.fillText(hellos[hi][1] + ' · say hello any time', 352, 290); tt.needsUpdate = true; }
      drawTv(); W.redraw.push(drawTv);
      W.tvNext = function () { hi = (hi + 1) % 3; drawTv(); };
      var tsc = new T.Mesh(new T.PlaneGeometry(2.1, 1.19), new T.MeshBasicMaterial({ map: tt })); tsc.position.z = 0.04; tv.add(tsc);
      // bean bags, plants
      sphm(root, 0.55, 0xffb703, 13, 0.35, -5.2, { sy: 0.7 }); sphm(root, 0.55, 0x2a9d8f, 13.9, 0.35, -6.2, { sy: 0.7 });
      plant(14, -12.8, 1.2); plant(3.9, -5, 1); plant(3.9, -12.8, 1);
      // pendant lamps
      [8, 11].forEach(function (x) { cylm(root, 0.01, 0.01, 1.0, 0x222, x, 2.6, -8.2, { ns: true }); sphm(root, 0.22, 0xfff1b8, x, 2.05, -8.2, { mat: new T.MeshBasicMaterial({ color: 0xfff1b8 }) }); });
    })();

    /* ---------- OWNER'S OFFICE ---------- */
    (function () {
      rug(0, -19.2, 6.4, 3.8, 0x2b3a55); rug(0, -19.2, 5.8, 3.2, 0x3b5278);
      // executive desk facing south (owner sits behind it at z=-22, camera sees his front)
      var g = new T.Group(); g.position.set(0, 0, -20.6); root.add(g);
      box(g, 3.4, 0.07, 1.2, 0x6b4426, 0, 0.78, 0); box(g, 3.2, 0.72, 1.0, 0x7a4f2d, 0, 0.36, 0);
      box(g, 3.0, 0.5, 0.04, 0x5c3a1f, 0, 0.45, 0.52, { ns: true });
      var np = labelPlane('NAGORI SHAFIK · Owner', 1.9, 0.34, '#ffc233', '#25324a'); np.position.set(0, 0.62, 0.55); g.add(np);
      var mon = new T.Group(); mon.position.set(0, 0, 0); g.add(mon);
      // monitors face the owner (north), glow visible
      monitor(g, -0.5, 1.2, -0.15, 0.7, 0.42, makeCode(77)); monitor(g, 0.4, 1.2, -0.15, 0.7, 0.42, makeCode(78));
      box(g, 0.45, 0.02, 0.16, 0x2d3342, 0, 0.83, -0.1);
      col(0, -20.6, 3.4, 1.2);
      hot(g.children[0], { id: 'owner' });
      chair(root, 0, -22.2, 0, 0xc0392b);
      // visitor chairs
      chair(root, -2.2, -17.6, Math.PI, 0xf4a261); chair(root, 2.2, -17.6, Math.PI, 0xf4a261);
      // shelves & windows
      shelf(-5.7, -19.5, Math.PI / 2, 3.2, 2.1); shelf(5.7, -19.5, -Math.PI / 2, 3.2, 2.1);
      [-3, 0, 3].forEach(function (x, i) {
        var w = new T.Group(); w.position.set(x, 1.8, -23.88); root.add(w);
        box(w, 2.0, 1.5, 0.06, 0xf6f2ea, 0, 0, 0);
        var pane = new T.Mesh(new T.PlaneGeometry(1.8, 1.3), (W.winMat || (W.winMat = new T.MeshBasicMaterial({ color: 0xa8dcff })))); pane.position.z = 0.04; w.add(pane);
        box(w, 1.8, 0.05, 0.02, 0xf6f2ea, 0, 0, 0.05); box(w, 0.05, 1.3, 0.02, 0xf6f2ea, 0, 0, 0.05);
        var cl = sphm(w, 0.2, 0xffffff, -0.4 + i * 0.3, 0.2, 0.06, { ns: true, sy: 0.6 });
      });
      plant(-4.7, -23, 1.3); plant(4.7, -23, 1.3); plant(-4.9, -15, 1.1); plant(4.9, -15, 1.1);
      var co = labelPlane('Ship it. Then make it better.', 3.0, 0.42, '#25324a', '#ffd166'); co.position.set(-5.88, 2.3, -16.5); co.rotation.y = Math.PI / 2; root.add(co);
      sofa(5.0, -15.6, -Math.PI / 2, 1.8, 0x2a9d8f);
    })();

    W.update = function (dt, t, agents, camPos, targetPos) {
      // doors
      W.doors.forEach(function (d) {
        var near = 0;
        for (var i = 0; i < agents.length; i++) {
          var a = agents[i], dx = a.x - d.x, dz = a.z - d.z;
          if (dx * dx + dz * dz < 2.9 * 2.9) { near = 1; break; }
        }
        d.open += (near - d.open) * Math.min(1, dt * 4.2);
        var e = d.open * d.open * (3 - 2 * d.open), half = d.w / 2, sl = e * (half - 0.04);
        for (var k = 0; k < 2; k++) {
          var sgn = k ? 1 : -1, off = sgn * (half / 2 + sl), side = k ? 0.07 : -0.07;
          if (d.horiz) d.panels[k].position.set(d.x + off, 0, d.z + side); else d.panels[k].position.set(d.x + side, 0, d.z + off);
        }
      });
      // leds
      W.blink.forEach(function (b) { b.m.visible = Math.sin(t * b.sp + b.ph) > -0.2; });
      // scrolling code screens
      W.scroll.forEach(function (s) { s.off = (s.off + dt * s.sp) % 1; s.t.offset.y = s.off; });
      // beacons
      W.beacons.forEach(function (b) { b.g.position.y = b.y + Math.sin(t * 2 + b.ph) * 0.06; b.g.rotation.y += dt; var s = 1 + 0.25 * Math.sin(t * 3 + b.ph); b.ring.scale.set(s, s, s); });
      // fade walls that hide the target (and the area around it)
      var samples = W._samples || (W._samples = [[0, 0], [3.6, 0], [-3.6, 0], [0, 3.2], [0, -3.2], [2.6, 2.4], [-2.6, 2.4], [2.6, -2.4], [-2.6, -2.4]]);
      var hit = new T.Vector3(), dir = new T.Vector3(), tp = new T.Vector3(), ray = new T.Ray(camPos, dir);
      for (var i = 0; i < W.walls.length; i++) W.walls[i].blocked = false;
      for (var s = 0; s < samples.length; s++) {
        tp.set(targetPos.x + samples[s][0], targetPos.y, targetPos.z + samples[s][1]);
        dir.subVectors(tp, camPos); var dist = dir.length(); dir.normalize();
        for (var j = 0; j < W.walls.length; j++) {
          var w = W.walls[j];
          if (!w.blocked && ray.intersectBox(w.box, hit) && hit.distanceTo(camPos) < dist - 0.3) w.blocked = true;
        }
      }
      for (var k = 0; k < W.walls.length; k++) {
        var wl = W.walls[k], goal = wl.blocked ? 0.08 : 1;
        wl.mat.opacity += (goal - wl.mat.opacity) * Math.min(1, dt * 7);
        var tr = wl.mat.opacity < 0.985;
        if (tr !== wl.mat.transparent) { wl.mat.transparent = tr; wl.mat.needsUpdate = true; }
        wl.mat.depthWrite = !tr;
      }
    };
    return W;
  };
})();
