/* Sinkhole — level data (field edition)
 *
 * Each level is a large WORLD densely packed with objects. Most are too big to
 * eat at any moment; the challenge is hunting the ones small enough to swallow,
 * growing, and repeating until you can take the gold goals.
 *
 * Design rules that keep the levels FAIR and STRATEGIC:
 *  - The intended growth chain is hand-placed and always solvable: enough tier-1
 *    to reach tier-2, enough tier-2 to reach tier-3, and so on up to the golds.
 *  - CLUTTER is scattered as tier-4 (inedible until you're already large via the
 *    real chain), so it fills the field for the hunt without giving a shortcut.
 *  - GOLDS sit only on the correct path. Dead-end branches are bait (food that
 *    peters out) — a wrong turn costs you a backtrack, never a locked win.
 *
 * Schema:
 *   name, hint
 *   world   : { w, h }
 *   player  : { x, y, r }
 *   walls   : [ { x, y, w, h } ]      optional
 *   objects : [ { x, y, r, tier } ]   tier 1..4 food, tier 5 = GOAL (gold)
 */

function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TIER_R = { 1: 8, 2: 14, 3: 22, 4: 34, 5: 34 };

function goal(x, y) { return { x, y, r: TIER_R[5], tier: 5 }; }

// tight pocket of `count` objects of one tier around (cx,cy)
function cluster(cx, cy, count, tier, spread, seed) {
  const rnd = mulberry(seed || (cx * 131 + cy * 17 + tier));
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * spread;
    const jitter = 1 + (rnd() - 0.5) * 0.25;
    out.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: TIER_R[tier] * jitter, tier });
  }
  return out;
}

// scatter `count` inedible-clutter objects across the world, avoiding a keepOut
// radius around each avoid point (spawn, etc.)
function scatter(world, count, tier, seed, avoid, keepOut) {
  const rnd = mulberry(seed);
  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * 40) {
    guard++;
    const x = 40 + rnd() * (world.w - 80);
    const y = 40 + rnd() * (world.h - 80);
    if (avoid && keepOut) {
      let bad = false;
      for (const a of avoid) if (Math.hypot(x - a.x, y - a.y) < keepOut) { bad = true; break; }
      if (bad) continue;
    }
    const jitter = 1 + (rnd() - 0.5) * 0.3;
    out.push({ x, y, r: TIER_R[tier] * jitter, tier });
  }
  return out;
}

