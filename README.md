# Oink! — Wild Pig Card Game

A fast, chaotic pig-themed shedding card game (Uno-like) built as a pure
HTML5/JS single-page app — designed for web portals like CrazyGames.
Rules inspired by classic shedding games, with original theme, art and two
signature mechanics built for digital play:

- **OINK!** — down to your last card? You have 3 seconds to smack the OINK
  button, or you draw 2 penalty cards (the digital take on calling "Uno!").
- **Shhh!** — a wild card that freezes the whole table for 4 seconds.
  First one to touch the screen draws 2. The bots twitch and fake-move to
  bait you.

## Run locally

No build step, no dependencies. Any static server works:

```powershell
# Windows (no Node/Python needed)
powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 8080
# then open http://127.0.0.1:8080/
```

```bash
# alternative
npx serve .            # or: python -m http.server 8080
```

### Self-test

Open `http://127.0.0.1:8080/?selftest=1` — runs 300 bot-vs-bot games through
the real engine in-page and reports termination, win spread and card
conservation (all 120 cards must stay accounted for). Engine guarantees:
games always terminate, average ~31 turns (2 players) to ~43 turns (4 players).

## Structure

```
index.html        markup, loads SDK + scripts
css/style.css     all styling (responsive: desktop, mobile portrait, short screens)
js/cards.js       deck model (120 cards), match rules
js/game.js        engine: turn state machine, OINK/Shhh rules, event emitter
js/bots.js        bot AI (heuristics: attack the leader, hoard wilds, swap smart)
js/audio.js       WebAudio-synthesized SFX (no audio assets)
js/sdk.js         CrazyGames SDK wrapper (graceful no-op outside their iframe)
js/ui.js          rendering, animations, input, overlays
js/main.js        menu wiring, sound pref, self-test mode
serve.ps1         tiny PowerShell static server for local testing
```

No external assets: all art is inline SVG/CSS, all sounds are WebAudio
synthesis. The only external script is the CrazyGames SDK itself.

## The deck (120 cards)

- 4 colors × (0, 1–9 ×2) = 76 number cards
- Per color ×2: **Snooze** (skip), **U-Turn** (reverse), **Mud Sling** (+2),
  **Hand Swap** (trade hands with the next player) = 32 action cards
- Wilds ×4 each: **Any Color**, **Stampede** (+4 + color), **Shhh!**

Core rules: match by color / number / symbol; no match → draw 1 (may play it
immediately); first to shed everything wins. Round scoring: numbers face
value, actions 20, wilds 50.

## CrazyGames submission checklist

Before uploading (developer portal → submit HTML5 game):

- [x] CrazyGames SDK integrated: `init`, `loadingStart/Stop`,
      `gameplayStart/Stop`, `happytime`, midgame ad between rounds
      (see `js/sdk.js` — re-verify method names against
      https://docs.crazygames.com before submitting, the SDK evolves)
- [x] Game is fully playable with ads blocked / SDK absent (graceful fallback)
- [x] No external requests besides the SDK (art is SVG/CSS, sound is WebAudio)
- [x] No copyright issues: original name/theme/art/text — mechanics only are
      inspired by existing games; do **not** ship translated originals
- [x] Responsive: works in landscape and portrait, mouse + touch
- [x] Local save via localStorage (stats, sound preference)
- [x] Self-test passes (`?selftest=1`)
- [ ] Zip the folder (index.html at zip root) and upload via the developer portal
- [ ] Run their QA feedback loop; midgame ads only at natural breaks
      (implemented: round end)

## Roadmap ideas

- Difficulty presets for bots (Sloppy / Average / Hog Wild)
- Online multiplayer (CrazyGames multiplayer) — the solo-vs-bots mode already
  satisfies their single-player requirement
- More chaotic cards: stacked +2s, "7-0" rule, jump-ins
- Cosmetic pig skins as rewarded-ad unlocks
