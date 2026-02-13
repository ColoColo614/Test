# Mini Plumber Run

A basic side-scrolling browser game inspired by Mario-style platformers.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## How to play

- Survive jumps across gaps and platforms in **Level 1** and enter the pipe with `↓`.
- Survive **Level 2** and enter its pipe with `↓`.
- Clear **Level 3** by reaching the flag.
- Avoid enemies: touching one from the side causes a loss.
- Defeat enemies by landing on top of them for a score bonus.

## Scoring

- Defeating an enemy by stomping gives extra points.
- Beating the final level gives a large completion bonus.

## Controls

- `←` / `→`: Move (15% slower than before for more control)
- `Space` or `↑`: Jump
- `↓`: Enter pipe in levels that have one
- `R`: Restart after game over or after winning


## Gameplay tuning

- Platform heights are increased to create taller jumps throughout levels.
- Player jump strength is boosted by 25% to support the higher platform routes.
