/* main.js: engine. Renderer, camera, people, guided walking, dialogue UI, free-walk. */
(function () {
  'use strict';
  var SO = window.SO, T = THREE, ST = SO.story;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function damp(a, b, k, dt) { return a + (b - a) * (1 - Math.exp(-k * dt)); }
  function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

  var canvas = $('c'), renderer;
  var coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
  try {
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    $('loading').hidden = true; $('fallback').hidden = false; return;
  }
  var small = coarse || Math.min(innerWidth, innerHeight) < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.6 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  var scene = new T.Scene();
  scene.background = new T.Color(0xbfe6ff);
  scene.fog = new T.Fog(0xbfe6ff, 70, 170);
  var camera = new T.PerspectiveCamera(45, 1, 0.5, 300);
  var hemi = new T.HemisphereLight(0xf2f7ff, 0xb9a98c, 0.7); scene.add(hemi);
  var sun = new T.DirectionalLight(0xfff0d6, 0.62);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  var sc = sun.shadow.camera; sc.left = -15; sc.right = 15; sc.top = 15; sc.bottom = -15; sc.near = 1; sc.far = 60;
  sun.shadow.bias = -0.0007;
  scene.add(sun); scene.add(sun.target);

  var W;
  try { W = SO.buildOffice(scene); } catch (err) { console.error(err); $('loading').hidden = true; $('fallback').hidden = false; return; }

  /* ---------- routes ---------- */
  function buildRoute(pts, r) {
    r = r || 0.9;
    var P = [pts[0]];
    for (var i = 1; i < pts.length; i++) { var l = P[P.length - 1]; if (Math.hypot(pts[i].x - l.x, pts[i].z - l.z) > 0.05) P.push(pts[i]); }
    var out = [P[0]];
    for (var k = 1; k < P.length - 1; k++) {
      var a = P[k - 1], b = P[k], c = P[k + 1];
      var d1 = Math.hypot(a.x - b.x, a.z - b.z), d2 = Math.hypot(c.x - b.x, c.z - b.z), rr = Math.min(r, d1 * 0.45, d2 * 0.45);
      var p1 = { x: b.x + (a.x - b.x) / d1 * rr, z: b.z + (a.z - b.z) / d1 * rr }, p2 = { x: b.x + (c.x - b.x) / d2 * rr, z: b.z + (c.z - b.z) / d2 * rr };
      for (var s = 0; s <= 8; s++) { var t = s / 8, u = 1 - t; out.push({ x: u * u * p1.x + 2 * u * t * b.x + t * t * p2.x, z: u * u * p1.z + 2 * u * t * b.z + t * t * p2.z }); }
    }
    if (P.length > 1) out.push(P[P.length - 1]);
    var cum = [0];
    for (var j = 1; j < out.length; j++) cum.push(cum[j - 1] + Math.hypot(out[j].x - out[j - 1].x, out[j].z - out[j - 1].z));
    return { p: out, c: cum, len: cum[cum.length - 1] };
  }
  function posAt(r, s) {
    var c = r.c, p = r.p;
    if (p.length < 2) return { x: p[0].x, z: p[0].z, dx: 0, dz: 1 };
    var i = 1; while (i < c.length - 1 && c[i] < s) i++;
    var seg = Math.max(1e-6, c[i] - c[i - 1]), f = clamp((s - c[i - 1]) / seg, 0, 1);
    return { x: p[i - 1].x + (p[i].x - p[i - 1].x) * f, z: p[i - 1].z + (p[i].z - p[i - 1].z) * f, dx: p[i].x - p[i - 1].x, dz: p[i].z - p[i - 1].z };
  }
  var adj = {};
  ST.edges.forEach(function (e) { (adj[e[0]] = adj[e[0]] || []).push(e[1]); (adj[e[1]] = adj[e[1]] || []).push(e[0]); });
  function bfs(a, b) {
    if (a === b) return [a];
    var prev = {}, q = [a]; prev[a] = null;
    while (q.length) { var n = q.shift(); if (n === b) break; (adj[n] || []).forEach(function (m) { if (!(m in prev)) { prev[m] = n; q.push(m); } }); }
    var out = [], cur = b; if (!(b in prev)) return [a, b];
    while (cur) { out.unshift(cur); cur = prev[cur]; }
    return out;
  }
  function npos(id) { var n = ST.nodes[id]; return { x: n[0], z: n[1] }; }
  function roomAt(x, z) {
    for (var i = 0; i < ST.rooms.length; i++) { var r = ST.rooms[i]; if (x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2) return r; }
    return null;
  }
  function nearestNode(x, z) {
    var rm = roomAt(x, z), id = rm ? rm.id : 'outside', best = null, bd = 1e9;
    for (var pass = 0; pass < 2 && !best; pass++) {
      for (var k in ST.nodes) {
        if (pass === 0 && ST.nodes[k][2] !== id) continue;
        var d = Math.hypot(ST.nodes[k][0] - x, ST.nodes[k][1] - z); if (d < bd) { bd = d; best = k; }
      }
    }
    return best;
  }
  function pathPts(from, fromNode, toNode, end) {
    var pts = [{ x: from.x, z: from.z }];
    bfs(fromNode, toNode).forEach(function (id) { pts.push(npos(id)); });
    if (end) pts.push(end);
    return pts;
  }

  /* ---------- agents ---------- */
  function Agent(person, x, z, yaw) {
    this.p = person; this.name = person.name; this.x = x; this.z = z; this.yaw = yaw || 0; this.yawT = this.yaw;
    this.speed = 0; this.route = null; this.s = 0; this.look = null; this.faceT = null; this.waveT = 0; this.yOff = 0;
    this.talking = false; this.typing = false; this.done = false;
    person.group.position.set(x, 0, z); person.group.rotation.y = this.yaw; scene.add(person.group);
  }
  Agent.prototype.follow = function (r) { this.route = r; this.s = 0; this.done = false; };
  Agent.prototype.move = function (dt, vmax, ease) {
    var r = this.route;
    if (r) {
      var remain = r.len - this.s;
      if (remain < 0.04) { this.route = null; this.done = true; }
      else {
        var vw = vmax * clamp(remain / (ease || 1.3), 0.2, 1);
        this.speed = damp(this.speed, vw, 6, dt);
        this.s = Math.min(r.len, this.s + this.speed * dt);
        var q = posAt(r, this.s); this.x = q.x; this.z = q.z;
        if (this.speed > 0.15) this.yawT = Math.atan2(q.dx, q.dz);
      }
    }
    if (!this.route) this.speed = damp(this.speed, 0, 9, dt);
  };
  Agent.prototype.tick = function (dt, t) {
    var st = this.p.st;
    if (this.faceT && this.speed < 0.15) this.yawT = Math.atan2(this.faceT.x - this.x, this.faceT.z - this.z);
    this.yaw += wrap(this.yawT - this.yaw) * (1 - Math.exp(-(this.speed > 0.15 ? 10 : 6) * dt));
    st.walk = damp(st.walk, clamp(this.speed / 1.1, 0, 1), 9, dt);
    if (this.speed > 0.03) st.phase += this.speed * dt * 4.3;
    st.sit = damp(st.sit, st.sitTarget, 3, dt);
    st.talk = damp(st.talk, this.talking ? 1 : 0, 6, dt);
    st.type = damp(st.type, this.typing && st.sitTarget > 0.5 ? 1 : 0, 5, dt);
    if (this.waveT > 0) this.waveT -= dt;
    st.wave = damp(st.wave, this.waveT > 0 ? 1 : 0, 7, dt);
    if (this.look) st.look = clamp(wrap(Math.atan2(this.look.x - this.x, this.look.z - this.z) - this.yaw), -1, 1); else st.look = 0;
    var g = this.p.group; g.position.set(this.x, this.yOff, this.z); g.rotation.y = this.yaw;
    this.p.update(dt, t);
  };

  var crew = [], movers = [], byId = {}, walkers = [], chatters = [];
  var player = new Agent(SO.makePerson({ name: 'You', skin: 0xe0a97d, shirt: 0xff7a3d, pants: 0x34495e, hair: 0x3b2a20, hairStyle: 'short', shoes: 0xf1f1f1 }), ST.nodes.out[0], ST.nodes.out[1], Math.PI);
  (function () {
    var bp = new T.Mesh(new T.BoxGeometry(0.34, 0.42, 0.16), new T.MeshStandardMaterial({ color: 0x264653, roughness: 0.8 }));
    bp.position.set(0, 0.3, -0.24); bp.castShadow = true; player.p.j.torso.add(bp);
    var ring = new T.Mesh(new T.RingGeometry(0.42, 0.52, 32), new T.MeshBasicMaterial({ color: 0xffb703, transparent: true, opacity: 0.9, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; player.ring = ring; scene.add(ring);
  })();
  movers.push(player);

  ST.cast.forEach(function (c) {
    var look = Object.assign({ name: c.name || '' }, c.look);
    var pr = SO.makePerson(look), a = new Agent(pr, c.x, c.z, c.yaw || 0);
    a.spec = c; a.yOff = c.y || 0;
    if (c.kind === 'seat') { pr.st.sit = 1; pr.st.sitTarget = 1; a.typing = !!c.type; if (c.lookDown) pr.st.lookP = 0.35; }
    if (c.talk) a.talking = true;
    if (c.label) { var sp = SO.labelSprite(c.name, c.role); sp.position.y = 2.2; pr.group.add(sp); }
    if (c.id) byId[c.id] = a;
    if (c.kind === 'walker') {
      a.node = nearestNode(c.x, c.z); walkers.push({ a: a, wait: 1 + Math.random() * 3 }); movers.push(a);
    }
    if (c.chat) chatters.push({ a: a, t: Math.random() * 3 });
    crew.push(a);
  });
  var guide = byId.riya, boss = byId.nagori, GN = guide.name;
  (function () {
    var j = guide.p.j, glow = new T.MeshBasicMaterial({ color: 0x6ff3ff });
    var ant = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 0.16, 6), new T.MeshStandardMaterial({ color: 0x9aa4b5 })); ant.position.set(0, 0.3, 0); j.head.add(ant);
    var tip = new T.Mesh(new T.SphereGeometry(0.03, 10, 8), glow); tip.position.set(0, 0.4, 0); j.head.add(tip); guide.tip = tip;
    var badge = new T.Mesh(new T.BoxGeometry(0.09, 0.05, 0.01), glow); badge.position.set(0.09, 0.42, 0.2); j.torso.add(badge);
  })();
  movers.push(guide);
  chatters.forEach(function (c, i) { c.a.talking = i === 0; });
  var lastSeatLook = null;

  /* ---------- name, greeting and time of day ---------- */
  var hourQ = location.search.match(/hour=(\d+(?:\.\d+)?)/), HOUR = hourQ ? parseFloat(hourQ[1]) : (new Date().getHours() + new Date().getMinutes() / 60);
  var PART = HOUR >= 5 && HOUR < 12 ? 'morning' : HOUR >= 12 && HOUR < 17 ? 'afternoon' : 'evening';
  var KIND = HOUR >= 5 && HOUR < 17 ? 'day' : HOUR >= 17 && HOUR < 20 ? 'dusk' : 'night';
  function fill(s) { return String(s).replace(/\{n\}/g, S.name || 'friend').replace(/\{part\}/g, PART); }
  var SUNO = { x: 9, y: 20, z: 11 };
  var stars = (function () {
    var n = 500, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, e = Math.random() * 1.3 + 0.1, r = 150; pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
    var p = new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9, depthWrite: false }));
    p.visible = false; p.frustumCulled = false; scene.add(p);
    var moon = new T.Mesh(new T.SphereGeometry(7, 20, 14), new T.MeshBasicMaterial({ color: 0xfff6d6, fog: false })); moon.position.set(-60, 90, -80); p.add(moon);
    return p;
  })();
    var THEMES = {
    day: { bg: 0xbfe6ff, hemi: [0xf2f7ff, 0xb9a98c, 0.7], sun: [0xfff0d6, 0.62], off: [9, 20, 11], ground: 0x9fd27f, plaza: 0xffffff, win: 0xa8dcff, lamps: 0, fog: [70, 170] },
    dusk: { bg: 0xf2a477, hemi: [0xffe3cf, 0x9a7a78, 0.64], sun: [0xffb27a, 0.55], off: [16, 9, 6], ground: 0x7fa066, plaza: 0xd9b8a8, win: 0xffb48a, lamps: 0.45, fog: [60, 150] },
    night: { bg: 0x0a1030, hemi: [0xe2e8ff, 0x7a7f9c, 0.8], sun: [0xaec0ff, 0.45], off: [-10, 22, 8], ground: 0x24402f, plaza: 0x626b82, win: 0x1a2a55, lamps: 0.75, fog: [45, 130] }
  };
  function applyTheme(kind) {
    var th = THEMES[kind];
    scene.background.set(th.bg); scene.fog.color.set(th.bg); scene.fog.near = th.fog[0]; scene.fog.far = th.fog[1];
    hemi.color.set(th.hemi[0]); hemi.groundColor.set(th.hemi[1]); hemi.intensity = th.hemi[2];
    sun.color.set(th.sun[0]); sun.intensity = th.sun[1]; SUNO.x = th.off[0]; SUNO.y = th.off[1]; SUNO.z = th.off[2];
    if (W.ground) W.ground.material.color.set(th.ground);
    if (W.plazaMat) W.plazaMat.color.set(th.plaza);
    if (W.winMat) W.winMat.color.set(th.win);
    stars.visible = kind === 'night';
    document.body.setAttribute('data-time', kind);
    document.querySelector('meta[name=theme-color]').setAttribute('content', kind === 'night' ? '#0a1030' : kind === 'dusk' ? '#c8703f' : '#25324a');
    var f = kind === 'day' ? 1 : kind === 'dusk' ? 0.78 : 0.34;
    (W.outMats || []).forEach(function (m) { m.mat.color.copy(m.c).multiplyScalar(f); });
  }

  /* ---------- state ---------- */
  var S = { mode: 'intro', companion: true, vNode: 'out', gNode: 'gdesk', trip: null, room: null, waved: false, bossUp: false };
  var VMAX = 1.75;
  guide.node = 'gdesk';
  guide.p.st.look = 0;

  /* ---------- UI ---------- */
  var ui = { box: $('dlg'), who: $('dwho'), text: $('dtext'), chips: $('dchips'), btns: $('dbtns'), full: '', pos: 0, typing: false, speaker: null, h: 0 };
  function setSpeaker(a) { if (ui.speaker && ui.speaker !== a) ui.speaker.talking = false; ui.speaker = a; }
  function say(o) {
    ui.box.hidden = false;
    ui.who.textContent = o.who || '';
    ui.full = fill(o.text || ''); ui.pos = 0; ui.typing = !!ui.full;
    ui.text.textContent = ''; ui.text.hidden = !ui.full;
    setSpeaker(o.speaker || null);
    if (ui.speaker) ui.speaker.talking = ui.typing;
    ui.chips.innerHTML = ''; ui.chips.hidden = !(o.chips && o.chips.length);
    (o.chips || []).forEach(function (c) { var s = document.createElement('span'); s.textContent = c; ui.chips.appendChild(s); });
    ui.btns.innerHTML = ''; ui.btns.className = 'btns' + (o.grid ? ' grid' : '');
    if (o.html) { var m = document.createElement('div'); m.className = 'mail'; m.innerHTML = o.html; ui.btns.appendChild(m); }
    (o.buttons || []).forEach(function (b) {
      var el = document.createElement(b.href ? 'a' : 'button');
      el.className = 'b' + (b.cls ? ' ' + b.cls : '');
      el.innerHTML = b.label + (b.sub ? '<small>' + b.sub + '</small>' : '');
      if (b.href) { el.href = b.href; if (/^https?:/.test(b.href)) { el.target = '_blank'; el.rel = 'noopener'; } }
      else { el.type = 'button'; el.onclick = function (e) { e.stopPropagation(); b.fn(el); }; }
      ui.btns.appendChild(el);
    });
    ui.box.scrollTop = 0;
    if (!o.text) { /* no typing */ }
  }
  function finishTyping() { if (!ui.typing) return; ui.text.textContent = ui.full; ui.typing = false; if (ui.speaker) { var sp = ui.speaker; setTimeout(function () { if (!ui.typing) sp.talking = false; }, 500); } }
  function hideDlg() { ui.box.hidden = true; ui.typing = false; setSpeaker(null); }
  ui.text.addEventListener('click', finishTyping);
  $('dclose').onclick = function () { hideDlg(); if (S.mode === 'idle' && S.lastKey) { /* leave the visitor free to click around */ } };

  function placesOpen() { $('places').hidden = false; }
  function placesClose() { $('places').hidden = true; }
  $('pclose').onclick = placesClose;
  $('places').addEventListener('click', function (e) { if (e.target === this) placesClose(); });
  var placeItems = [
    { label: 'Reception', sub: 'Say hi to the AI Assistant', go: 'reception' },
    { label: 'Work floor', sub: 'Projects on the boards', go: 'erp' },
    { label: 'Research lab', sub: 'AI & data research', go: 'causal' },
    { label: 'Meeting room', sub: 'About & skills', go: 'about' },
    { label: 'Coffee lounge', sub: 'Take five', go: 'coffee' },
    { label: "Nagori's office", sub: 'Contact', go: 'owner' }
  ];
  var plist = $('plist');
  placeItems.forEach(function (p) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'b'; b.innerHTML = p.label + '<small>' + p.sub + '</small>';
    b.onclick = function () { placesClose(); startTrip(p.go, { guided: S.companion }); };
    plist.appendChild(b);
  });
  $('bPlaces').onclick = function () { if (S.mode === 'intro') return; placesOpen(); };

  var hintEl = $('hint'), hintT = 0;
  function hint(txt, secs) { hintEl.textContent = txt; hintEl.hidden = false; hintT = secs || 6; }

  /* ---------- story flow ---------- */
  function startTrip(key, o) {
    o = o || {};
    var d = ST.dests[ST.alias[key] || key]; if (!d) return;
    if (S.mode === 'free') S.vNode = nearestNode(player.x, player.z);
    S.lastKey = key;
    hideDlg();
    var guided = !!(o.guided && S.companion);
    S.mode = 'auto';
    var vp = pathPts(player, S.vNode, d.vNode, { x: d.v[0], z: d.v[1] });
    player.follow(buildRoute(vp)); player.look = null; player.faceT = null;
    guide.look = null; guide.faceT = null;
    if (guided) { guide.follow(buildRoute(pathPts(guide, S.gNode, d.gNode, { x: d.g[0], z: d.g[1] }))); }
    S.trip = { key: key, d: d, guided: guided };
    $('bFree').classList.remove('on'); $('joy').hidden = true;
  }
  function arrive() {
    var tr = S.trip; S.trip = null; S.mode = 'idle';
    S.vNode = tr.d.vNode; if (tr.guided || tr.key === 'reception') S.gNode = tr.d.gNode;
    player.yawT = tr.d.v[2]; player.faceT = null;
    if (tr.guided || tr.key === 'reception') { S.companion = true; guide.faceT = player; guide.look = player; }
    if (tr.key === 'reception') showGreeting(S.firstGreeting ? ST.again : ST.greeting);
    else showStop(tr.key);
  }
  function showGreeting(text) {
    S.firstGreeting = true;
    guide.waveT = 2.2; guide.faceT = player; guide.look = player;
    say({ who: GN, text: text, speaker: guide, grid: true, buttons: ST.menu.map(function (m) { return { label: m.label, sub: m.sub, fn: function () { choose(m); } }; }) });
  }
  function choose(m) {
    if (m.free) { say({ who: GN, text: m.lead, speaker: guide }); setTimeout(function () { enterFree(); }, 900); return; }
    say({ who: GN, text: m.lead, speaker: guide });
    setTimeout(function () { startTrip(m.go, { guided: true }); }, 1100);
  }
  function showMenu() {
    var sp = S.companion && S.mode !== 'free' ? guide : null;
    say({ who: sp ? GN : 'Where to?', text: sp ? 'Happy to show you more, {n}. Where to?' : '', speaker: sp, grid: true, buttons: ST.menu.map(function (m) { return { label: m.label, sub: m.sub, fn: function () { if (sp) choose(m); else if (m.free) enterFree(); else startTrip(m.go, { guided: false }); } }; }) });
  }
  function copyEmail(btn) {
    function ok() { var o = btn.innerHTML; btn.innerHTML = 'Copied!'; setTimeout(function () { btn.innerHTML = o; }, 1400); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ST.email).then(ok, function () { fb(); });
    else fb();
    function fb() { var t = document.createElement('textarea'); t.value = ST.email; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) { } document.body.removeChild(t); }
  }
  function showStop(key, remote) {
    var c = ST.content[key]; if (!c) return;
    var speaker = null, who = c.room;
    if (key === 'owner' && !remote) { speaker = boss; who = 'Nagori'; }
    else if (!remote && S.companion) { speaker = guide; who = GN; }
    else who = c.title;
    if (!remote) {
      if (typeof c.slide === 'number' && W.slides) W.slides.set(c.slide);
      if (c.tv && W.tvNext) W.tvNext();
      if (key === 'owner') wakeBoss();
    }
    var btns = [];
    if (remote) btns.push({ label: 'Walk me there', cls: 'primary', fn: function () { startTrip(key, { guided: S.companion }); } });
    var html = '';
    if (c.contact) {
      html = '<code>' + ST.email + '</code>';
      btns.push({ label: 'Write to me', cls: 'primary', href: 'mailto:' + ST.email + '?subject=Project%20enquiry' });
      btns.push({ label: 'Copy email', cls: 'teal', fn: copyEmail });
      btns.push({ label: 'Ask for my CV', href: 'mailto:' + ST.email + '?subject=CV%20request' });
      ST.links.forEach(function (l) { btns.push({ label: l.label, href: l.href }); });
    }
    if (c.links) ST.links.forEach(function (l) { btns.push({ label: l.label, cls: 'teal', href: l.href }); });
    if (!remote) {
      var list = ST.tours[ST.tourOf[key]] || [], i = list.indexOf(key), nk = list[i + 1];
      if (nk) btns.push({ label: 'Next: ' + ST.content[nk].title + ' →', cls: c.contact || c.links ? '' : 'primary', fn: function () { startTrip(nk, { guided: true }); } });
      btns.push({ label: S.companion ? 'Back to reception' : 'Reception', cls: 'ghost', fn: function () { startTrip('reception', { guided: true }); } });
      btns.push({ label: 'Somewhere else', cls: 'ghost', fn: showMenu });
    } else btns.push({ label: 'Close', cls: 'ghost', fn: hideDlg });
    var body = c.text;
    if (speaker === guide && !remote) { S.introI = ((S.introI || 0) + 1) % ST.intros.length; body = ST.intros[S.introI] + body; }
    say({ who: who, text: body, chips: c.chips, html: html, speaker: speaker, buttons: btns });
  }
  function wakeBoss() {
    if (S.bossUp) return; S.bossUp = true;
    boss.typing = false; boss.look = player;
    setTimeout(function () { boss.p.st.sitTarget = 0; boss.waveT = 2.4; boss.faceT = player; }, 250);
  }
  function enterFree() {
    hideDlg(); placesClose();
    S.mode = 'free'; S.trip = null; S.companion = false; S.vNode = nearestNode(player.x, player.z);
    player.route = null; player.faceT = null;
    guide.faceT = null; guide.look = null;
    if (S.gNode !== 'gdesk') guide.follow(buildRoute(pathPts(guide, S.gNode, 'gdesk', { x: 0, z: 10.2 })));
    guide.homing = true; S.gNode = 'gdesk';
    $('bFree').classList.add('on'); $('bFree').textContent = 'Stop exploring';
    $('joy').hidden = !(coarse || innerWidth < 800);
    hint(coarse ? 'Drag the joystick to walk. Tap glowing diamonds for details. Places jumps to a room.' : 'Walk with WASD or the arrow keys. Click glowing diamonds for details. Places jumps to a room.', 8);
  }
  function leaveFree() {
    $('bFree').classList.remove('on'); $('bFree').textContent = 'Explore'; $('joy').hidden = true;
    startTrip('reception', { guided: false });
  }
  $('bFree').onclick = function () { if (S.mode === 'intro') return; if (S.mode === 'free') leaveFree(); else enterFree(); };
  var nameIn = $('nameIn');
  try { var saved = localStorage.getItem('so_name'); if (saved) nameIn.value = saved; } catch (e) { }
  $('nameForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = nameIn.value.replace(/\s+/g, ' ').replace(/[<>]/g, '').trim().slice(0, 20);
    if (!v) { nameIn.classList.remove('shake'); void nameIn.offsetWidth; nameIn.classList.add('shake'); nameIn.focus(); return; }
    S.name = v.charAt(0).toUpperCase() + v.slice(1);
    try { localStorage.setItem('so_name', S.name); } catch (e2) { }
    var tag = SO.labelSprite(S.name, 'You'); tag.position.y = 2.2; player.p.group.add(tag);
    $('start').hidden = true; S.mode = 'auto'; startTrip('reception', { guided: false });
    hint('Tip: you are the one in the orange hoodie.', 5);
  });

  /* hotspots */
  var ray = new T.Raycaster(), mouse = new T.Vector2(), downX = 0, downY = 0;
  canvas.addEventListener('pointerdown', function (e) { downX = e.clientX; downY = e.clientY; });
  canvas.addEventListener('pointerup', function (e) {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8 || S.mode === 'intro' || S.mode === 'auto') return;
    mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(mouse, camera);
    var hits = ray.intersectObjects(W.hot, false);
    if (hits.length) { var id = hits[0].object.userData.hot.id; showStop(id, true); }
  });
  var lastHover = 0;
  canvas.addEventListener('pointermove', function (e) {
    if (coarse || performance.now() - lastHover < 80) return; lastHover = performance.now();
    mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(mouse, camera);
    canvas.style.cursor = ray.intersectObjects(W.hot, false).length ? 'pointer' : 'default';
  });

  /* keyboard + joystick */
  var keys = {}, joy = { x: 0, y: 0 };
  addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase(); keys[k] = true;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) > -1 && S.mode === 'free') e.preventDefault();
    if (k === 'escape') { placesClose(); }
    if ((k === 'enter' || k === ' ') && ui.typing) { finishTyping(); }
  });
  addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', function () { keys = {}; });
  (function () {
    var el = $('joy'), kn = $('knob'), id = null;
    function set(e) {
      var r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = e.clientX - cx, dy = e.clientY - cy, m = Math.hypot(dx, dy), max = 44;
      if (m > max) { dx = dx / m * max; dy = dy / m * max; }
      kn.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; joy.x = dx / max; joy.y = dy / max;
    }
    el.addEventListener('pointerdown', function (e) { id = e.pointerId; el.setPointerCapture(id); set(e); e.preventDefault(); });
    el.addEventListener('pointermove', function (e) { if (e.pointerId === id) set(e); });
    function end(e) { if (e.pointerId !== id) return; id = null; joy.x = joy.y = 0; kn.style.transform = ''; }
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  })();

  var vel = { x: 0, z: 0 }, CAMOFF = new T.Vector3(4.4, 8.8, 8.8), FWD = new T.Vector2(-CAMOFF.x, -CAMOFF.z).normalize(), RGT = new T.Vector2(-FWD.y, FWD.x);
  function resolve(x, z, rad) {
    var C = W.colliders;
    for (var pass = 0; pass < 2; pass++) for (var i = 0; i < C.length; i++) {
      var b = C[i];
      if (x < b.minX - rad || x > b.maxX + rad || z < b.minZ - rad || z > b.maxZ + rad) continue;
      var cx = clamp(x, b.minX, b.maxX), cz = clamp(z, b.minZ, b.maxZ), dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
      if (d < rad) {
        if (d > 1e-5) { x = cx + dx / d * rad; z = cz + dz / d * rad; }
        else { var l = x - b.minX, r = b.maxX - x, t = z - b.minZ, bt = b.maxZ - z, m = Math.min(l, r, t, bt); if (m === l) x = b.minX - rad; else if (m === r) x = b.maxX + rad; else if (m === t) z = b.minZ - rad; else z = b.maxZ + rad; }
      }
    }
    return { x: clamp(x, -40, 40), z: clamp(z, -26, 44) };
  }
  function freeMove(dt) {
    var up = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0) - joy.y, rt = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0) + joy.x;
    var dx = FWD.x * up + RGT.x * rt, dz = FWD.y * up + RGT.y * rt, m = Math.hypot(dx, dz);
    if (m > 1) { dx /= m; dz /= m; }
    var sp = (keys.shift ? 3.2 : 2.3);
    vel.x = damp(vel.x, dx * sp, 9, dt); vel.z = damp(vel.z, dz * sp, 9, dt);
    var p = resolve(player.x + vel.x * dt, player.z + vel.z * dt, 0.34);
    var moved = Math.hypot(p.x - player.x, p.z - player.z) / Math.max(dt, 1e-4);
    player.x = p.x; player.z = p.z; player.speed = damp(player.speed, Math.min(moved, sp), 12, dt);
    if (player.speed > 0.2 && m > 0.05) player.yawT = Math.atan2(vel.x, vel.z);
  }

  /* ---------- ambient life ---------- */
  function updateWalkers(dt) {
    walkers.forEach(function (w) {
      var a = w.a;
      if (a.route) { a.move(dt, 1.25, 1.2); if (!a.route) { w.wait = 2.5 + Math.random() * 4; a.talking = Math.random() < 0.5; } return; }
      a.speed = damp(a.speed, 0, 9, dt);
      w.wait -= dt;
      if (w.wait <= 0) {
        a.talking = false;
        var goals = ST.walkerGoals, g = goals[Math.floor(Math.random() * goals.length)];
        if (g === a.node) g = 'h1';
        a.follow(buildRoute(pathPts(a, a.node, g))); a.node = g;
      }
    });
    chatters.forEach(function (c) { c.t -= dt; if (c.t <= 0) { c.t = 2 + Math.random() * 3; c.a.talking = !c.a.talking; } });
  }
  function updateGuideHome(dt) {
    if (guide.homing && guide.route) { guide.move(dt, 1.5, 1.4); if (!guide.route) { guide.homing = false; guide.yawT = 0; } }
  }

  /* ---------- camera ---------- */
  var camTarget = new T.Vector3(player.x, 1, player.z), camPos = new T.Vector3(player.x + CAMOFF.x, CAMOFF.y, player.z + CAMOFF.z), vo = 0, lastW = 0, lastH = 0;
  function resize() {
    var w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 52 : 45; camera.updateProjectionMatrix();
    lastW = w; lastH = h;
  }
  addEventListener('resize', resize); resize();
  function updateCamera(dt) {
    var asp = innerWidth / innerHeight, mult = asp < 1 ? 1 + (1 - asp) * 0.85 : 1;
    var tx = player.x, tz = player.z;
    if (S.trip && S.trip.guided) { tx = player.x * 0.7 + guide.x * 0.3; tz = player.z * 0.7 + guide.z * 0.3; }
    camTarget.x = damp(camTarget.x, tx, 4, dt); camTarget.z = damp(camTarget.z, tz, 4, dt); camTarget.y = 1.0;
    var dx = camTarget.x + CAMOFF.x * mult, dy = CAMOFF.y * mult, dz = camTarget.z + CAMOFF.z * mult;
    camPos.x = damp(camPos.x, dx, 5, dt); camPos.y = damp(camPos.y, dy, 5, dt); camPos.z = damp(camPos.z, dz, 5, dt);
    camera.position.copy(camPos); camera.lookAt(camTarget);
    var wantVo = ui.box.hidden ? 0 : ui.box.offsetHeight * 0.5;
    vo = damp(vo, wantVo, 5, dt);
    if (Math.abs(vo) > 0.5 || camera.view) { camera.setViewOffset(innerWidth, innerHeight, 0, vo, innerWidth, innerHeight); if (Math.abs(vo) < 0.5 && wantVo === 0) camera.clearViewOffset(); }
  }

  /* ---------- loop ---------- */
  var TS = parseFloat((location.search.match(/ts=([\d.]+)/) || [0, 1])[1]) || 1;
  var clock = new T.Clock(), tAcc = 0, roomTimer = 0, first = true;
  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05) * TS; tAcc += dt;

    if (S.mode === 'auto' && S.trip) {
      var tr = S.trip;
      if (tr.guided) {
        var dist = Math.hypot(guide.x - player.x, guide.z - player.z);
        if (guide.route) guide.move(dt, VMAX * clamp((3.8 - dist) / 1.4, 0, 1), 1.6);
        if (!guide.route && !guide.faceT) { guide.faceT = player; guide.look = player; }
        player.move(dt, guide.route ? VMAX * clamp((dist - 1.5) / 1.0, 0, 1.15) : VMAX, 1.3);
        if (!guide.route && !player.route) arrive();
      } else {
        player.move(dt, VMAX, 1.3);
        if (!player.route) arrive();
      }
      // receptionist notices the visitor coming in
      if (tr.key === 'reception' && !S.waved) {
        var d0 = Math.hypot(guide.x - player.x, guide.z - player.z);
        if (d0 < 15) { guide.look = player; }
        if (d0 < 9) { guide.waveT = 2.4; S.waved = true; }
      }
    } else if (S.mode === 'free') { freeMove(dt); }
    updateGuideHome(dt);
    updateWalkers(dt);

    // boss notices people entering his office
    var rm = roomAt(player.x, player.z);
    if (rm && rm.id === 'owner' && !S.bossUp && S.mode !== 'intro') { boss.look = player; if (player.z < -16.5) wakeBoss(); }
    if (!rm || rm.id !== 'owner') { if (S.bossUp && Math.hypot(boss.x - player.x, boss.z - player.z) > 9) { S.bossUp = false; boss.p.st.sitTarget = 1; boss.typing = true; boss.look = null; boss.faceT = null; boss.yawT = 0; } }
    // free-mode idle: receptionist still glances at visitors who walk past
    if (S.mode === 'free' && !guide.route) { var dd = Math.hypot(guide.x - player.x, guide.z - player.z); guide.look = dd < 6 ? player : null; }

    // ring
    player.ring.position.x = player.x; player.ring.position.z = player.z; player.ring.rotation.z += dt;
    player.ring.scale.setScalar(1 + 0.08 * Math.sin(tAcc * 4));

    // typewriter
    if (ui.typing) {
      ui.pos += dt * 62; var n = Math.floor(ui.pos);
      if (n >= ui.full.length) finishTyping(); else ui.text.textContent = ui.full.slice(0, n);
    }
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) hintEl.hidden = true; }

    player.tick(dt, tAcc); crew.forEach(function (a) { a.tick(dt, tAcc); });

    // room tag
    roomTimer -= dt;
    if (roomTimer <= 0 && S.mode !== 'intro') {
      roomTimer = 0.25; var r2 = roomAt(player.x, player.z), nm = r2 ? r2.name : 'Outside', tag = $('roomtag');
      if (tag.textContent !== nm) tag.textContent = nm; tag.hidden = false;
    }

    // light follows player
    sun.target.position.set(player.x, 0, player.z); sun.position.set(player.x + SUNO.x, SUNO.y, player.z + SUNO.z);
    if (guide.tip) guide.tip.scale.setScalar(1 + 0.3 * Math.sin(tAcc * 4));
    if (stars.visible) stars.position.copy(camera.position);
    updateCamera(dt);
    W.update(dt, tAcc, movers, camera.position, camTarget);
    renderer.render(scene, camera);

    if (first) { first = false; $('loading').classList.add('off'); setTimeout(function () { $('loading').hidden = true; }, 700); }
  }

  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('600 40px Fredoka'), document.fonts.load('500 30px Fredoka'), document.fonts.load('700 40px Fredoka')]).then(function () { W.redraw.forEach(function (f) { f(); }); }).catch(function () { });
  }
  window.__office = { S: S, player: player, guide: guide, boss: boss, camera: camera, W: W, startTrip: startTrip, enterFree: enterFree, say: say };
  S.mode = 'intro';
  applyTheme(KIND);
  frame();
})();
