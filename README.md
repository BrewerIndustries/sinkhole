# Sinkhole

A strategy take on *hole.io*. You steer a hole in real time (no timer) through a
**large field densely packed with objects, most of them too big to eat**. The skill
is **hunting**: find the pockets of things small enough to swallow, grow, and watch
more of the field open up to you — then track down the **gold goal items** and eat
them to win.

## The feel

- The world is **much bigger than the screen**. A camera follows the hole and
  **zooms out as you grow** (eased smoothly, so a growth pop doesn't snap the view):
  tiny = zoomed in, hunting locally with limited sight; big = zoomed out, surveying
  the whole field. That arc *is* the strategy — search and route efficiency in a
  space you can't see all at once.
- Some prey **move**: *wanderers* drift around (you can't just park on a pocket),
  and *fleers* dart away the instant you're big enough to eat them — corner them
  against walls/edges, or ambush them while you're still too small to spook them.
- **Objectives** come in two flavors (inspired by hole.io 3D / Hole 'Em All):
  *eat all the gold orbs*, or **collect N of specific shapes** (▲ ■ ★ ⬢ …). The HUD
  tracks each shape's count and the minimap marks the remaining targets.
- Most objects are inedible clutter. **Edible prey pulses with a white ring** so it
  pops out of the noise. You can only swallow objects at or below your own size.
- A **minimap** (bottom-right) shows the world bounds, your position, the gold
  goals, and your current viewport — for orientation, not for finding food.

> Note: the lock-and-key / room-gating ideas explored earlier moved to a **separate
> Chip's-Challenge-style project**. Sinkhole stays focused on the hole/field theme.

## Controls

- **Mouse** (or touch): the hole accelerates toward the pointer.
- **WASD / arrow keys** also work.
- Restart / Prev / Next / level dropdown in the toolbar.

## Tiers

| Tier | Color  | Note |
|------|--------|------|
| 1    | sky    | starter food |
| 2    | green  | |
| 3    | violet | |
| 4    | red    | inedible until you're large |
| Goal | gold   | eat all of these to win |

## Levels (field edition)

1. **Sandbox (test)** — open field with everything; no puzzle, kept for feel/tuning.
2. **The Trail** — one readable breadcrumb of sizes leading to the gold.
3. **Fork in the Field** — the trail splits; only one branch keeps feeding you.
4. **Islands** — walls carve four rooms (one tier each); take them in the right order.
5. **The Long Hunt** — huge sparse field; plan a route across the corner pockets.
6. **Live Bait** — edible prey wander; you have to chase the drifting food.
7. **Spooked** — prey flee once you can eat them; corner them in the wall pens.
8. **Feeding Frenzy** — the big combined hunt: wanderers + pockets + clutter, 3 golds.
9. **Collector** — first shape-collect goal: bag 5 ▲ and 4 ■ among the clutter.
10. **Big Game** — grow all the way up, then collect the big ★ and ⬢.

All ten are verified solvable (a greedy "eat smallest edible, grow, repeat" solver
reaches every gold / every target shape). Wrong choices are costly backtracks /
dead-end bait, not locked wins — so no hard seal-gates until stuck-detection is
reachability-aware.

### Objective schema

A level either uses the default gold-orb goal (tier-5 `goal()` objects) or declares a
shape-collect objective:

```js
objective: { collect: [
  { shape: 'triangle', count: 5, color: '#f472b6' },
  { shape: 'square',   count: 4, color: '#38bdf8' },
]}
```

Target objects are placed with `mark(cluster(...), shape, color)`. Shapes: `circle`
(default/clutter), `triangle`, `square`, `diamond`, `pentagon`, `hexagon`, `star`.

## Files

- `index.html` — shell, HUD, styles.
- `game.js` — engine: input, movement, **world + follow-camera + size-zoom**,
  circle/rect + one-way-gate collision, eating, growth, win/stuck, rendering,
  minimap.
- `levels.js` — level data + helpers: `cluster()` / `scatter()` / `goal()`, plus
  `moving()` (wandering prey) and `fleeing()` (prey that flee when edible). Levels
  declare a `world: {w,h}`. Add levels here.

## Play / deploy

- **Dev:** https://sinkhole.dabrewer.dev/dev/ (deploys on push to `dev`)
- **Prod:** https://sinkhole.dabrewer.dev/ (`main`)

Repo: `BrewerIndustries/sinkhole` (public). The `.github/workflows/pages.yml` Action
lives on `dev` and publishes `main`→`/` and `dev`→`/dev/`, writing the
`sinkhole.dabrewer.dev` CNAME. Promote to prod via a PR into `main` (never
fast-forward/reset-push), then re-run the workflow.

> Still a follow-up: dashboard/launcher hookup (`sync-registry.mjs` + launcher
> `apps.ts`). `.jarvis.json` already carries the URLs.

## Run locally

```
cd sinkhole
python3 -m http.server 4600
# open http://localhost:4600
```

## Status

v1 — deployed to the dev Pages site. 10 hand-tuned field levels (1 sandbox +
9 designed). Core loop, eased camera/zoom (size-scaled speed), dense-field hunting,
moving/fleeing prey, and two objective types (gold orbs + shape-collect) all verified.

## Known rough edges

- **Stuck detection isn't reachability-aware.** It only fires when nothing on the
  whole board is edible, not when the food you need is stranded behind geometry. This
  is why there are no hard seal-gates yet — fixing this unlocks true "commit" levels.
- `window.__dbg` is a debug hook in `game.js` for headless testing; harmless in play.

## Ideas / backlog

- **Spawning shapes (new objective types).** Shapes spawn over time, enabling:
  - *Clear-the-field under pressure* — you must eat faster than things spawn.
  - *Quota with waiting* — "eat N of shape X"; some may only appear via spawns, so
    you loiter/hunt for them to pop in. Adds pacing + patience to the hunt.
  Needs a spawner (rate, spawn tiers, spawn points/edges) and win conditions keyed on
  eaten-counts-by-tier or field-empty rather than just golds.
- Hand-curated food trails / guaranteed-solvable field generation.
- Reachability-aware stuck detection.
- v2: moving hazards / shrinkers, rival holes.
- "Sonar" ping that briefly flags the nearest edible pocket (hunt assist).
- Star ratings (fewest restarts / least distance travelled).
- Reskin from abstract shapes to a theme (city / food / junkyard).
