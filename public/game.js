/* 火柴人狙击 v0.1.0 —— 方案 B（关卡结构预留方案 C 任务制） */
(function () {
  "use strict";
  var APP_VERSION = "v0.2.1";
  var SAVE_KEY = "dbsniper-save-v1";
  var $ = function (id) { return document.getElementById(id); };
  var W = 900, H = 560; // 逻辑分辨率

  /* ---------- 关卡表（预留任务字段 mission，方案 C 用） ---------- */
  var BASE_LEVELS = [
    { quota: 5,  time: 60, spawnGap: 2000, showTime: 2600, runners: 0, flyers: 0, sway: 0.4, mission: null },
    { quota: 7,  time: 55, spawnGap: 1700, showTime: 2300, runners: 1, flyers: 1, sway: 0.55, mission: null },
    { quota: 9,  time: 55, spawnGap: 1500, showTime: 2000, runners: 2, flyers: 1, sway: 0.7, mission: null },
    { quota: 11, time: 50, spawnGap: 1300, showTime: 1800, runners: 2, flyers: 2, sway: 0.85, mission: null },
    { quota: 13, time: 50, spawnGap: 1100, showTime: 1600, runners: 3, flyers: 2, sway: 1.0, mission: null }
  ];
  function levelOf(n) {
    if (n <= BASE_LEVELS.length) return BASE_LEVELS[n - 1];
    var b = BASE_LEVELS[BASE_LEVELS.length - 1];
    var k = n - BASE_LEVELS.length;
    return {
      quota: b.quota + 2 * k,
      time: 50,
      spawnGap: Math.max(700, b.spawnGap * Math.pow(0.92, k)),
      showTime: Math.max(900, b.showTime * Math.pow(0.92, k)),
      runners: Math.min(4, b.runners + k),
      flyers: Math.min(3, b.flyers + k),
      sway: Math.min(1.6, b.sway + 0.15 * k),
      mission: null
    };
  }
  var MAG = 5, RELOAD_MS = 1800;

  /* ---------- 存档 ---------- */
  function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ best: save.best, maxLevel: save.maxLevel, muted: save.muted })); } catch (e) {} }
  var save = Object.assign({ best: 0, maxLevel: 0, muted: false }, loadSave());

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
    shot: function () { noiseBurst(0.22, 900, 0.5); tone(180, 60, 0.18, "triangle", 0.3); },
    head: function () { tone(880, 1500, 0.22, "sine", 0.22); noiseBurst(0.1, 2400, 0.18); },
    body: function () { tone(160, 90, 0.16, "triangle", 0.25); },
    miss: function () { noiseBurst(0.06, 3000, 0.08); },
    empty: function () { tone(900, 700, 0.05, "square", 0.08); },
    reload: function () { tone(500, 400, 0.06, "square", 0.1); setTimeout(function () { tone(650, 520, 0.06, "square", 0.1); }, 700); setTimeout(function () { tone(750, 600, 0.06, "square", 0.1); }, 1400); },
    clear: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone(f, f, 0.18, "sine", 0.18); }, i * 140); }); },
    over: function () { [392, 330, 262].forEach(function (f, i) { setTimeout(function () { tone(f, f, 0.3, "triangle", 0.18); }, i * 200); }); }
  };

  /* ---------- 场景 ---------- */
  var buildings = []; // {x,w,h,color,windows:[{x,y,w,h}]}
  function buildCity() {
    buildings = [];
    var x = 0, seed = Math.random() * 9999;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    while (x < W) {
      var w = 120 + Math.floor(rnd() * 110);
      var h = 190 + Math.floor(rnd() * 190);
      var col = ["#2f3e50", "#3a4a5e", "#34435a", "#2c3b4d"][Math.floor(rnd() * 4)];
      var b = { x: x, w: w, h: h, color: col, windows: [] };
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
  var level = 1, cfg = null;
  var score = 0, combo = 0, kills = 0, timeLeft = 0, mag = MAG, reloading = 0;
  var enemies = [], spawnTimer = 0, runnersAlive = 0, flyersAlive = 0;
  var holes = []; // 脱靶弹孔
  var aim = { x: W / 2, y: H / 2 }; // 指针位置（逻辑坐标）
  var lastT = 0, shake = 0;
  var canvas, ctx;

  function startLevel(n) {
    level = n; cfg = levelOf(n);
    score = level === 1 ? 0 : score; // 关卡间累计
    combo = 0; kills = 0; timeLeft = cfg.time; mag = MAG; reloading = 0;
    enemies = []; holes = []; spawnTimer = 400; runnersAlive = 0; flyersAlive = 0;
    buildCity();
    state = "playing";
    hideModals();
    log("第 " + n + " 关：消灭 " + cfg.quota + " 只目标，限时 " + cfg.time + " 秒");
  }

  function spawnEnemy() {
    var wantFlyer = flyersAlive < cfg.flyers && Math.random() < 0.3;
    var wantRunner = runnersAlive < cfg.runners && Math.random() < 0.35;
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
      enemies.push({
        type: "runner", dir: dir,
        x: dir === 1 ? -30 : W + 30, y: 500,
        speed: (55 + Math.random() * 40) * cfg.sway + level * 6,
        phase: Math.random() * 7, state: "walk", anim: 0
      });
      runnersAlive++;
    } else {
      var wins = [];
      buildings.forEach(function (b) { b.windows.forEach(function (w) { wins.push(w); }); });
      if (!wins.length) return;
      var w = wins[Math.floor(Math.random() * wins.length)];
      enemies.push({
        type: "peek", win: w, x: w.x + w.w / 2, y: w.y + w.h,
        phase: "rise", t: 0, showTime: cfg.showTime, anim: 0
      });
    }
  }

  /* ---------- 射击 ---------- */
  function reticle() { // 呼吸晃动后的实际弹着点
    var s = cfg ? cfg.sway : 1;
    var t = performance.now() / 1000;
    return { x: aim.x + Math.sin(t * 2.1) * 6 * s, y: aim.y + Math.sin(t * 3.3 + 1) * 4 * s };
  }

  function fire() {
    if (state !== "playing" || paused) return;
    if (reloading > 0) return;
    if (mag <= 0) { SFX.empty(); startReload(); return; }
    mag--; shake = 7; SFX.shot();
    var p = reticle();
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
    if (hit) {
      combo++;
      var mult = Math.min(combo, 5);
      var pts = (hit.part === "head" ? 250 : 100) * mult;
      score += pts;
      kills++;
      hit.e.state = "dying"; hit.e.anim = 0;
      if (hit.e.type === "runner") runnersAlive--;
      if (hit.part === "head") { SFX.head(); floatText(p.x, p.y - 30, "正中 +" + pts, "#ffd66b"); }
      else { SFX.body(); floatText(p.x, p.y - 30, "+" + pts, "#9fe8b8"); }
      updateHud();
      if (kills >= cfg.quota) { setTimeout(levelClear, 600); }
    } else {
      combo = 0; SFX.miss();
      holes.push({ x: p.x, y: p.y, t: 0 });
      floatText(p.x, p.y - 20, "脱靶", "#ff9d9d");
      updateHud();
    }
    if (mag === 0) startReload();
  }

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    $("btn-pause").textContent = paused ? "▶" : "⏸";
    if (paused) { $("pause-modal").classList.remove("hidden"); }
    else { $("pause-modal").classList.add("hidden"); lastT = performance.now(); }
  }

  function startReload() {
    if (reloading > 0 || mag === MAG) return;
    reloading = RELOAD_MS; SFX.reload();
    updateHud();
  }

  function enemyBody(e) {
    var t = e.anim;
    if (e.type === "peek") {
      if (e.phase === "rise" && t < 0.5) return null; // 还没露头
      var hh = e.phase === "rise" ? Math.min(1, t / 0.3) : 1;
      var top = e.win.y + e.win.h - 66 * hh;
      return { x: e.win.x + 4, y: top, w: e.win.w - 8, h: 66 * hh, hx: e.x, hy: top + 10, hr: 13 };
    }
    var bob = Math.sin(t * 9) * 5;                                  // 兔子蹦跳
    var fly = e.type === "flyer" ? Math.sin(t * 6) * 14 : 0;        // 小鸟起伏
    if (e.type === "flyer") return { x: e.x - 17, y: e.y - 13 + fly, w: 34, h: 26, hx: e.x + e.dir * 13, hy: e.y - 3 + fly, hr: 11 };
    return { x: e.x - 16, y: e.y - 42 + Math.abs(bob), w: 32, h: 50, hx: e.x, hy: e.y - 34 + Math.abs(bob), hr: 12 };
  }

  /* ---------- 特效 ---------- */
  var floats = [];
  function floatText(x, y, txt, color) { floats.push({ x: x, y: y, txt: txt, color: color, t: 0 }); }

  /* ---------- 主循环 ---------- */
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - lastT) / 1000 || 0); lastT = now;
    if (state === "playing" && !paused) {
      timeLeft -= dt;
      if (timeLeft <= 0) { timeLeft = 0; gameOver(); }
      if (reloading > 0) { reloading -= dt * 1000; if (reloading <= 0) { reloading = 0; mag = MAG; updateHud(); } }
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
          if (e.x < -40 || e.x > W + 40) { e.state = "gone"; if (e.type === "runner") runnersAlive--; else flyersAlive--; }
        } else if (e.state === "dying" && e.anim > 0.5) { e.state = "gone"; }
      });
      enemies = enemies.filter(function (e) { return e.state !== "gone"; });
      holes.forEach(function (h) { h.t += dt; });
      holes = holes.filter(function (h) { return h.t < 4; });
      floats.forEach(function (f) { f.t += dt; f.y -= 34 * dt; });
      floats = floats.filter(function (f) { return f.t < 1.1; });
      if (shake > 0) shake = Math.max(0, shake - dt * 40);
      var tm = Math.ceil(timeLeft);
      if (tm !== lastShownTime) { lastShownTime = tm; updateHud(); }
    }
    render(now);
  }
  var lastShownTime = -1;

  /* ---------- 渲染 ---------- */
  function render(now) {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // 天空
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#26334d"); sky.addColorStop(1, "#5c6b73");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // 月亮
    ctx.fillStyle = "rgba(240,240,210,.9)"; ctx.beginPath(); ctx.arc(120, 90, 26, 0, 7); ctx.fill();
    // 楼
    buildings.forEach(function (b) {
      ctx.fillStyle = b.color; ctx.fillRect(b.x, 440 - b.h, b.w, b.h);
      ctx.fillStyle = "rgba(255,235,150,.75)";
      b.windows.forEach(function (w) {
        var occupied = enemies.some(function (e) { return e.type === "peek" && e.win === w && e.phase !== "gone"; });
        if (!occupied) ctx.fillRect(w.x, w.y, w.w, w.h);
      });
    });
    // 街道
    ctx.fillStyle = "#3d3d3d"; ctx.fillRect(0, 440, W, 120);
    ctx.fillStyle = "#e8c56b";
    for (var z = 0; z < W; z += 60) ctx.fillRect(z, 498, 34, 6);
    // 屋顶前沿：玩家狙击位（俯卧 + 步枪 + 瞄准镜）
    ctx.fillStyle = "#181d2a"; ctx.fillRect(0, 44, W, 56);
    ctx.fillStyle = "#2d3446"; ctx.fillRect(0, 96, W, 8);
    // 狙击手：亮色画，保证一眼可见
    ctx.save();
    ctx.shadowColor = "rgba(160,200,255,.55)"; ctx.shadowBlur = 14;
    ctx.fillStyle = "#5d729e";                                              // 作训服（亮蓝灰）
    ctx.beginPath(); ctx.ellipse(470, 87, 58, 16, 0, 0, 7); ctx.fill();     // 俯卧身体
    ctx.strokeStyle = "#c9d6ee"; ctx.lineWidth = 1.5; ctx.stroke();         // 白描边
    ctx.fillStyle = "#f7d9b8";                                              // 脸（肤色）
    ctx.beginPath(); ctx.arc(538, 80, 11, 0, 7); ctx.fill();
    ctx.fillStyle = "#39506e";                                              // 头盔
    ctx.beginPath(); ctx.arc(538, 78, 11, Math.PI, 0); ctx.fill();
    ctx.fillRect(524, 74, 28, 5);
    ctx.fillStyle = "#c9d6ee"; ctx.fillRect(524, 76, 28, 3);                // 盔沿高光
    ctx.fillStyle = "#e8ecf4";                                              // 步枪（亮金属）
    ctx.beginPath(); ctx.moveTo(544, 84); ctx.lineTo(640, 122); ctx.lineTo(644, 130); ctx.lineTo(548, 96); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#39506e";                                              // 瞄准镜筒
    ctx.fillRect(576, 90, 36, 12);
    ctx.fillStyle = "#7fd4ff";                                              // 镜片反光
    ctx.beginPath(); ctx.arc(610, 96, 4, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    // 弹孔
    holes.forEach(function (h) {
      ctx.globalAlpha = Math.max(0, 1 - h.t / 4);
      ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.arc(h.x, h.y, 4, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(h.x, h.y, 7, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    });
    // 敌人
    enemies.forEach(function (e) { drawEnemy(e); });
    // 瞄准镜外的敌人：头顶红色小箭头提示方位（难度靠跑动，不靠藏）
    // 飘字
    floats.forEach(function (f) {
      ctx.globalAlpha = Math.max(0, 1 - f.t / 1.1);
      ctx.fillStyle = f.color; ctx.font = "bold 18px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(f.txt, f.x, f.y); ctx.textAlign = "left"; ctx.globalAlpha = 1;
    });

    if (state === "playing" && !paused) {
      var rc = reticle();
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
    }
    ctx.restore();
  }

  function drawEnemy(e) {
    var body = enemyBody(e);
    if (!body) return; // 探头动画早期还没有可命中区域
    var dieR = e.state === "dying" ? Math.min(1, e.anim / 0.5) : 0;
    ctx.save();
    if (e.type === "peek") {
      ctx.beginPath(); ctx.rect(e.win.x - 2, e.win.y - 2, e.win.w + 4, e.win.h + 4); ctx.clip();
    }
    // 死亡：翻倒 + 淡出
    ctx.translate(body.x + body.w / 2, body.y + body.h);
    if (dieR > 0) ctx.rotate(dieR * 2.4 * (e.x % 2 ? 1 : -1));
    ctx.translate(-(body.x + body.w / 2), -(body.y + body.h));
    ctx.globalAlpha = e.state === "dying" ? Math.max(0.1, 1 - dieR) : 1;
    ctx.shadowColor = "rgba(255,190,120,.8)"; ctx.shadowBlur = 12;
    ctx.lineCap = "round";

    var cx = body.x + body.w / 2;

    if (e.type === "peek") {
      /* 猴子：棕色 + 浅脸 + 大圆耳 + 卷尾 + 红头巾 */
      var my = body.y + body.h;
      ctx.strokeStyle = "#f2ede4"; ctx.lineWidth = 5;
      ctx.beginPath();                                            // 手臂扒窗沿
      ctx.moveTo(cx - 10, my - 22); ctx.lineTo(cx - 15, my - 6);
      ctx.moveTo(cx + 10, my - 22); ctx.lineTo(cx + 15, my - 6);
      ctx.stroke();
      ctx.strokeStyle = "#a4663a"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(cx, my - 20); ctx.lineTo(cx, my - 2); ctx.stroke();  // 身体
      ctx.strokeStyle = "#a4663a"; ctx.lineWidth = 3.5;
      ctx.beginPath();                                            // 卷尾巴
      ctx.arc(cx + 13, my - 8, 7, -Math.PI / 2, Math.PI * 0.9); ctx.stroke();
      ctx.fillStyle = "#a4663a";                                  // 头
      ctx.beginPath(); ctx.arc(cx, my - 34, 11, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - 10, my - 40, 4.5, 0, 7); ctx.arc(cx + 10, my - 40, 4.5, 0, 7); ctx.fill(); // 耳
      ctx.fillStyle = "#e8c39a";                                  // 脸
      ctx.beginPath(); ctx.ellipse(cx, my - 31, 6.5, 8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#e33f2f"; ctx.fillRect(cx - 11, my - 42, 22, 5);  // 红头巾
    } else if (e.type === "runner") {
      /* 兔子：白色 + 长耳 + 蹦跳 + 红蝴蝶结 */
      var ry = body.y + body.h;
      ctx.fillStyle = "#f4f2ec";
      ctx.beginPath(); ctx.ellipse(cx, ry - 16, 14, 17, 0, 0, 7); ctx.fill();   // 身体
      ctx.beginPath(); ctx.arc(cx + 6, ry - 36, 9, 0, 7); ctx.fill();           // 头
      var ear = Math.sin((e.anim || 0) * 9) * 0.15;
      ctx.beginPath(); ctx.ellipse(cx + 2, ry - 52, 3.5, 12, ear, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 9, ry - 51, 3.5, 12, -ear, 0, 7); ctx.fill();
      ctx.fillStyle = "#f2b8c6";                                                // 耳内
      ctx.beginPath(); ctx.ellipse(cx + 2, ry - 51, 1.6, 8, ear, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 9, ry - 50, 1.6, 8, -ear, 0, 7); ctx.fill();
      ctx.fillStyle = "#3a3a3a"; ctx.beginPath(); ctx.arc(cx + 10, ry - 37, 1.6, 0, 7); ctx.fill(); // 眼
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx - 12, ry - 14, 4, 0, 7); ctx.fill();      // 尾
      ctx.fillStyle = "#e33f2f";                                                // 红蝴蝶结
      ctx.beginPath(); ctx.moveTo(cx + 6, ry - 27); ctx.lineTo(cx - 1, ry - 31); ctx.lineTo(cx - 1, ry - 23); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 6, ry - 27); ctx.lineTo(cx + 13, ry - 31); ctx.lineTo(cx + 13, ry - 23); ctx.closePath(); ctx.fill();
      ctx.fillRect(cx + 4, ry - 30, 4, 6);
    } else if (e.type === "flyer") {
      /* 小鸟：蓝色 + 拍翅 + 红项圈 */
      var fy = body.y + body.h / 2;
      var flap = Math.sin((e.anim || 0) * 16) * 8;
      ctx.fillStyle = "#4d9be6";
      ctx.beginPath(); ctx.ellipse(cx, fy, 13, 9, 0, 0, 7); ctx.fill();         // 身体
      ctx.beginPath(); ctx.arc(cx + e.dir * 11, fy - 5, 6.5, 0, 7); ctx.fill(); // 头
      ctx.strokeStyle = "#2f6fb2"; ctx.lineWidth = 4;                           // 翅膀
      ctx.beginPath(); ctx.moveTo(cx - e.dir * 2, fy - 2); ctx.lineTo(cx - e.dir * 10, fy - 8 - flap); ctx.stroke();
      ctx.fillStyle = "#2f6fb2";                                                // 尾
      ctx.beginPath(); ctx.moveTo(cx - e.dir * 12, fy); ctx.lineTo(cx - e.dir * 22, fy - 5); ctx.lineTo(cx - e.dir * 21, fy + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f2a33c";                                                // 喙
      ctx.beginPath(); ctx.moveTo(cx + e.dir * 17, fy - 5); ctx.lineTo(cx + e.dir * 24, fy - 3); ctx.lineTo(cx + e.dir * 17, fy - 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#3a3a3a"; ctx.beginPath(); ctx.arc(cx + e.dir * 12, fy - 7, 1.5, 0, 7); ctx.fill(); // 眼
      ctx.fillStyle = "#e33f2f"; ctx.fillRect(cx + e.dir * 6, fy - 3, 4, 8);    // 红项圈
    }
    ctx.restore();
  }

  function drawScope() {
    var p = reticle();
    var R = 150;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(p.x, p.y, R, 0, 7, true);
    ctx.fillStyle = "rgba(0,0,0,.72)"; ctx.fill("evenodd");
    ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 7);
    ctx.strokeStyle = "#0d0d0d"; ctx.lineWidth = 10; ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y, R - 6, 0, 7);
    ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = "rgba(255,60,60,.95)"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - R, p.y); ctx.lineTo(p.x - R / 2.4, p.y);
    ctx.moveTo(p.x + R / 2.4, p.y); ctx.lineTo(p.x + R, p.y);
    ctx.moveTo(p.x, p.y - R); ctx.lineTo(p.x, p.y - R / 2.4);
    ctx.moveTo(p.x, p.y + R / 2.4); ctx.lineTo(p.x, p.y + R);
    ctx.stroke();
    ctx.fillStyle = "#f33"; ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, 7); ctx.fill();
    // 装填提示
    if (reloading > 0) {
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(p.x - 60, p.y + R + 6, 120, 26);
      ctx.fillStyle = "#ffd66b"; ctx.font = "14px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("装填中… " + (reloading / 1000).toFixed(1) + "s", p.x, p.y + R + 24);
      ctx.textAlign = "left";
    }
    ctx.restore();
  }

  /* ---------- HUD / 弹窗 ---------- */
  function updateHud() {
    $("hud-time").textContent = state === "playing" ? Math.ceil(timeLeft) + "s" : "—";
    $("hud-mag").textContent = reloading > 0 ? "装填中" : mag + "/" + MAG;
    $("hud-mag").className = reloading > 0 ? "warn" : "";
    $("hud-score").textContent = score;
    $("hud-combo").textContent = combo > 1 ? "连击 x" + Math.min(combo, 5) : "";
    $("hud-level").textContent = "第 " + level + " 关 · 剩余 " + Math.max(0, cfg ? cfg.quota - kills : 0) + " 只";
  }
  function log(msg) { $("hud-level").textContent = msg; }
  function hideModals() { ["menu", "clear-modal", "over-modal"].forEach(function (id) { $(id).classList.add("hidden"); }); }
  function showMenu() {
    state = "menu";
    $("menu").classList.remove("hidden");
    $("menu-best").textContent = save.best ? ("最高分 " + save.best + " · 最远第 " + save.maxLevel + " 关") : "首次出击，祝好运！";
  }
  function levelClear() {
    state = "levelclear"; SFX.clear();
    if (score > save.best) save.best = score;
    if (level > save.maxLevel) save.maxLevel = level;
    persist();
    $("clear-info").textContent = "第 " + level + " 关完成！得分 " + score + "（最高 " + save.best + "）";
    $("clear-modal").classList.remove("hidden");
    updateHud();
  }
  function gameOver() {
    state = "gameover"; SFX.over();
    if (score > save.best) save.best = score;
    if (level > save.maxLevel) save.maxLevel = level;
    persist();
    $("over-info").textContent = "第 " + level + " 关 · 得分 " + score + " · 最高分 " + save.best;
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
      // 点在瞄准镜圈内才开枪；点圈外 = 把镜子移过去
      var c = reticle();
      var dist = Math.hypot(p.x - c.x, p.y - c.y);
      if (dist <= 150 * 0.96) { fire(); }
      else { aim.x = p.x; aim.y = p.y; }
    });
    window.addEventListener("keydown", function (ev) {
      if (ev.key === "r" || ev.key === "R") startReload();
    });
    // 触屏：手指按住拖动=瞄准，抬手开枪（pointerdown 已开枪，避免双发）
  }

  /* ---------- 时长体系 ---------- */
  function applyTimeLock() { if (state === "playing") { state = "gameover"; } $("time-lock").classList.remove("hidden"); }
  window.addEventListener("daobox:timeexceeded", applyTimeLock);

  /* ---------- 启动 ---------- */
  function boot() {
    $("app-version").textContent = APP_VERSION;
    canvas = $("game"); ctx = canvas.getContext("2d");
    canvas.width = W; canvas.height = H;
    bindInput();
    $("refresh-btn").addEventListener("click", function () {
      if ("caches" in window) caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }).finally(function () { location.reload(); });
      else location.reload();
    });
    $("btn-start").addEventListener("click", function () { if (ac() && ac().state === "suspended") ac().resume(); startLevel(1); });
    $("btn-next").addEventListener("click", function () { startLevel(level + 1); });
    $("btn-retry").addEventListener("click", function () { score = 0; startLevel(1); });
    $("btn-menu").addEventListener("click", showMenu);
    $("btn-reload").addEventListener("click", startReload);
    $("btn-pause").addEventListener("click", togglePause);
    $("btn-resume").addEventListener("click", togglePause);
    $("btn-quit").addEventListener("click", function () { paused = false; $("btn-pause").textContent = "⏸"; $("pause-modal").classList.add("hidden"); showMenu(); });
    $("btn-mute").addEventListener("click", function () { save.muted = !save.muted; persist(); $("btn-mute").textContent = save.muted ? "🔇" : "🔊"; });
    if (save.muted) $("btn-mute").textContent = "🔇";
    $("lock-close").addEventListener("click", function () { $("time-lock").classList.add("hidden"); showMenu(); });
    buildCity();
    showMenu();
    updateHud();
    requestAnimationFrame(frame);
    setTimeout(function () { try { if (window.DaoBox && window.DaoBox.timeExceeded) applyTimeLock(); } catch (e) {} }, 1200);
  }
  // E2E 测试钩子（不影响正常玩法）
  window.__sniperTest = {
    state: function () { return state; },
    paused: function () { return paused; },
    togglePause: togglePause,
    enemies: function () { return enemies; },
    aim: aim,
    fire: fire,
    score: function () { return score; },
    startLevel: startLevel
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
