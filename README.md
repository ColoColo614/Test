# Mini Plumber Run 1.4

A side-scrolling browser game inspired by Mario-style platformers.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## How to play

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
- `↓`: Enter pipe in levels that have one
- `R`: Restart after game over or after winning


## Movement tuning

- Moving left (backward) is 50% faster than standard move speed.
- Side-scrolling speed is increased by 10%.


## Latest tuning

- Gaps are spaced 20% farther apart on average.
- Secondary platforms now appear in front of primary platforms.
- Level 3 enemies move 20% faster than baseline.
- Level 4 enemies move 10% faster than level 3 enemies.

- Land chunks between gaps now generate at varied altitudes.
