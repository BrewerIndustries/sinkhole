/* Sinkhole — a strategy take on hole.io.
 * Real-time steering, no timer. You control a hole in a large field packed with
 * objects, most of them too big to eat. The skill is HUNTING: find the pockets
 * of things small enough to swallow, grow, and watch more of the field become
 * edible. The camera follows you and zooms out as you grow, so when you're tiny
 * you must hunt locally; when you're big you can see the whole field.
 * Pure static-canvas game, no dependencies.
 */

(() => {
  'use strict';

  const VW = 960, VH = 600; // viewport (canvas) size
  const TIER_R = { 1: 8, 2: 14, 3: 22, 4: 34, 5: 34 };
  const TIER_COLOR = {
    1: '#7dd3fc', // sky
    2: '#86efac', // green
    3: '#c4b5fd', // violet
    4: '#fca5a5', // red
    5: '#fcd34d', // gold (goal)
  };

  // movement tuning
  const ACCEL = 0.62;
  const FRICTION = 0.86;
  const GROWTH = 0.5;       // fraction of an eaten object's area added to yours
  const EAT_TOL = 0.9;      // must be this fraction as big to swallow (r >= obj.r*TOL)
  // camera / zoom
  const ZOOM_K = 17;        // zoom = ZOOM_K / radius, clamped
  const ZOOM_MAX = 1.5;     // most zoomed-in (tiny hole)
  const ZOOM_SMOOTH = 0.08; // per-frame easing of zoom toward target (~0.45s)

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = VW; canvas.height = VH;

  // ---- DOM refs ----
  const el = (id) => document.getElementById(id);
  const hudLevel = el('hud-level');
  const hudGoals = el('hud-goals');
  const hudSize = el('hud-size');
  const hudHint = el('hud-hint');
  const overlay = el('overlay');
  const overlayTitle = el('overlay-title');
  const overlaySub = el('overlay-sub');
  const overlayBtn = el('overlay-btn');
  const levelSel = el('level-select');

  // ---- state ----
  let levelIndex = 0;
  let state = null;
  const pointer = { x: VW / 2, y: VH / 2, active: false };
  const keys = new Set();

  function tierOfRadius(r) {
    let t = 1;
    for (let k = 1; k <= 4; k++) if (r >= TIER_R[k] - 0.001) t = k;
    return t;
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function fitZoom(world) {
    // smallest zoom that still keeps the view inside the world (no black edges)
    return Math.max(VW / world.w, VH / world.h);
  }

  function computeCamera(snap) {
    const p = state.p, world = state.world;
    const target = clamp(ZOOM_K / p.r, fitZoom(world), ZOOM_MAX);
    const prev = state.cam ? state.cam.zoom : target;
    // ease zoom toward target so a growth pop doesn't snap the whole view
    const zoom = snap ? target : prev + (target - prev) * ZOOM_SMOOTH;
    const halfW = (VW / 2) / zoom, halfH = (VH / 2) / zoom;
    const x = world.w <= 2 * halfW ? world.w / 2 : clamp(p.x, halfW, world.w - halfW);
    const y = world.h <= 2 * halfH ? world.h / 2 : clamp(p.y, halfH, world.h - halfH);
    state.cam = { x, y, zoom };
  }

  function loadLevel(i) {
    const def = LEVELS[i];
    levelIndex = i;
    const world = def.world || { w: VW, h: VH };
    const objects = def.objects.map((o, idx) => {
      const obj = {
        x: o.x, y: o.y, r: o.r, tier: o.tier, id: idx,
        dying: false, dieT: 0, sx: o.x, sy: o.y, sr: o.r,
        move: !!o.move, flee: !!o.flee, speed: o.speed || 1.2, detect: o.detect || 200,
        vx: 0, vy: 0,
      };
      if (obj.move) {
        const a = Math.random() * Math.PI * 2;
        const s = obj.flee ? 0 : obj.speed; // fleers start still, dart when threatened
        obj.vx = Math.cos(a) * s; obj.vy = Math.sin(a) * s;
      }
      return obj;
    });
    state = {
      def, world,
      p: { x: def.player.x, y: def.player.y, r: def.player.r, vx: 0, vy: 0 },
      walls: (def.walls || []).map((w) => ({ ...w })),
      gates: (def.gates || []).map((g) => ({ ...g, sealed: false, side: null })),
      objects,
      goalsTotal: objects.filter((o) => o.tier === 5).length,
      goalsEaten: 0,
      status: 'play', // play | win | stuck
      pop: [],
      tick: 0,
      cam: { x: def.player.x, y: def.player.y, zoom: 1 },
    };
    computeCamera(true); // snap to correct zoom on level start
    updateHud();
    hideOverlay();
  }

  function updateHud() {
    hudLevel.textContent = `${levelIndex + 1}. ${state.def.name}`;
    hudGoals.textContent = `Gold ${state.goalsEaten}/${state.goalsTotal}`;
    hudSize.textContent = `Tier ${tierOfRadius(state.p.r)}`;
    hudHint.textContent = state.def.hint;
  }

  // ---- input ----
  function screenPos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return {
      x: (t.clientX - rect.left) * (VW / rect.width),
      y: (t.clientY - rect.top) * (VH / rect.height),
    };
  }
  canvas.addEventListener('mousemove', (e) => {
    const p = screenPos(e); pointer.x = p.x; pointer.y = p.y; pointer.active = true;
  });
  canvas.addEventListener('mouseleave', () => { pointer.active = false; });
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); const p = screenPos(e); pointer.x = p.x; pointer.y = p.y; pointer.active = true;
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); const p = screenPos(e); pointer.x = p.x; pointer.y = p.y; pointer.active = true;
  }, { passive: false });
  canvas.addEventListener('touchend', () => { pointer.active = false; });
  window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  // ---- geometry helpers ----
  function resolveCircleRect(c, rect) {
    const nx = clamp(c.x, rect.x, rect.x + rect.w);
    const ny = clamp(c.y, rect.y, rect.y + rect.h);
    let dx = c.x - nx, dy = c.y - ny;
    let d2 = dx * dx + dy * dy;
    if (d2 >= c.r * c.r) return false;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      const push = c.r - d;
      c.x += (dx / d) * push; c.y += (dy / d) * push;
      const nxn = dx / d, nyn = dy / d;
      const vn = c.vx * nxn + c.vy * nyn;
      if (vn < 0) { c.vx -= vn * nxn; c.vy -= vn * nyn; }
    } else {
      const left = c.x - rect.x, right = rect.x + rect.w - c.x;
      const top = c.y - rect.y, bottom = rect.y + rect.h - c.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) { c.x = rect.x - c.r; c.vx = Math.min(0, c.vx); }
      else if (m === right) { c.x = rect.x + rect.w + c.r; c.vx = Math.max(0, c.vx); }
      else if (m === top) { c.y = rect.y - c.r; c.vy = Math.min(0, c.vy); }
      else { c.y = rect.y + rect.h + c.r; c.vy = Math.max(0, c.vy); }
    }
    return true;
  }

  // moving prey vs wall: push out and reflect velocity (so fleers can be cornered)
  function bounceRect(o, rect) {
    const nx = clamp(o.x, rect.x, rect.x + rect.w);
    const ny = clamp(o.y, rect.y, rect.y + rect.h);
    const dx = o.x - nx, dy = o.y - ny, d2 = dx * dx + dy * dy;
    if (d2 >= o.r * o.r || d2 < 0.0001) return;
    const d = Math.sqrt(d2), nX = dx / d, nY = dy / d;
    o.x += nX * (o.r - d); o.y += nY * (o.r - d);
    const vn = o.vx * nX + o.vy * nY;
    if (vn < 0) { o.vx -= 2 * vn * nX; o.vy -= 2 * vn * nY; }
  }

  function gateSide(g, x, y) {
    if (g.axis === 'v') return x < g.x + g.w / 2 ? -1 : 1;
    return y < g.y + g.h / 2 ? -1 : 1;
  }

  // ---- simulation ----
  function step() {
    if (state.status !== 'play') { computeCamera(); return; }
    state.tick++;
    const p = state.p, world = state.world, cam = state.cam;

    // steer toward pointer, mapped from screen space through the camera
    if (pointer.active) {
      const wx = (pointer.x - VW / 2) / cam.zoom + cam.x;
      const wy = (pointer.y - VH / 2) / cam.zoom + cam.y;
      const dx = wx - p.x, dy = wy - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 3) { p.vx += (dx / d) * ACCEL; p.vy += (dy / d) * ACCEL; }
    }
    if (keys.has('arrowleft') || keys.has('a')) p.vx -= ACCEL;
    if (keys.has('arrowright') || keys.has('d')) p.vx += ACCEL;
    if (keys.has('arrowup') || keys.has('w')) p.vy -= ACCEL;
    if (keys.has('arrowdown') || keys.has('s')) p.vy += ACCEL;

    p.vx *= FRICTION; p.vy *= FRICTION;
    const maxSpeed = 5.4 * (1 - Math.min(0.42, (p.r - 12) / 260));
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > maxSpeed) { p.vx *= maxSpeed / sp; p.vy *= maxSpeed / sp; }
    p.x += p.vx; p.y += p.vy;

    // one-way gate sealing
    for (const g of state.gates) {
      const side = gateSide(g, p.x, p.y);
      if (g.side === null) g.side = side;
      else if (!g.sealed && side !== g.side) g.sealed = true;
      g.side = side;
    }
    for (const wall of state.walls) resolveCircleRect(p, wall);
    for (const g of state.gates) if (g.sealed) resolveCircleRect(p, g);

    p.x = clamp(p.x, p.r, world.w - p.r);
    p.y = clamp(p.y, p.r, world.h - p.r);

    // moving prey: wander, or flee once the hole is big enough to eat them
    for (const o of state.objects) {
      if (!o.move || o.dying) continue;
      if (o.flee) {
        const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d < o.detect && p.r >= o.r * EAT_TOL) { o.vx = (dx / d) * o.speed; o.vy = (dy / d) * o.speed; }
        else { o.vx *= 0.96; o.vy *= 0.96; }
      }
      o.x += o.vx; o.y += o.vy;
      if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx); }
      else if (o.x > world.w - o.r) { o.x = world.w - o.r; o.vx = -Math.abs(o.vx); }
      if (o.y < o.r) { o.y = o.r; o.vy = Math.abs(o.vy); }
      else if (o.y > world.h - o.r) { o.y = world.h - o.r; o.vy = -Math.abs(o.vy); }
      for (const wall of state.walls) bounceRect(o, wall);
    }

    // eating
    for (const o of state.objects) {
      if (o.dying) continue;
      if (p.r < o.r * EAT_TOL) continue;
      const dist = Math.hypot(o.x - p.x, o.y - p.y);
      if (dist < p.r) {
        o.dying = true; o.dieT = 0; o.sx = o.x; o.sy = o.y; o.sr = o.r;
        const area = Math.PI * o.r * o.r;
        p.r = Math.sqrt((Math.PI * p.r * p.r + area * GROWTH) / Math.PI);
        if (o.tier === 5) state.goalsEaten++;
        state.pop.push({ x: o.x, y: o.y, r: o.r, t: 0, tier: o.tier });
        updateHud();
      }
    }

    for (const o of state.objects) {
      if (!o.dying) continue;
      o.dieT += 1 / 60;
      const k = Math.min(1, o.dieT / 0.16);
      o.r = o.sr * (1 - k);
      o.x = o.sx + (p.x - o.sx) * k;
      o.y = o.sy + (p.y - o.sy) * k;
    }
    state.objects = state.objects.filter((o) => !(o.dying && o.dieT >= 0.16));
    for (const f of state.pop) f.t += 1 / 60;
    state.pop = state.pop.filter((f) => f.t < 0.35);

    computeCamera();

    // win / stuck
    if (state.goalsEaten >= state.goalsTotal) {
      state.status = 'win';
      const more = levelIndex + 1 < LEVELS.length;
      showOverlay('Level Complete', more ? 'Nice hunting.' : 'You cleared them all.',
        more ? 'Next Level' : 'Play Again',
        () => more ? loadLevel(levelIndex + 1) : loadLevel(0));
    } else if (!state.objects.some((o) => !o.dying && p.r >= o.r * EAT_TOL)) {
      state.status = 'stuck';
      showOverlay('Stranded', 'Nothing left small enough to eat. Try a different route.', 'Retry',
        () => loadLevel(levelIndex));
    }
  }

  // ---- rendering ----
  function draw() {
    const cam = state.cam, world = state.world;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, VW, VH);

    // world-space transform
    ctx.save();
    ctx.translate(VW / 2, VH / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    // field background + grid
    ctx.fillStyle = '#0f1420';
    ctx.fillRect(0, 0, world.w, world.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1 / cam.zoom;
    for (let x = 0; x <= world.w; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, world.h); ctx.stroke(); }
    for (let y = 0; y <= world.h; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(world.w, y); ctx.stroke(); }
    // field border
    ctx.strokeStyle = 'rgba(140,170,255,0.25)';
    ctx.lineWidth = 3 / cam.zoom;
    ctx.strokeRect(0, 0, world.w, world.h);

    for (const wall of state.walls) { ctx.fillStyle = '#2b3550'; roundRect(wall.x, wall.y, wall.w, wall.h, 6); ctx.fill(); }
    for (const g of state.gates) {
      if (g.sealed) {
        ctx.fillStyle = '#2b3550'; roundRect(g.x, g.y, g.w, g.h, 6); ctx.fill();
        ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2 / cam.zoom;
        roundRect(g.x + 1, g.y + 1, g.w - 2, g.h - 2, 5); ctx.stroke();
      } else {
        ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2 / cam.zoom;
        roundRect(g.x, g.y, g.w, g.h, 6); ctx.stroke(); ctx.restore();
      }
    }

    for (const o of state.objects) {
      const edible = state.p.r >= o.r * EAT_TOL && !o.dying;
      drawBlob(o.x, o.y, o.r, o.tier, edible, cam.zoom);
    }

    for (const f of state.pop) {
      const k = f.t / 0.35;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = TIER_COLOR[f.tier];
      ctx.lineWidth = 2 / cam.zoom;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r + k * 22, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // the hole
    const p = state.p;
    const grad = ctx.createRadialGradient(p.x, p.y, p.r * 0.2, p.x, p.y, p.r);
    grad.addColorStop(0, '#000'); grad.addColorStop(0.75, '#05070d'); grad.addColorStop(1, '#1b2540');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(160,190,255,0.5)'; ctx.lineWidth = 2 / cam.zoom;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();

    ctx.restore();

    drawMinimap();
  }

  function drawBlob(x, y, r, tier, edible, zoom) {
    ctx.save();
    if (tier === 5) { ctx.shadowColor = '#fcd34d'; ctx.shadowBlur = 16; }
    ctx.fillStyle = TIER_COLOR[tier];
    ctx.globalAlpha = edible ? 1 : 0.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (edible) {
      // pulsing ring so edible prey pops out of a dense field
      const pulse = 1 + 0.18 * Math.sin(state.tick * 0.15 + x * 0.05);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.6 / zoom;
      ctx.beginPath(); ctx.arc(x, y, r + 2 + pulse, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawMinimap() {
    const world = state.world;
    const pad = 12, mw = 168, mh = mw * (world.h / world.w);
    const ox = VW - mw - pad, oy = VH - mh - pad;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#0b0e16'; roundRect(ox, oy, mw, mh, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(140,170,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    const sx = mw / world.w, sy = mh / world.h;
    // goals
    for (const o of state.objects) {
      if (o.tier !== 5) continue;
      ctx.fillStyle = '#fcd34d';
      ctx.beginPath(); ctx.arc(ox + o.x * sx, oy + o.y * sy, 3, 0, Math.PI * 2); ctx.fill();
    }
    // hole
    const p = state.p;
    ctx.fillStyle = '#e7ecf7';
    ctx.beginPath(); ctx.arc(ox + p.x * sx, oy + p.y * sy, 2.5, 0, Math.PI * 2); ctx.fill();
    // viewport rectangle
    const cam = state.cam, halfW = (VW / 2) / cam.zoom, halfH = (VH / 2) / cam.zoom;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
    ctx.strokeRect(ox + (cam.x - halfW) * sx, oy + (cam.y - halfH) * sy, 2 * halfW * sx, 2 * halfH * sy);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- overlay ----
  function showOverlay(title, sub, btn, onClick) {
    overlayTitle.textContent = title;
    overlaySub.textContent = sub;
    overlayBtn.textContent = btn;
    overlayBtn.onclick = onClick;
    overlay.classList.add('show');
  }
  function hideOverlay() { overlay.classList.remove('show'); }

  // ---- controls ----
  el('btn-restart').onclick = () => loadLevel(levelIndex);
  el('btn-prev').onclick = () => loadLevel((levelIndex - 1 + LEVELS.length) % LEVELS.length);
  el('btn-next').onclick = () => loadLevel((levelIndex + 1) % LEVELS.length);
  LEVELS.forEach((lv, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = `${i + 1}. ${lv.name}`;
    levelSel.appendChild(opt);
  });
  levelSel.onchange = () => loadLevel(parseInt(levelSel.value, 10));

  // ---- main loop ----
  function frame() {
    step();
    draw();
    levelSel.value = String(levelIndex);
    requestAnimationFrame(frame);
  }

  loadLevel(0);
  requestAnimationFrame(frame);

  // debug hook (headless testing only; harmless in normal play)
  window.__dbg = { get state() { return state; }, step, loadLevel };
})();
