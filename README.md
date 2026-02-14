# Mini Plumber Run 1.91

A side-scrolling browser game inspired by Mario-style platformers.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## How to play

- At launch, choose your character:
  - `1`: Classic
  - `2`: Green suit
  - or click a character card on screen

- Survive jumps across wider-spaced gaps and platforms in **Level 1**, then enter the pipe with `↓`.
- Survive **Level 2** (with faster enemies) and enter its pipe with `↓`.
- Clear **Level 3** (also with faster enemies) and enter the third pipe.
- Clear **Level 4** where enemies are the fastest, and reach the final flag that spawns on land.
- Avoid enemies: touching one from the side causes a loss.
- Defeat enemies by landing on top of them.

## Scoring

- Defeating an enemy by stomping gives a bonus.
- Entering a pipe gives a bonus.
- Beating the final level gives a large completion bonus.

## Controls

- `←` / `→`: Move
- `Space` or `↑`: Jump
- `↓`: Enter pipe in levels that have one, or drop through a platform when standing on one
- `R`: Pause/resume during a level, or restart after game over/winning


## Movement tuning

- Moving left (backward) was doubled from its prior tuning (now much faster than standard move speed).
- Side-scrolling speed is increased by 20%.


## Latest tuning

- Chunks are ~30% longer on average and there are about 20% fewer gaps on average.
- Secondary platforms now appear in front of primary platforms, and platform spawn frequency is increased by 25%.
- Level 3 enemies move 20% faster than baseline.
- Level 4 enemies move 10% faster than level 3 enemies.
- Stationary antagonists now appear and shoot fireballs.

- Land chunks between gaps now generate at varied altitudes.

- Each level has one hard-to-reach star that grants bonus points.
- Each star gives slightly more points than defeating one enemy.
- Background hills were added behind the terrain.

- Secondary platforms are positioned above normal jump height from ground and are intended to be reached from other platforms.

- Hills were made smaller and greener in the background.

- End-of-run screen now tells you whether you set a new high score.
