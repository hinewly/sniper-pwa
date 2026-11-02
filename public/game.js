/* 屋顶狙击 v0.4.0 —— 双模式（黄昏狙击 / 正午机枪）+ 蒙面匪 & 灰狼（关卡结构预留方案 C 任务制） */
(function () {
  "use strict";
  var APP_VERSION = "v0.4.0";
  var SAVE_KEY = "dbsniper-save-v2";
  var $ = function (id) { return document.getElementById(id); };
  var W = 900, H = 560; // 逻辑分辨率

  /* ---------- 关卡表（固定 10 关：5 关后明显加压，但保留可通关路线） ---------- */
  var BASE_LEVELS = [
    { quota: 5,  time: 60, spawnGap: 2000, showTime: 2600, runners: 0, flyers: 0, sway: 0.40, mission: null },
    { quota: 7,  time: 55, spawnGap: 1700, showTime: 2300, runners: 1, flyers: 1, sway: 0.55, mission: null },
    { quota: 9,  time: 55, spawnGap: 1500, showTime: 2000, runners: 2, flyers: 1, sway: 0.70, mission: null },
    { quota: 11, time: 50, spawnGap: 1300, showTime: 1800, runners: 2, flyers: 2, sway: 0.85, mission: null },
    { quota: 13, time: 50, spawnGap: 1100, showTime: 1600, runners: 3, flyers: 2, sway: 1.00, mission: null },
    { quota: 15, time: 48, spawnGap: 980,  showTime: 1450, runners: 3, flyers: 2, sway: 1.15, mission: null },
    { quota: 17, time: 46, spawnGap: 880,  showTime: 1300, runners: 3, flyers: 2, sway: 1.30, mission: null },
    { quota: 19, time: 44, spawnGap: 790,  showTime: 1180, runners: 4, flyers: 2, sway: 1.45, mission: null },
    { quota: 21, time: 42, spawnGap: 720,  showTime: 1080, runners: 4, flyers: 3, sway: 1.60, mission: null },
    { quota: 23, time: 42, spawnGap: 680,  showTime: 1000, runners: 4, flyers: 3, sway: 1.70, mission: null }
  ];
  var LEVEL_REWARDS = { 1: 10, 2: 20, 3: 50, 4: 80, 5: 100, 6: 200, 7: 300, 8: 400, 9: 500, 10: 700 };
  var MAX_LEVEL = BASE_LEVELS.length;
  var selectedLevel = 1;
  var MAG = 5, RELOAD_MS = 1800;
  /* 机枪参数 */
  var MG_RATE = 130, HEAT_SHOT = 7, COOL_RATE = 34, OVERHEAT_LOCK = 1600, MG_HEAD = 70, MG_BODY = 40;

  /* ---------- 双模式配色（狙击=黄昏金时刻 / 机枪=正午大晴天） ---------- */
  var PALETTES = {
    sniper: {
      skyTop: "#ffd9a0", skyMid: "#ffb277", skyBot: "#ef9668",
      sun: { x: 720, y: 128, r: 44, c: "#ffedbe" },
      clouds: false, haze: "rgba(255,196,130,.28)",
      bld: ["#b5795c", "#a86a52", "#c08a68", "#9c6350"],
      roof: "#7a523c", roofEdge: "#96684c",
      winLit: "rgba(255,216,140,.88)",
      road: "#8d7663", lane: "#ffdf9e",
      vignette: "rgba(120,64,26,.42)", ring: "#3a2314"
    },
    mg: {
      skyTop: "#8fd2ff", skyMid: "#abddff", skyBot: "#cdeeff",
      sun: { x: 756, y: 78, r: 34, c: "#fffbe6" },
      clouds: true, haze: "rgba(255,255,255,.16)",
      bld: ["#dccdaa", "#cbbb92", "#e2d5b8", "#c6b48c"],
      roof: "#b29668", roofEdge: "#cdb58a",
      winLit: "rgba(255,255,255,.6)",
      road: "#9c9c9c", lane: "#ffffff",
      vignette: "rgba(90,90,110,.45)", ring: "#233246"
    }
  };

  /* ---------- 存档（v2：双模式分开记最高分） ---------- */
  function loadSave() {
    try {
      var s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s) return s;
      var old = JSON.parse(localStorage.getItem("dbsniper-save-v1"));
      if (old && old.best) return { bestSniper: old.best, bestMg: 0, maxLevel: old.maxLevel || 0, muted: !!old.muted, mode: "sniper" };
    } catch (e) {}
    return {};
  }
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        bestSniper: save.bestSniper, bestMg: save.bestMg,
        maxLevel: save.maxLevel, muted: save.muted, mode: mode
      }));
    } catch (e) {}
  }
  var save = Object.assign({ bestSniper: 0, bestMg: 0, maxLevel: 0, muted: false, mode: "sniper" }, loadSave());

  /* ---------- 音效（WebAudio 合成，零素材） ---------- */
  var AC = null;
  function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return AC; }
  function noiseBurst(dur, freq, gain) {
    var a = ac(); if (!a || save.muted) return;
    var len = a.sampleRate * dur, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    var src = a.createBufferSource(); src.buffer = buf;
    var f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = freq;
    var g = a.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(a.destination); src.start();
  }
  function tone(f0, f1, dur, type, gain) {
    var a = ac(); if (!a || save.muted) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f0, a.currentTime);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, a.currentTime + dur);
    g.gain.setValueAtTime(gain || 0.15, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }
  var SFX = {
    shot: function () { noiseBurst(0.28, 1200, 0.95); tone(320, 70, 0.22, "square", 0.4); tone(180, 50, 0.3, "triangle", 0.35); },
    mgShot: function () { noiseBurst(0.1, 1600, 0.6); tone(420, 160, 0.07, "square", 0.28); tone(160, 90, 0.09, "triangle", 0.2); },
    head: function () { tone(880, 1500, 0.22, "sine", 0.3); noiseBurst(0.1, 2600, 0.3); },
    body: function () { tone(360, 120, 0.16, "square", 0.35); tone(160, 90, 0.16, "triangle", 0.25); },
    miss: function () { noiseBurst(0.06, 3000, 0.08); },
    empty: function () { tone(900, 700, 0.05, "square", 0.08); },
    overheat: function () { tone(320, 70, 0.55, "sawtooth", 0.16); },
    reload: function () { tone(500, 400, 0.06, "square", 0.1); setTimeout(function () { tone(650, 520, 0.06, "square", 0.1); }, 700); setTimeout(function () { tone(750, 600, 0.06, "square", 0.1); }, 1400); },
    clear: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone(f, f, 0.18, "sine", 0.18); }, i * 140); }); },
    over: function () { [392, 330, 262].forEach(function (f, i) { setTimeout(function () { tone(f, f, 0.3, "triangle", 0.18); }, i * 200); }); }
  };

  /* ---------- 场景 ---------- */
  var buildings = []; // {x,w,h,ci,windows:[{x,y,w,h}]}
  function buildCity() {
    buildings = [];
    var x = 0, seed = Math.random() * 9999;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    while (x < W) {
      var w = 120 + Math.floor(rnd() * 110);
      var h = 190 + Math.floor(rnd() * 190);
      var b = { x: x, w: w, h: h, ci: Math.floor(rnd() * 4), windows: [] };
      var cols = Math.floor((w - 24) / 52), rows = Math.floor((h - 30) / 62);
      for (var r = 0; r < rows; r++) for (var k = 0; k < cols; k++) {
        if (rnd() < 0.75) b.windows.push({ x: x + 14 + k * 52, y: 440 - h + 20 + r * 62, w: 30, h: 40 });
      }
      buildings.push(b);
      x += w + 8 + Math.floor(rnd() * 14);
    }
  }

  /* ---------- 游戏状态 ---------- */
  var state = "menu"; // menu | playing | paused | levelclear | gameover
  var paused = false;
  var mode = save.mode === "mg" ? "mg" : "sniper"; // sniper=黄昏狙击 / mg=正午机枪
  var previewMode = null; // 菜单悬停预览
  var level = 1, cfg = null;
  var score = 0, combo = 0, kills = 0, timeLeft = 0, mag = MAG, reloading = 0;
  var heat = 0, overheatLeft = 0, firing = false, mgCd = 0, muzzle = 0;
  var enemies = [], spawnTimer = 0, runnersAlive = 0, flyersAlive = 0;
  var holes = []; // 脱靶弹孔
  var floats = [];
  var aim = { x: W / 2, y: H / 2 };
  var lastT = 0, shake = 0;
  var canvas, ctx;

  /* ---------- AI 素材（Vidu 生成，白底抠图；未加载完成时回退代码绘制） ---------- */
  var SPRITES = {};
  ["sniper", "mg", "bandit-red", "bandit-blue", "wolf", "boss"].forEach(function (n) {
    var im = new Image(); im.src = "assets/" + n + ".png"; SPRITES[n] = im;
  });
  function spr(n) { var im = SPRITES[n]; return (im && im.complete && im.naturalWidth) ? im : null; }

  function paletteMode() { return (state === "menu" && previewMode) ? previewMode : mode; }
  function pal() { return PALETTES[paletteMode()]; }

  function startLevel(n, resetScore) {
    if (!(n >= 1 && n <= MAX_LEVEL)) n = 1;
    level = n;
    cfg = BASE_LEVELS[n - 1];
    if (mode === "mg") cfg = Object.assign({}, cfg, { runners: Math.min(6, cfg.runners + 2) });
    if (resetScore !== false) score = 0;
    combo = 0; kills = 0; timeLeft = cfg.time;
    if (mode === "sniper") { mag = MAG; reloading = 0; }
    else { heat = 0; overheatLeft = 0; mgCd = 0; firing = false; }
    enemies = []; holes = []; floats = []; spawnTimer = 400; runnersAlive = 0; flyersAlive = 0;
    buildCity();
    state = "playing";
    hideModals();
    applyHudMode();
    log(mode === "sniper"
      ? "第 " + n + " 关：黄昏潜伏，消灭 " + cfg.quota + " 只目标，限时 " + cfg.time + " 秒"
      : "第 " + n + " 关：正午扫射，消灭 " + cfg.quota + " 只目标，限时 " + cfg.time + " 秒");
    updateHud();
  }

  function spawnEnemy() {
    var isMg = mode === "mg";
    var wantFlyer = flyersAlive < cfg.flyers && Math.random() < 0.3;
    var wantRunner = runnersAlive < cfg.runners && Math.random() < (isMg ? 0.5 : 0.35);
    if (wantFlyer) {
      var fdir = Math.random() < 0.5 ? 1 : -1;
      enemies.push({
        type: "flyer", dir: fdir,
        x: fdir === 1 ? -30 : W + 30, y: 130 + Math.random() * 130,
        speed: (70 + Math.random() * 50) * cfg.sway + level * 4,
        state: "walk", anim: Math.random() * 7
      });
      flyersAlive++;
    } else if (wantRunner) {
      var dir = Math.random() < 0.5 ? 1 : -1;
      var wolf = level >= 2 && Math.random() < (isMg ? 0.45 : 0.35);
      enemies.push({
        type: wolf ? "wolf" : "runner", dir: dir,
        x: dir === 1 ? -40 : W + 40, y: 500, baseY: 500,
        speed: (wolf ? 95 + Math.random() * 45 : 55 + Math.random() * 40) * cfg.sway + level * 6,
        phase: Math.random() * 7, state: "walk", anim: 0
      });
      runnersAlive++;
    } else {
      var wins = [];
      buildings.forEach(function (b) { b.windows.forEach(function (w) { wins.push(w); }); });
      if (!wins.length) return;
      var w = wins[Math.floor(Math.random() * wins.length)];
      var boss = level >= 2 && Math.random() < 0.15;
      enemies.push({
        type: "peek", boss: boss, win: w, x: w.x + w.w / 2, y: w.y + w.h,
        phase: "rise", t: 0, showTime: boss ? cfg.showTime * 0.7 : cfg.showTime, anim: 0
      });
    }
  }

  /* ---------- 射击 ---------- */
  function reticle() { // 实际弹着点
    if (mode === "mg") return { x: aim.x, y: aim.y };
    var s = cfg ? cfg.sway : 1;
    var t = performance.now() / 1000;
    return { x: aim.x + Math.sin(t * 2.1) * 6 * s, y: aim.y + Math.sin(t * 3.3 + 1) * 4 * s };
  }

  function pickHit(p) {
    var hit = null, best = 1e9;
    enemies.forEach(function (e) {
      if (e.state === "dying" || e.state === "gone") return;
      if (e.type === "peek" && e.phase === "hide") return;
      var body = enemyBody(e);
      if (!body) return;
      var hx = body.hx - p.x, hy = body.hy - p.y;
      if (hx * hx + hy * hy <= body.hr * body.hr && body.hr * body.hr < best) { hit = { e: e, part: "head" }; best = body.hr * body.hr; }
      else if (p.x >= body.x && p.x <= body.x + body.w && p.y >= body.y && p.y <= body.y + body.h) { hit = { e: e, part: "body" }; }
    });
    return hit;
  }

  function registerHit(hit, p, basePts, headTxt) {
    combo++;
    var mult = Math.min(combo, 5);
    var pts = basePts * mult;
    score += pts;
    kills++;
    hit.e.state = "dying"; hit.e.anim = 0;
    if (hit.e.type === "runner" || hit.e.type === "wolf") runnersAlive--;
    if (hit.part === "head") { SFX.head(); floatText(p.x, p.y - 30, headTxt + " +" + pts, "#ffd66b"); }
    else { SFX.body(); floatText(p.x, p.y - 30, "+" + pts, "#9fe8b8"); }
    updateHud();
    if (kills >= cfg.quota) { setTimeout(levelClear, 600); }
  }

  function fire() {
    if (state !== "playing" || paused) return;
    if (mode === "mg") { mgFire(); return; }
    if (reloading > 0) return;
    if (mag <= 0) { SFX.empty(); startReload(); return; }
    mag--; shake = 7; SFX.shot();
    var p = reticle();
    var hit = pickHit(p);
    if (hit) registerHit(hit, p, hit.part === "head" ? 250 : 100, "正中");
    else {
      combo = 0; SFX.miss();
      holes.push({ x: p.x, y: p.y, t: 0 });
      floatText(p.x, p.y - 20, "脱靶", "#ff9d9d");
      updateHud();
    }
    if (mag === 0) startReload();
  }

  function mgFire() {
    if (overheatLeft > 0 || mgCd > 0) return;
    mgCd = MG_RATE;
    muzzle = 0.09;
    heat = Math.min(100, heat + HEAT_SHOT);
    shake = 3; SFX.mgShot();
    var s = 4 + heat * 0.16;
    var p = { x: aim.x + (Math.random() * 2 - 1) * s, y: aim.y + (Math.random() * 2 - 1) * s };
    var hit = pickHit(p);
    if (hit) registerHit(hit, p, hit.part === "head" ? MG_HEAD : MG_BODY, "正中");
    else {
      combo = 0;
      holes.push({ x: p.x, y: p.y, t: 0 });
    }
    if (heat >= 100) { overheatLeft = OVERHEAT_LOCK; SFX.overheat(); }
    updateHud();
  }

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    $("btn-pause").textContent = paused ? "▶" : "⏸";
    if (paused) { firing = false; $("pause-modal").classList.remove("hidden"); }
    else { $("pause-modal").classList.add("hidden"); lastT = performance.now(); }
  }

  function startReload() {
    if (mode !== "sniper") return;
    if (reloading > 0 || mag === MAG) return;
    reloading = RELOAD_MS; SFX.reload();
    updateHud();
  }

  function enemyBody(e) {
    var t = e.anim;
    if (e.type === "peek") {
      if (e.phase === "rise" && t < 0.5) return null;
      var hh = e.phase === "rise" ? Math.min(1, t / 0.3) : 1;
      if (e.boss) {
        var topB = e.win.y + e.win.h - 66 * hh;
        return { x: e.win.x + 4, y: topB, w: e.win.w - 8, h: 66 * hh, hx: e.x, hy: topB + 12, hr: 13 };
      }
      // 普通蒙面匪：贴图完整显示在窗口内，判定与可见区域一致
      return { x: e.win.x + 4, y: e.win.y, w: e.win.w - 8, h: e.win.h, hx: e.x, hy: e.win.y + 8, hr: 12 };
    }
    var bob = Math.sin(t * 9) * 5;
    var fly = e.type === "flyer" ? Math.sin(t * 6) * 14 : 0;
    if (e.type === "flyer") return { x: e.x - 17, y: e.y - 13 + fly, w: 34, h: 26, hx: e.x + e.dir * 13, hy: e.y - 3 + fly, hr: 11 };
    if (e.type === "wolf") {
      var wob = e.y - 500;
      return { x: e.x - 22, y: e.y - 30 + wob * 0.3, w: 44, h: 32, hx: e.x + e.dir * 15, hy: e.y - 22 + wob * 0.3, hr: 11 };
    }
    return { x: e.x - 16, y: e.y - 42 + Math.abs(bob), w: 32, h: 50, hx: e.x, hy: e.y - 34 + Math.abs(bob), hr: 12 };
  }

  /* ---------- 特效 ---------- */
  function floatText(x, y, txt, color) { floats.push({ x: x, y: y, txt: txt, color: color, t: 0 }); }

  /* ---------- 主循环 ---------- */
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - lastT) / 1000 || 0); lastT = now;
    if (state === "playing" && !paused) {
      timeLeft -= dt;
      if (timeLeft <= 0) { timeLeft = 0; firing = false; gameOver(); }
      if (mode === "sniper") {
        if (reloading > 0) { reloading -= dt * 1000; if (reloading <= 0) { reloading = 0; mag = MAG; updateHud(); } }
      } else {
        if (mgCd > 0) mgCd -= dt * 1000;
        if (overheatLeft > 0) {
          overheatLeft -= dt * 1000;
          heat = Math.max(0, heat - 70 * dt);
          if (overheatLeft <= 0) { overheatLeft = 0; updateHud(); }
        } else if (heat > 0) {
          var prevHeat = Math.round(heat);
          heat = Math.max(0, heat - COOL_RATE * dt);
          if (Math.round(heat) !== prevHeat) updateHud();
        }
        if (firing) fire();
      }
      spawnTimer -= dt * 1000;
      if (spawnTimer <= 0) { spawnEnemy(); spawnTimer = cfg.spawnGap * (0.7 + Math.random() * 0.6); }
      enemies.forEach(function (e) {
        e.anim = (e.anim || 0) + dt;
        if (e.type === "peek") {
          if (e.phase === "rise" && e.anim > 0.3) { e.phase = "show"; e.anim = 0; }
          else if (e.phase === "show" && e.anim > e.showTime / 1000) { e.phase = "hide"; e.anim = 0; }
          else if (e.phase === "hide" && e.anim > 0.25) { e.state = "gone"; }
        } else if ((e.type === "runner" || e.type === "flyer") && e.state === "walk") {
          e.x += e.speed * dt * e.dir;
          if (e.x < -50 || e.x > W + 50) { e.state = "gone"; if (e.type === "runner") runnersAlive--; else flyersAlive--; }
        } else if (e.type === "wolf" && e.state === "walk") {
          e.x += e.speed * dt * e.dir;
          e.y = e.baseY + Math.sin(e.anim * 2.6) * 38; // S 形走位
          if (e.x < -60 || e.x > W + 60) { e.state = "gone"; runnersAlive--; }
        } else if (e.state === "dying" && e.anim > 0.5) { e.state = "gone"; }
      });
      enemies = enemies.filter(function (e) { return e.state !== "gone"; });
      holes.forEach(function (h) { h.t += dt; });
      holes = holes.filter(function (h) { return h.t < 4; });
      floats.forEach(function (f) { f.t += dt; f.y -= 34 * dt; });
      floats = floats.filter(function (f) { return f.t < 1.1; });
      if (muzzle > 0) muzzle -= dt;
      if (shake > 0) shake = Math.max(0, shake - dt * 40);
      var tm = Math.ceil(timeLeft);
      if (tm !== lastShownTime) { lastShownTime = tm; updateHud(); }
    }
    render(now);
  }
  var lastShownTime = -1;

  /* ---------- 渲染 ---------- */
  function render(now) {
    var P = pal();
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // 天空
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, P.skyTop); sky.addColorStop(0.55, P.skyMid); sky.addColorStop(1, P.skyBot);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // 太阳
    ctx.save();
    ctx.shadowColor = "rgba(255,230,170,.8)"; ctx.shadowBlur = 40;
    ctx.fillStyle = P.sun.c;
    ctx.beginPath(); ctx.arc(P.sun.x, P.sun.y, P.sun.r, 0, 7); ctx.fill();
    ctx.restore();
    if (P.clouds) {
      ctx.fillStyle = "rgba(255,255,255,.85)";
      var drift = (now / 1000 * 6) % (W + 200) - 100;
      [[drift, 70, 1], [drift + 320, 120, 0.7], [drift + 620, 55, 0.85]].forEach(function (c) {
        ctx.beginPath();
        ctx.ellipse(c[0], c[1], 46 * c[2], 15 * c[2], 0, 0, 7);
        ctx.ellipse(c[0] + 30 * c[2], c[1] - 9 * c[2], 30 * c[2], 12 * c[2], 0, 0, 7);
        ctx.fill();
      });
    }
    // 楼
    buildings.forEach(function (b) {
      ctx.fillStyle = P.bld[b.ci]; ctx.fillRect(b.x, 440 - b.h, b.w, b.h);
      var occupied = {};
      b.windows.forEach(function (w) {
        var occ = enemies.some(function (e) { return e.type === "peek" && e.win === w && e.phase !== "gone"; });
        if (occ) { ctx.fillStyle = "rgba(45,30,18,.6)"; ctx.fillRect(w.x, w.y, w.w, w.h); }
        else { ctx.fillStyle = P.winLit; ctx.fillRect(w.x, w.y, w.w, w.h); }
      });
      ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = 2;
      ctx.strokeRect(b.x, 440 - b.h, b.w, b.h);
    });
    // 远景暖光/阳光雾
    ctx.fillStyle = P.haze; ctx.fillRect(0, 250, W, 200);
    // 街道
    ctx.fillStyle = P.road; ctx.fillRect(0, 440, W, 120);
    ctx.fillStyle = P.lane;
    for (var z = 0; z < W; z += 60) ctx.fillRect(z, 498, 34, 6);
    // 屋顶 + 玩家
    ctx.fillStyle = P.roof; ctx.fillRect(0, 44, W, 60);
    ctx.fillStyle = P.roofEdge; ctx.fillRect(0, 100, W, 8);
    drawPlayer();
    // 弹孔
    holes.forEach(function (h) {
      ctx.globalAlpha = Math.max(0, 1 - h.t / 4);
      ctx.fillStyle = "#2a2118"; ctx.beginPath(); ctx.arc(h.x, h.y, 4, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.beginPath(); ctx.arc(h.x, h.y, 7, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    });
    // 敌人
    enemies.forEach(function (e) { drawEnemy(e); });
    // 飘字
    floats.forEach(function (f) {
      ctx.globalAlpha = Math.max(0, 1 - f.t / 1.1);
      ctx.fillStyle = f.color; ctx.font = "bold 18px sans-serif"; ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 3;
      ctx.strokeText(f.txt, f.x, f.y);
      ctx.fillText(f.txt, f.x, f.y); ctx.textAlign = "left"; ctx.globalAlpha = 1;
    });

    if (state === "playing" && !paused) {
      var rc = reticle();
      if (mode === "sniper") {
        enemies.forEach(function (e) {
          if (e.state === "dying" || e.state === "gone") return;
          if (e.type === "peek" && e.phase === "hide") return;
          var b = enemyBody(e); if (!b) return;
          var ex = b.x + b.w / 2, ey = b.y - 14;
          if (Math.hypot(ex - rc.x, ey - rc.y) > 150) {
            ctx.strokeStyle = "rgba(255,80,80,.9)"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(ex, ey - 8, 6, 0, 7); ctx.stroke();
            ctx.fillStyle = "rgba(255,80,80,.9)"; ctx.beginPath(); ctx.arc(ex, ey - 8, 2, 0, 7); ctx.fill();
          }
        });
        drawScope();
      } else {
        drawMgCrosshair();
      }
    }
    ctx.restore();
  }

  /* ---------- 玩家（趴姿，狙击枪 / 机枪两套装备） ---------- */
  function drawPlayer() {
    var im = spr(mode === "mg" ? "mg" : "sniper");
    if (im) { drawPlayerSprite(im); return; }
    drawPlayerVector();
  }
  function drawPlayerSprite(im) {
    var w = 310, h = w * im.naturalHeight / im.naturalWidth;
    var x = 24, bottom = 104;
    ctx.save();
    ctx.drawImage(im, x, bottom - h, w, h);
    if (mode === "mg" && muzzle > 0) {
      var mx = x + w * 0.97, my = bottom - h * 0.42;
      ctx.fillStyle = "rgba(255,220,90,.95)";
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + 20, my - 9); ctx.lineTo(mx + 12, my); ctx.lineTo(mx + 24, my);
      ctx.lineTo(mx + 12, my + 5); ctx.lineTo(mx + 20, my + 13);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,150,60,.9)";
      ctx.beginPath(); ctx.arc(mx, my, 7, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  function drawPlayerVector() {
    ctx.save();
    ctx.translate(-300, 0);
    ctx.shadowColor = paletteMode() === "mg" ? "rgba(255,240,180,.6)" : "rgba(255,190,120,.65)";
    ctx.shadowBlur = 16;
    // 腿（先画，无辉光，两条分开 + 深色靴子）
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#8fa3cc"; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(452, 84); ctx.lineTo(388, 84); ctx.stroke();
    ctx.strokeStyle = "#7b90ba"; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(452, 93); ctx.lineTo(398, 95); ctx.stroke();
    ctx.fillStyle = "#4a5c7e";
    ctx.fillRect(356, 78, 34, 12); ctx.fillRect(368, 89, 32, 11);
    ctx.restore();
    // 沙袋
    ctx.fillStyle = "#8a7d5e";
    ctx.beginPath(); ctx.ellipse(560, 96, 28, 11, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(604, 98, 25, 10, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#a3946f";
    ctx.beginPath(); ctx.ellipse(582, 87, 25, 10, 0, 0, 7); ctx.fill();
    // 躯干
    ctx.fillStyle = "#b9c9e8";
    ctx.beginPath();
    ctx.moveTo(446, 98);
    ctx.quadraticCurveTo(452, 73, 492, 71);
    ctx.lineTo(498, 86);
    ctx.quadraticCurveTo(460, 96, 446, 98);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#f6f9ff"; ctx.lineWidth = 2; ctx.stroke();
    // 手臂
    ctx.strokeStyle = "#c6d5ee"; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(490, 78); ctx.lineTo(518, 88); ctx.stroke();
    // 头 + 头盔
    ctx.fillStyle = "#ffdfbb";
    ctx.beginPath(); ctx.arc(514, 66, 13, 0, 7); ctx.fill();
    ctx.fillStyle = "#a4b7d9";
    ctx.beginPath(); ctx.arc(514, 63, 15, Math.PI * 0.92, Math.PI * 2.08); ctx.fill();
    ctx.fillStyle = "#eef3fc"; ctx.fillRect(497, 57, 34, 5);
    ctx.fillStyle = "#273141";
    ctx.beginPath(); ctx.arc(522, 68, 2, 0, 7); ctx.fill();

    if (paletteMode() === "mg" || (state !== "menu" && mode === "mg")) {
      // 机枪：粗机匣 + 厚枪管 + 两脚架 + 弹链盒
      ctx.strokeStyle = "#2a3140"; ctx.lineWidth = 2;
      ctx.fillStyle = "#e8ecf6";
      ctx.beginPath();
      ctx.moveTo(486, 90); ctx.lineTo(500, 76); ctx.lineTo(514, 78); ctx.lineTo(504, 97); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillRect(504, 78, 54, 12); ctx.strokeRect(504, 78, 54, 12);          // 机匣
      ctx.fillStyle = "#dfe5f0"; ctx.fillRect(556, 80, 84, 8); ctx.strokeRect(556, 80, 84, 8); // 枪管
      ctx.fillRect(636, 76, 12, 14);                                            // 枪口
      ctx.fillStyle = "#39516e"; ctx.fillRect(526, 88, 16, 14);                 // 弹链盒
      ctx.strokeStyle = "#c3cfe2"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(600, 88); ctx.lineTo(594, 102); ctx.moveTo(608, 88); ctx.lineTo(614, 102); ctx.stroke();
      // 弹链
      ctx.strokeStyle = "#d9b45c"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(534, 92); ctx.lineTo(526, 94); ctx.stroke();
      // 枪口火光
      if (muzzle > 0) {
        ctx.fillStyle = "rgba(255,220,90,.95)";
        ctx.beginPath();
        ctx.moveTo(648, 83);
        ctx.lineTo(668, 74); ctx.lineTo(660, 83); ctx.lineTo(672, 83);
        ctx.lineTo(660, 88); ctx.lineTo(668, 96);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,150,60,.9)";
        ctx.beginPath(); ctx.arc(648, 83, 7, 0, 7); ctx.fill();
      }
      ctx.fillStyle = "#ff5a48"; ctx.beginPath(); ctx.arc(642, 78, 3, 0, 7); ctx.fill();
    } else {
      // 狙击枪
      ctx.strokeStyle = "#2a3140"; ctx.lineWidth = 2;
      ctx.fillStyle = "#f6f9ff";
      ctx.beginPath();
      ctx.moveTo(486, 90); ctx.lineTo(502, 75); ctx.lineTo(516, 77); ctx.lineTo(504, 97); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillRect(506, 77, 48, 9); ctx.strokeRect(506, 77, 48, 9);
      ctx.fillRect(514, 65, 34, 8); ctx.strokeRect(514, 65, 34, 8);
      ctx.fillStyle = "#8ce0ff";
      ctx.beginPath(); ctx.arc(548, 69, 4, 0, 7); ctx.fill();
      ctx.fillStyle = "#f6f9ff"; ctx.fillRect(552, 78, 86, 6); ctx.strokeRect(552, 78, 86, 6);
      ctx.fillRect(636, 76, 11, 10);
      ctx.strokeStyle = "#c3cfe2"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(600, 84); ctx.lineTo(596, 100); ctx.moveTo(604, 84); ctx.lineTo(610, 100); ctx.stroke();
      ctx.fillStyle = "#ff5a48"; ctx.beginPath(); ctx.arc(643, 81, 4, 0, 7); ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /* ---------- 敌人绘制 ---------- */
  function drawSpriteEnemy(e, im, body, cx) {
    var ar = im.naturalWidth / im.naturalHeight;
    if (e.type === "peek") {
      if (!e.boss) {
        ctx.save();
        ctx.beginPath(); ctx.rect(e.win.x - 2, e.win.y - 2, e.win.w + 4, e.win.h + 4); ctx.clip();
        var h1 = e.win.h + 4, w1 = h1 * ar;
        ctx.drawImage(im, cx - w1 / 2, e.win.y + e.win.h + 2 - h1, w1, h1);
        ctx.restore();
      } else {
        var h2 = 74, w2 = h2 * ar;
        ctx.drawImage(im, cx - w2 / 2, e.win.y + e.win.h + 6 - h2, w2, h2);
      }
    } else if (e.type === "runner") {
      var h3 = 58, w3 = h3 * ar;
      var bounce = Math.abs(Math.sin((e.anim || 0) * 9)) * 4;
      ctx.save();
      if (e.dir === -1) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
      ctx.drawImage(im, cx - w3 / 2, body.y + body.h - h3 + bounce, w3, h3);
      ctx.restore();
    } else if (e.type === "wolf") {
      var h4 = 44, w4 = h4 * ar;
      ctx.save();
      if (e.dir === -1) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
      ctx.drawImage(im, cx - w4 / 2, body.y + body.h - h4 + 8, w4, h4);
      ctx.restore();
    }
  }
  function drawEnemy(e) {
    var body = enemyBody(e);
    if (!body) return;
    var dieR = e.state === "dying" ? Math.min(1, e.anim / 0.5) : 0;
    ctx.save();
    if (e.type === "peek") {
      ctx.beginPath(); ctx.rect(e.win.x - 2, e.win.y - 2, e.win.w + 4, e.win.h + 4); ctx.clip();
    }
    ctx.translate(body.x + body.w / 2, body.y + body.h);
    if (dieR > 0) ctx.rotate(dieR * 2.4 * (e.x % 2 ? 1 : -1));
    ctx.translate(-(body.x + body.w / 2), -(body.y + body.h));
    ctx.globalAlpha = e.state === "dying" ? Math.max(0.1, 1 - dieR) : 1;
    ctx.shadowColor = "rgba(255,190,120,.8)"; ctx.shadowBlur = 12;
    ctx.lineCap = "round";
    var cx = body.x + body.w / 2;

    var spim = e.type === "peek" ? spr(e.boss ? "boss" : "bandit-red")
      : e.type === "runner" ? spr("bandit-blue")
      : e.type === "wolf" ? spr("wolf") : null;
    if (spim) { drawSpriteEnemy(e, spim, body, cx); ctx.restore(); return; }

    if (e.type === "peek") {
      var my = body.y + body.h;
      ctx.strokeStyle = "#f2ede4"; ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 10, my - 22); ctx.lineTo(cx - 15, my - 6);
      ctx.moveTo(cx + 10, my - 22); ctx.lineTo(cx + 15, my - 6);
      ctx.stroke();
      if (e.boss) {
        /* 金链老大：黑西装 + 墨镜 + 金链 + 礼帽 */
        ctx.strokeStyle = "#23262e"; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(cx, my - 20); ctx.lineTo(cx, my - 2); ctx.stroke();
        ctx.fillStyle = "#23262e";
        ctx.beginPath(); ctx.ellipse(cx, my - 16, 12, 15, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.moveTo(cx - 4, my - 26); ctx.lineTo(cx + 4, my - 26); ctx.lineTo(cx, my - 14); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#f5c542"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(cx, my - 16, 8, 0.3, Math.PI - 0.3); ctx.stroke();
        ctx.fillStyle = "#ffdfbb";
        ctx.beginPath(); ctx.arc(cx, my - 34, 11, 0, 7); ctx.fill();
        ctx.fillStyle = "#15161a";
        ctx.fillRect(cx - 9, my - 37, 18, 5);                       // 墨镜
        ctx.fillStyle = "#15161a";
        ctx.beginPath(); ctx.ellipse(cx, my - 44, 13, 4, 0, 0, 7); ctx.fill();  // 帽檐
        ctx.fillRect(cx - 8, my - 54, 16, 10);                      // 帽筒
      } else {
        /* 红头巾蒙面匪：只露眼睛 */
        ctx.strokeStyle = "#4a4f5c"; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(cx, my - 20); ctx.lineTo(cx, my - 2); ctx.stroke();
        ctx.fillStyle = "#4a4f5c";
        ctx.beginPath(); ctx.ellipse(cx, my - 16, 11, 14, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#ffdfbb";
        ctx.beginPath(); ctx.arc(cx, my - 34, 11, 0, 7); ctx.fill();
        ctx.fillStyle = "#e33f2f";
        ctx.beginPath(); ctx.arc(cx, my - 36, 11.5, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
        ctx.fillRect(cx - 11.5, my - 37, 23, 9);                    // 蒙面巾
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(cx - 4.5, my - 34, 2.6, 0, 7); ctx.arc(cx + 4.5, my - 34, 2.6, 0, 7); ctx.fill();
        ctx.fillStyle = "#222";
        ctx.beginPath(); ctx.arc(cx - 4.5, my - 34, 1.2, 0, 7); ctx.arc(cx + 4.5, my - 34, 1.2, 0, 7); ctx.fill();
      }
    } else if (e.type === "runner") {
      /* 蓝头巾蒙面匪：奔跑 + 拎小布包 */
      var ry = body.y + body.h;
      var leg = Math.sin((e.anim || 0) * 14) * 8;
      ctx.strokeStyle = "#3a3f4c"; ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx - 2, ry - 18); ctx.lineTo(cx - 8, ry - 2 + leg);
      ctx.moveTo(cx + 2, ry - 18); ctx.lineTo(cx + 8, ry - 2 - leg);
      ctx.stroke();
      ctx.fillStyle = "#3a3f4c";
      ctx.beginPath(); ctx.ellipse(cx, ry - 26, 12, 16, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = "#e8ecf4"; ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx + 2, ry - 32); ctx.lineTo(cx + 14, ry - 24 - leg * 0.4);
      ctx.moveTo(cx - 2, ry - 32); ctx.lineTo(cx - 12, ry - 22 + leg * 0.4);
      ctx.stroke();
      ctx.fillStyle = "#8a6238";                                     // 小布包
      ctx.beginPath(); ctx.ellipse(cx + 16, ry - 22 - leg * 0.4, 6, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#ffdfbb";
      ctx.beginPath(); ctx.arc(cx + e.dir * 4, ry - 46, 9.5, 0, 7); ctx.fill();
      ctx.fillStyle = "#3f7fd4";
      ctx.beginPath(); ctx.arc(cx + e.dir * 4, ry - 48, 10, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
      ctx.fillRect(cx + e.dir * 4 - 10, ry - 49, 20, 8);             // 蓝蒙面巾
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(cx + e.dir * 8, ry - 46, 2.2, 0, 7); ctx.fill();
      ctx.fillStyle = "#222";
      ctx.beginPath(); ctx.arc(cx + e.dir * 8, ry - 46, 1.1, 0, 7); ctx.fill();
    } else if (e.type === "wolf") {
      /* 灰狼：贴地疾跑 + 耳朵后贴 + 红项圈 */
      var wy = body.y + body.h;
      var wleg = Math.sin((e.anim || 0) * 18) * 9;
      ctx.strokeStyle = "#7d7f86"; ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 12, wy - 12); ctx.lineTo(cx - 17, wy - 1 + wleg);
      ctx.moveTo(cx + 10, wy - 12); ctx.lineTo(cx + 15, wy - 1 - wleg);
      ctx.stroke();
      ctx.fillStyle = "#8d8f96";
      ctx.beginPath(); ctx.ellipse(cx - 2, wy - 18, 19, 12, -0.08, 0, 7); ctx.fill(); // 身体
      ctx.beginPath(); ctx.arc(cx + e.dir * 17, wy - 24, 8.5, 0, 7); ctx.fill();      // 头
      ctx.fillStyle = "#7d7f86";
      ctx.beginPath(); ctx.moveTo(cx + e.dir * 20, wy - 28); ctx.lineTo(cx + e.dir * 12, wy - 36); ctx.lineTo(cx + e.dir * 21, wy - 33); ctx.closePath(); ctx.fill(); // 后贴耳
      ctx.beginPath(); ctx.moveTo(cx - e.dir * 18, wy - 20); ctx.lineTo(cx - e.dir * 30, wy - 26); ctx.lineTo(cx - e.dir * 28, wy - 16); ctx.closePath(); ctx.fill(); // 尾巴
      ctx.fillStyle = "#c9cbd2";
      ctx.beginPath(); ctx.ellipse(cx + e.dir * 6, wy - 24, 6, 4, 0, 0, 7); ctx.fill(); // 浅色腹毛
      ctx.fillStyle = "#e33f2f"; ctx.fillRect(cx + e.dir * 10, wy - 21, 5, 4);          // 红项圈
      ctx.fillStyle = "#222";
      ctx.beginPath(); ctx.arc(cx + e.dir * 19, wy - 26, 1.5, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.moveTo(cx + e.dir * 23, wy - 22); ctx.lineTo(cx + e.dir * 26, wy - 21); ctx.lineTo(cx + e.dir * 23, wy - 19); ctx.closePath(); ctx.fill(); // 牙
    } else if (e.type === "flyer") {
      /* 小鸟：蓝色 + 拍翅 + 红项圈 */
      var fy = body.y + body.h / 2;
      var flap = Math.sin((e.anim || 0) * 16) * 8;
      ctx.fillStyle = "#4d9be6";
      ctx.beginPath(); ctx.ellipse(cx, fy, 13, 9, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + e.dir * 11, fy - 5, 6.5, 0, 7); ctx.fill();
      ctx.strokeStyle = "#2f6fb2"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx - e.dir * 2, fy - 2); ctx.lineTo(cx - e.dir * 10, fy - 8 - flap); ctx.stroke();
      ctx.fillStyle = "#2f6fb2";
      ctx.beginPath(); ctx.moveTo(cx - e.dir * 12, fy); ctx.lineTo(cx - e.dir * 22, fy - 5); ctx.lineTo(cx - e.dir * 21, fy + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f2a33c";
      ctx.beginPath(); ctx.moveTo(cx + e.dir * 17, fy - 5); ctx.lineTo(cx + e.dir * 24, fy - 3); ctx.lineTo(cx + e.dir * 17, fy - 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#3a3a3a"; ctx.beginPath(); ctx.arc(cx + e.dir * 12, fy - 7, 1.5, 0, 7); ctx.fill();
      ctx.fillStyle = "#e33f2f"; ctx.fillRect(cx + e.dir * 6, fy - 3, 4, 8);
    }
    ctx.restore();
  }

  /* ---------- 瞄准 UI ---------- */
  function drawScope() {
    var P = pal();
    var p = reticle();
    var R = 150;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H);
    ctx.moveTo(p.x + R, p.y);
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2, false);
    ctx.fillStyle = P.vignette; ctx.fill("evenodd");
    ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 7);
    ctx.strokeStyle = P.ring; ctx.lineWidth = 10; ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y, R - 6, 0, 7);
    ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = "rgba(255,60,60,.95)"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - R, p.y); ctx.lineTo(p.x - R / 2.4, p.y);
    ctx.moveTo(p.x + R / 2.4, p.y); ctx.lineTo(p.x + R, p.y);
    ctx.moveTo(p.x, p.y - R); ctx.lineTo(p.x, p.y - R / 2.4);
    ctx.moveTo(p.x, p.y + R / 2.4); ctx.lineTo(p.x, p.y + R);
    ctx.stroke();
    ctx.fillStyle = "#f33"; ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, 7); ctx.fill();
    if (reloading > 0) {
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(p.x - 60, p.y + R + 6, 120, 26);
      ctx.fillStyle = "#ffd66b"; ctx.font = "14px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("装填中… " + (reloading / 1000).toFixed(1) + "s", p.x, p.y + R + 24);
      ctx.textAlign = "left";
    }
    ctx.restore();
  }

  function drawMgCrosshair() {
    var p = aim;
    ctx.save();
    ctx.strokeStyle = "rgba(30,40,55,.85)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 24, 0, 7); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x - 34, p.y); ctx.lineTo(p.x - 14, p.y);
    ctx.moveTo(p.x + 14, p.y); ctx.lineTo(p.x + 34, p.y);
    ctx.moveTo(p.x, p.y - 34); ctx.lineTo(p.x, p.y - 14);
    ctx.moveTo(p.x, p.y + 14); ctx.lineTo(p.x, p.y + 34);
    ctx.stroke();
    ctx.fillStyle = "#f33"; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 7); ctx.fill();
    if (overheatLeft > 0) {
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(p.x - 60, p.y + 42, 120, 26);
      ctx.fillStyle = "#ff9d9d"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("过热冷却… " + (overheatLeft / 1000).toFixed(1) + "s", p.x, p.y + 60);
      ctx.textAlign = "left";
    }
    ctx.restore();
  }

  /* ---------- HUD / 弹窗 ---------- */
  function applyHudMode() {
    var mg = mode === "mg";
    $("hud-mag-label").textContent = mg ? "枪管" : "弹匣";
    $("btn-reload").style.display = mg ? "none" : "";
  }
  function updateHud() {
    var mg = mode === "mg";
    $("hud-time").textContent = state === "playing" ? Math.ceil(timeLeft) + "s" : "—";
    if (mg) {
      $("hud-mag").textContent = overheatLeft > 0 ? "过热!" : Math.round(heat) + "%";
      $("hud-mag").className = (overheatLeft > 0 || heat > 70) ? "warn" : "";
    } else {
      $("hud-mag").textContent = reloading > 0 ? "装填中" : mag + "/" + MAG;
      $("hud-mag").className = reloading > 0 ? "warn" : "";
    }
    $("hud-score").textContent = score;
    $("hud-combo").textContent = combo > 1 ? "连击 x" + Math.min(combo, 5) : "";
    $("hud-level").textContent = "第 " + level + " 关 · 剩余 " + Math.max(0, cfg ? cfg.quota - kills : 0) + " 只";
  }
  function log(msg) { $("hud-level").textContent = msg; }
  function hideModals() { ["menu", "clear-modal", "over-modal"].forEach(function (id) { $(id).classList.add("hidden"); }); }
  function bestOf() { return mode === "sniper" ? save.bestSniper : save.bestMg; }
  function unlockedLevel() {
    return Math.min(MAX_LEVEL, Math.max(1, save.maxLevel || 1));
  }
  function renderLevelChips() {
    var unlocked = unlockedLevel();
    if (selectedLevel > unlocked) selectedLevel = 1;
    var wrap = $("level-chips");
    wrap.innerHTML = "";
    for (var i = 1; i <= MAX_LEVEL; i++) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "level-chip" + (i === selectedLevel ? " active" : "");
      b.textContent = i;
      b.disabled = i > unlocked;
      b.title = i > unlocked ? "通过第 " + (i - 1) + " 关后解锁" : "从第 " + i + " 关开始";
      b.addEventListener("click", function (ev) {
        var n = Number(ev.currentTarget.textContent);
        if (n <= unlockedLevel()) { selectedLevel = n; renderLevelChips(); }
      });
      wrap.appendChild(b);
    }
  }
  function showMenu() {
    state = "menu"; previewMode = null;
    renderLevelChips();
    $("menu").classList.remove("hidden");
    $("menu-best").textContent =
      "🎯 狙击最高 " + (save.bestSniper || 0) + " · 🔫 机枪最高 " + (save.bestMg || 0) +
      (save.maxLevel ? " · 最远第 " + unlockedLevel() + " 关" : " · 首次出击，祝好运！");
  }
  function setClearReward(cls, text) {
    var el = $("clear-reward");
    el.className = "reward-box" + (cls ? " " + cls : "");
    el.textContent = text;
  }
  function claimLevelReward() {
    var n = LEVEL_REWARDS[level] || 0;
    if (!n) return;
    var loggedIn = !!(window.DaoBox && DaoBox.user);
    if (!loggedIn) {
      var loginUrl = (window.DaoBox && DaoBox.loginUrl) ? DaoBox.loginUrl()
        : (window.DB_HOME || "https://daobox.app") + "/login?src=sniper&redirect=" + encodeURIComponent(location.href);
      setClearReward("guest", "");
      var el = $("clear-reward");
      el.innerHTML = "🎖 首通奖励 +" + n + " 积分 · <a href=\"" + loginUrl + "\" style=\"color:#b05c22;font-weight:700\">登录后可领</a>";
      return;
    }
    setClearReward("", "⭐ 积分奖励入账中…");
    fetch((window.DB_HOME || "https://daobox.app") + "/api/reward/game/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        app: "sniper", mode: mode, level: level, score: score,
        requestId: "sniper-v1-" + mode + "-" + level
      })
    }).then(function (r) { return r.json().catch(function () { return {}; }); }).then(function (d) {
      if (d && d.ok) {
        setClearReward(d.gained > 0 ? "" : "guest",
          d.gained > 0 ? "⭐ 首通奖励 +" + d.gained + " 积分已到账" : "⭐ 本关首通积分已领过");
      } else {
        setClearReward("error", "⭐ +" + n + " 积分奖励暂未到账，可稍后重试");
      }
    }).catch(function () {
      setClearReward("error", "⭐ +" + n + " 积分奖励暂未到账，可稍后重试");
    });
  }
  function levelClear() {
    state = "levelclear"; SFX.clear();
    var firstRun = level > save.maxLevel;
    if (score > bestOf()) { if (mode === "sniper") save.bestSniper = score; else save.bestMg = score; }
    if (level > save.maxLevel) save.maxLevel = level;
    persist();
    var final = level >= MAX_LEVEL;
    $("clear-info").textContent = (final ? "🎉 全部通关！第 10 关完成！" : "第 " + level + " 关完成！") +
      " 得分 " + score + "（最高 " + bestOf() + "）";
    $("btn-next").textContent = final ? "再战第 10 关" : "下一关 →";
    setClearReward("", "⭐ 积分奖励确认中…");
    claimLevelReward();
    $("clear-modal").classList.remove("hidden");
    updateHud();
  }
  function gameOver() {
    state = "gameover"; SFX.over();
    if (score > bestOf()) { if (mode === "sniper") save.bestSniper = score; else save.bestMg = score; }
    if (level > save.maxLevel) save.maxLevel = level;
    persist();
    $("over-info").textContent = "第 " + level + " 关 · 得分 " + score + " · " +
      (mode === "sniper" ? "狙击" : "机枪") + "最高分 " + bestOf();
    $("over-modal").classList.remove("hidden");
    updateHud();
  }

  /* ---------- 输入 ---------- */
  function toLogical(ev) {
    var r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height };
  }
  function bindInput() {
    canvas.addEventListener("pointermove", function (ev) {
      var p = toLogical(ev); aim.x = p.x; aim.y = p.y;
    });
    canvas.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      var p = toLogical(ev);
      if (ac() && ac().state === "suspended") ac().resume();
      if (state !== "playing") return;
      if (mode === "sniper") {
        var c = reticle();
        var dist = Math.hypot(p.x - c.x, p.y - c.y);
        if (dist <= 150 * 0.96) { fire(); }
        else { aim.x = p.x; aim.y = p.y; }
      } else {
        aim.x = p.x; aim.y = p.y;
        firing = true;
        fire();
      }
    });
    function stopFire() { firing = false; }
    window.addEventListener("pointerup", stopFire);
    window.addEventListener("pointercancel", stopFire);
    canvas.addEventListener("pointerleave", stopFire);
    window.addEventListener("keydown", function (ev) {
      if (ev.key === "r" || ev.key === "R") startReload();
    });
    window.addEventListener("blur", stopFire);
  }

  /* ---------- 时长体系 ---------- */
  function applyTimeLock() { if (state === "playing") { firing = false; state = "gameover"; } $("time-lock").classList.remove("hidden"); }
  window.addEventListener("daobox:timeexceeded", applyTimeLock);

  /* ---------- 启动 ---------- */
  function setMode(m) {
    mode = m;
    previewMode = null;
    persist();
  }
  function boot() {
    $("app-version").textContent = APP_VERSION;
    canvas = $("game"); ctx = canvas.getContext("2d");
    canvas.width = W; canvas.height = H;
    bindInput();
    $("refresh-btn").addEventListener("click", function () {
      if ("caches" in window) caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }).finally(function () { location.reload(); });
      else location.reload();
    });
    // 模式按钮：悬停预览场景 + 切规则说明；点击 = 选定并开局
    function hookModeBtn(btnId, m) {
      var btn = $(btnId);
      btn.addEventListener("mouseenter", function () { if (state === "menu") previewMode = m; });
      btn.addEventListener("mouseleave", function () { if (state === "menu") previewMode = null; });
      btn.addEventListener("click", function () {
        if (ac() && ac().state === "suspended") ac().resume();
        setMode(m);
        startLevel(selectedLevel, true);
      });
    }
    hookModeBtn("btn-mode-sniper", "sniper");
    hookModeBtn("btn-mode-mg", "mg");
    $("btn-next").addEventListener("click", function () { startLevel(level >= MAX_LEVEL ? MAX_LEVEL : level + 1, true); });
    $("btn-retry").addEventListener("click", function () { startLevel(level, true); });
    $("btn-menu").addEventListener("click", showMenu);
    $("btn-clear-menu").addEventListener("click", showMenu);
    $("btn-reload").addEventListener("click", startReload);
    $("btn-pause").addEventListener("click", togglePause);
    $("btn-resume").addEventListener("click", togglePause);
    $("btn-quit").addEventListener("click", function () { paused = false; firing = false; $("btn-pause").textContent = "⏸"; $("pause-modal").classList.add("hidden"); showMenu(); applyHudMode(); updateHud(); });
    $("btn-mute").addEventListener("click", function () { save.muted = !save.muted; persist(); $("btn-mute").textContent = save.muted ? "🔇" : "🔊"; });
    if (save.muted) $("btn-mute").textContent = "🔇";
    $("lock-close").addEventListener("click", function () { $("time-lock").classList.add("hidden"); showMenu(); });
    buildCity();
    showMenu();
    applyHudMode();
    updateHud();
    requestAnimationFrame(frame);
    setTimeout(function () { try { if (window.DaoBox && window.DaoBox.timeExceeded) applyTimeLock(); } catch (e) {} }, 1200);
  }
  // E2E 测试钩子（不影响正常玩法）
  window.__sniperTest = {
    state: function () { return state; },
    paused: function () { return paused; },
    mode: function () { return mode; },
    togglePause: togglePause,
    enemies: function () { return enemies; },
    aim: aim,
    fire: fire,
    score: function () { return score; },
    startLevel: startLevel,
    levelClear: levelClear,
    setMode: setMode
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
