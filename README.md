# Mini Plumber Run vrs 1.9.9.2

A side-scrolling browser game inspired by Mario-style platformers.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## How to play

- At launch, choose your run mode first:
  - `1`: Normal Run
  - `2`: Hard Mode (+20% scroll, +10% score bonus)
  - `3`: Easy Mode (-20% scroll, -10% enemy speed, -15% move speed)
- Then choose your character:
  - `1`: Mario
  - `2`: Luigi
  - `3`: Wario
  - `4`: Waluigi
  - or click a card on screen

- Survive jumps across wider-spaced gaps and platforms in **Level 1**, then enter the pipe with `↓`.
- Survive **Level 2** (with faster enemies) and enter its pipe with `↓`.
- Clear **Level 3** (also with faster enemies) and enter the third pipe.
- Clear **Level 4** and enter the fourth pipe.
- Clear **Level 5** where enemies are the fastest, and reach the final flag that spawns on land.
- Avoid enemies: touching one from the side causes a loss.
- Defeat enemies by landing on top of them.
- Beware Venus fly traps in smaller pipes: touching them from the top or side causes a loss. They rise for 3 seconds, then stay underground for 3 seconds before returning. Some small pipes are empty and do not contain Venus fly traps.

## Scoring

- Defeating an enemy by stomping gives a bonus.
- Entering a pipe gives a bonus.
- Beating the final level gives a large completion bonus.

## Controls

- `←` / `→`: Move
- `Space` or `↑`: Jump
- `↓`: Enter pipe in levels that have one, or drop through a platform when standing on one
- `R`: Pause/resume during a level, or restart after game over/winning
- `M`: Reopen mode selection at any time
- `C`: Reopen character selection at any time

## Movement tuning

- Moving left (backward) was doubled from its prior tuning (now much faster than standard move speed).
- Side-scrolling speed is increased by 20%.
- Hard Mode scrolls sideways 20% faster than Normal mode.
- Hard Mode gives a 10% bonus to all points scored.
- Easy Mode scrolls sideways 20% slower than Normal mode.
- Easy Mode antagonists are 10% slower.
- Easy Mode forward/backward character movement is 15% slower.

## Latest tuning


- Levels are tuned to be about 15% longer on average.
- Antagonist counts increase on average by level: +5% (L2), +10% (L3), +15% (L4), +20% (L5).
- Terrain now ends shortly after the objective: only one chunk appears after each pipe/flag.
- A small castle appears on the final chunk.
- Chunks are ~30% longer on average and there are about 20% fewer gaps on average.
- Secondary platforms now appear in front of primary platforms, and platform spawn frequency is increased by 25%.
- Platforms now render as brick blocks.
- No platforms spawn directly above pipes.
- Level 3 enemies move 20% faster than baseline.
- Level 4 enemies move 10% faster than Level 3 enemies.
- Level 5 enemies were increased by another 10% (now ~21% faster than Level 4 enemies).
- In Hard Mode, enemies in Levels 1–4 are 10% faster.

- Land chunks between gaps now generate at varied altitudes.
- Level 2 uses a desert-themed background.
- Level 3 uses a mountainous background.
- Level 4 uses a lush background.
- Level 5 uses a corrupted background.
- Some levels can now appear in nighttime lighting variants.

- Each level has one hard-to-reach star that grants bonus points.
- Each star gives slightly more points than defeating one enemy.
- Background hills were added behind the terrain.

- Secondary platforms are positioned above normal jump height from ground and are intended to be reached from other platforms.

- Hills were made wider and greener in the background, with wavy placement.

- End-of-run screen now tells you whether you set a new high score.
- HUD tracks attempts instead of deaths.
- Stars are placed before the level objective (pipe/flag), never after it.