const LEVELS = [
  // 1 — SANDBOX: an open test field. Generous food of every tier, a few golds,
  // no puzzle. Kept for trying out feel/tuning.
  {
    name: 'Sandbox (test)',
    hint: 'Open test field — everything is here. Poke around and get a feel for the hunt.',
    world: { w: 1600, h: 1100 },
    player: { x: 800, y: 550, r: 12 },
    objects: (() => {
      const world = { w: 1600, h: 1100 }, spawn = [{ x: 800, y: 550 }];
      return [
        ...cluster(800, 550, 8, 1, 90, 101),
        ...scatter(world, 24, 1, 111, spawn, 0),
        ...scatter(world, 20, 2, 112),
        ...scatter(world, 18, 3, 113),
        ...scatter(world, 18, 4, 114),
        goal(150, 150), goal(1450, 950), goal(150, 950),
      ];
    })(),
  },

  // 2 — THE TRAIL: one readable breadcrumb of sizes leading across the field to
  // the gold. Teaches the core loop: follow the food that's your size or smaller.
  {
    name: 'The Trail',
    hint: 'Follow the breadcrumb: each pocket grows you enough to eat the next one up.',
    world: { w: 2100, h: 1300 },
    player: { x: 250, y: 650, r: 12 },
    objects: (() => {
      const world = { w: 2100, h: 1300 }, spawn = [{ x: 250, y: 650 }];
      return [
        ...cluster(450, 650, 7, 1, 80, 201),
        ...cluster(780, 500, 7, 2, 80, 202),
        ...cluster(1130, 770, 6, 3, 80, 203),
        ...cluster(1520, 520, 5, 4, 80, 204),
        goal(1900, 650), goal(1830, 920),
        ...scatter(world, 30, 4, 205, spawn, 130),
        ...scatter(world, 10, 3, 206, spawn, 130),
      ];
    })(),
  },

  // 3 — FORK IN THE FIELD: the trail splits. North chains all the way to the
  // gold; South is bait that peters out at a wall of things too big to eat.
  // Read ahead before you commit the distance.
  {
    name: 'Fork in the Field',
    hint: 'The trail forks. Only one branch keeps feeding you — the other is a dead end.',
    world: { w: 2200, h: 1400 },
    player: { x: 280, y: 700, r: 12 },
    objects: (() => {
      const world = { w: 2200, h: 1400 }, spawn = [{ x: 280, y: 700 }];
      return [
        ...cluster(470, 700, 7, 1, 80, 301),
        ...cluster(830, 700, 7, 2, 80, 302), // hub, then it splits
        // NORTH — the true path
        ...cluster(1190, 420, 6, 3, 80, 303),
        ...cluster(1570, 320, 5, 4, 80, 304),
        goal(1930, 300), goal(1910, 560),
        // SOUTH — bait: more tier-2, then a wall of tier-4. No gold.
        ...cluster(1190, 1030, 5, 2, 70, 305),
        ...cluster(1580, 1090, 6, 4, 70, 306),
        // clutter
        ...scatter(world, 30, 4, 307, spawn, 130),
      ];
    })(),
  },

  // 4 — ISLANDS: walls carve the world into four rooms. Each room holds one tier;
  // you must move through them in the right ORDER. Jumping to the big room early
  // is a dead end you have to walk back out of.
  {
    name: 'Islands',
    hint: 'Four rooms, four sizes. Take them in the right order — the big room bites back.',
    world: { w: 2000, h: 1400 },
    player: { x: 350, y: 300, r: 12 },
    walls: [
      // vertical divider at x=985 with gaps at top (TL-TR) and bottom (BL-BR)
      { x: 985, y: 0, w: 30, h: 170 },
      { x: 985, y: 260, w: 30, h: 880 },
      { x: 985, y: 1230, w: 30, h: 170 },
      // horizontal divider at y=685 with gaps at left (TL-BL) and right (BR-TR)
      { x: 0, y: 685, w: 250, h: 30 },
      { x: 350, y: 685, w: 1300, h: 30 },
      { x: 1750, y: 685, w: 250, h: 30 },
    ],
    objects: (() => {
      const world = { w: 2000, h: 1400 }, spawn = [{ x: 350, y: 300 }];
      return [
        ...cluster(520, 380, 7, 1, 90, 401), // TL (start): tier 1
        ...cluster(490, 1050, 7, 2, 90, 402), // BL: tier 2
        ...cluster(1500, 1050, 6, 3, 90, 403), // BR: tier 3
        ...cluster(1500, 360, 5, 4, 90, 404), // TR: tier 4 + golds
        goal(1650, 230), goal(1350, 470),
        ...scatter(world, 22, 4, 405, spawn, 120),
      ];
    })(),
  },

  // 5 — THE LONG HUNT: a huge sparse field. Food pockets sit far apart in the
  // corners; plan a route that hits them in ascending order, then cross to the
  // golds. Endurance and route planning.
  {
    name: 'The Long Hunt',
    hint: 'Pockets are far apart. Plan the route: NW → NE → SE → SW, then take the golds.',
    world: { w: 2600, h: 1700 },
    player: { x: 1300, y: 850, r: 12 },
    objects: (() => {
      const world = { w: 2600, h: 1700 }, spawn = [{ x: 1300, y: 850 }];
      return [
        ...cluster(1120, 760, 4, 1, 60, 501), // small kick-start near spawn
        ...cluster(600, 500, 8, 1, 90, 502),  // NW tier 1
        ...cluster(2000, 450, 8, 2, 90, 503), // NE tier 2
        ...cluster(2100, 1250, 7, 3, 90, 504),// SE tier 3
        ...cluster(600, 1300, 6, 4, 90, 505), // SW tier 4
        goal(280, 850), goal(2340, 850),
        ...scatter(world, 80, 4, 506, spawn, 130),
        ...scatter(world, 20, 3, 507, spawn, 130),
      ];
    })(),
  },
];
