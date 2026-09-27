# Oink! — Wild Pig Card Game

A pig-themed shedding card game built as a pure HTML5/JS single-page app.
Its 112-card deck and core rules follow the structure of classic Svintus,
with original English names and art. The physical social actions have
single-player digital versions:

- **OINK!** — call before playing your penultimate card. A 3-second grace
  window follows if you miss it; failing costs 3 cards.
- **Hush Pig** — avoid clicking, tapping, or pressing a key for 4 seconds or
  draw 2. This replaces the physical game's spoken-silence rule without
  requesting microphone access.
- **Hoof Slap** — choose Slap, Dodge, or Grab without a timer. Bots choose
  secretly. Slap beats Grab, Grab beats Dodge, and Dodge beats Slap. Players
  who chose the losing move draw 2; all matching or all three moves is a tie.
- **Grab Pig** — forces 3 cards and a skipped turn, unless the victim plays
  another Grab Pig and passes on a larger penalty.
- **Intercept** — play an identical card out of turn to take initiative.

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
conservation (all 112 cards must stay accounted for).
Run `node tests/game-rules.js` for focused deck and action checks.

For display checks, install the test dependency and browser once, then run:

```bash
npm install
npx playwright install chromium
npm run test:layout
```

The display test checks the loading screen, menu, table, help, card prompts,
special-card overlays, and round result at eight phone, tablet, and desktop
sizes. Set `LAYOUT_SCREENSHOTS=1` to save screenshots in `tests/artifacts/`.

## Structure

```
index.html        markup, loads SDK + scripts
css/style.css     base styling and responsive layout
css/refresh.css   illustrated card set and tabletop theme
js/cards.js       deck model (112 cards), match rules
js/game.js        engine: turn state machine, reactions, transfers, interception
js/bots.js        bot AI (heuristics: attack the leader, hoard color choosers)
js/audio.js       WebAudio-synthesized SFX (no audio assets)
js/sdk.js         CrazyGames SDK wrapper (graceful no-op outside their iframe)
js/ui.js          rendering, original SVG pig illustrations, animations, input, overlays
js/main.js        menu wiring, sound pref, self-test mode
serve.ps1         tiny PowerShell static server for local testing
tests/game-rules.js  focused checks for deck and special rules
```

No external assets: all art is inline SVG/CSS, all sounds are WebAudio
synthesis. The only external script is the CrazyGames SDK itself.

## The deck (112 cards)

- Red, orange, green, and blue × (0–7 ×2) = 64 number cards
- Per color ×2: **Snore Pig** (skip), **Piggy Turn** (reverse), **Grab Pig** (+3),
  **Hush Pig** (quiet challenge), **Hoof Slap** (secret-choice clash) = 40 action cards
- **Color Hog** ×8 (choose the next color)

Core rules: each player starts with 8 cards; match by color, number, or
symbol; no match → draw 1 (may play it immediately). The first to shed
everything wins. A round winner scores one point for each card left in the
other players' hands.

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
- More bot personalities and difficulty presets
- Cosmetic pig skins as rewarded-ad unlocks
