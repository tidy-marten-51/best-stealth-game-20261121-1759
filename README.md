# SHADOW LEDGER

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/tidy-marten-51/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/tidy-marten-51/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

An original top-down stealth game for make.fun's "Make the best stealth game" bounty: infiltrate the Meridian Archive at night, steal three ledger pages, and slip out the green exit unseen. Wardens patrol with lantern vision cones, shelves and crates block their sight, and dark floor patches hide you — crouch to move quietly, sprint to move fast and loud, and click the floor to throw a distraction ping that pulls a warden away. Plays offline in a desktop browser from static files, no network needed; all sound is generated with WebAudio, no audio files.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## Controls

- WASD / arrows — move
- Shift — sprint (fast, loud)
- C — crouch (slow, quiet, harder to see)
- Click — throw a distraction ping at that spot
- P or Esc — pause
- M — mute
- Enter / Space — start, retry

## How it plays

- Guards go calm → suspicious → chase → search: a warden that spots you stops and stares, then gives chase; lose it for a few seconds and it searches where it last saw you before returning to patrol.
- The detection ring over a guard shows how sure it is; the HUD alert bar shows the keenest guard's certainty.
- The exit door stays locked until all three pages are pocketed; the fastest clean getaway is saved in your browser.

## Shots

The screenshots in `screenshots/` are staged by `game/src/shots.js`: each plays the real rules forward from the seeded night with a small autopilot — `?shot=start` (title), `?shot=play` (mid-heist), `?shot=chase` (a warden giving chase), `?shot=end` (the clean getaway).

---

<sub>Entered on [make.fun](https://make.fun/?ref=b6vtfqf3&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
