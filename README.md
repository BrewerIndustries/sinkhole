# Sinkhole

A strategy take on *hole.io*. You steer a hole in real time (no timer) through a
**large field densely packed with objects, most of them too big to eat**. The skill
is **hunting**: find the pockets of things small enough to swallow, grow, and watch
more of the field open up to you — then track down the **gold goal items** and eat
them to win.

## The feel

- The world is **much bigger than the screen**. A camera follows the hole and
  **zooms out as you grow**: tiny = zoomed in, hunting locally with limited sight;
  big = zoomed out, surveying the whole field. That arc *is* the strategy — search
  and route efficiency in a space you can't see all at once.
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

All five are verified size-solvable (a greedy "eat smallest edible, grow, repeat"
solver reaches every gold). Wrong choices are costly backtracks / dead-end bait, not
locked wins — so no hard seal-gates until stuck-detection is reachability-aware.

## Files

- `index.html` — shell, HUD, styles.
- `game.js` — engine: input, movement, **world + follow-camera + size-zoom**,
  circle/rect + one-way-gate collision, eating, growth, win/stuck, rendering,
  minimap.
- `levels.js` — level data + `cluster()` / `scatter()` / `goal()` helpers.
  Levels declare a `world: {w,h}`. Add levels here.

## Play / deploy

- **Dev:** https://brewerindustries.github.io/sinkhole/dev/ (deploys on push to `dev`)
- **Prod:** https://brewerindustries.github.io/sinkhole/ (`main`)

Repo: `BrewerIndustries/sinkhole` (public). The `.github/workflows/pages.yml` Action
lives on `dev` and publishes `main`→`/` and `dev`→`/dev/`. Promote to prod via a PR
into `main` (never fast-forward/reset-push), then re-run the workflow.

> Custom domain `sinkhole.dabrewer.dev` + dashboard/launcher hookup are a follow-up
> (needs the Cloudflare DNS record). Restore the `CNAME` line in `pages.yml` once DNS
> exists. `.jarvis.json` already carries the intended URLs.

## Run locally

```
cd sinkhole
python3 -m http.server 4600
# open http://localhost:4600
```

## Status

v1 — deployed to the dev Pages site. 5 hand-tuned field levels (1 sandbox +
4 designed), abstract shapes. Core loop, camera/zoom, dense-field hunting, and
per-level solvability all verified. No enemies/hazards yet.

## Known rough edges

- **Stuck detection isn't reachability-aware.** It only fires when nothing on the
  whole board is edible, not when the food you need is stranded behind geometry. This
  is why there are no hard seal-gates yet — fixing this unlocks true "commit" levels.
- `window.__dbg` is a debug hook in `game.js` for headless testing; harmless in play.

## Ideas / backlog

- Hand-curated food trails / guaranteed-solvable field generation.
- Reachability-aware stuck detection.
- v2: moving hazards / shrinkers, rival holes.
- "Sonar" ping that briefly flags the nearest edible pocket (hunt assist).
- Star ratings (fewest restarts / least distance travelled).
- Reskin from abstract shapes to a theme (city / food / junkyard).
