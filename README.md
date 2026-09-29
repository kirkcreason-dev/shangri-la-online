# Shangri-La Online

The official multiplayer beta of The Quest for Shangri-La. Play together online with shared rooms, saved turns, and room chat. Visual fidelity and support for every physical-game interaction are still in progress.

[Play the online beta](https://kirkcreason-dev.github.io/shangri-la-online/) · [Alternate game address](https://shangri-la-table.y9sph6ffvj.chatgpt.site/)

## Corrected rules edition

New tables use version 3. Existing prototype rooms remain readable and are preserved; they cannot be converted into a mix of incompatible rule sets.

- All 16 playable character records use researched starting Life, Combat Bonus, Cash, allegiance, location, equipment, and paraphrased power descriptions.
- All 60 board spaces have audited effects. The Pipeline costs $100 inward. The Portal costs one Item inward. Magic Ninja waives tolls; Shangri-La still requires 15 base Combat Bonus.
- The recovered Action decks contain 101 Detroit, 90 Nethervoid, and 69 Dark Carnival component records. Names, numbers and mechanical summaries replace the invented 48-card prototype deck.
- The Purchase supply contains 40 Item cards representing 14 types. Thirteen Bone cards are included. Cash objects found in the community Purchase stack are excluded from the shop supply.
- Combat supports one selected Weapon, ranged attacks, both players declaring equipment before rolling, natural 1/10 results, weapon breakage, optional armor, conditional modifiers, and the winner’s choice of PvP penalty.
- Item inventories, Homies, Purchase stock, trade offers requiring acceptance, first-death replacement characters, and all ten ending structures are represented.
- New rooms can be saved in Firebase Firestore; existing rooms remain in D1. Browser sessions identify seats, spectators cannot act, and revision checks reject concurrent stale writes. Deck order and unrevealed endings stay on the server.

Jamie Madrox and Monoxide are excluded from the playable roster, practice opponents, and replacement-character draws. Existing saved seats retain their rules so ongoing games can continue.

## Table controls and remaining fidelity limits

The game automates movement, core combat, common board effects, basic purchases, and several character powers. **126 component records still require some table adjudication, chiefly Events, Fiends and card locations.** Each component shows its paraphrased mechanics and source link. Logged controls let the resolving player or host roll dice, adjust stats, move tokens, transfer/discard/retrieve cards, and record conditions. Conditional combat modifiers are explicitly declared. These controls assume a cooperative table; they are not an anti-cheat rules engine.

This update adds supported effects for 52 previously manual Item/Homie records: declared dice bonuses, optional rerolls, protective responses, single-use combat equipment, regional movement, extra turns, delivery rewards, and inventory transfers. Card responses are saved across reconnects; another player's response pauses the action until that seat or its controller answers. The random replay record remains private. Milenko's Hat automates its roll and target placement but keeps off-turn arrival consequences in a logged ruling. The unclear card 3300 remains marked for review.

Version 3 integrates Casket resurrection before possessions are lost, Psychopathic Ring replacement before an ending resolves, Pumpkin Carver/Nosferatu’s Cape borrowed powers, Crystal Ball private inspection, and all thirteen Bone paths. Durations, delegated control, real-time absence, movement penalties, acquisition restrictions and cures are persisted. Manual controls still do not enforce every exceptional card interaction. Do not treat this edition as mechanically perfect or tournament verified.

Timing conventions are visible in the rules panel: timed Bones count future full turns and apply immediately, the left-hand controller follows fixed lobby order, King High Bone lasts ten real minutes including disconnect time, Amputation caps Items at three even with Backpack, and Concussion clears on an unmodified movement total of six. These fill ambiguities in the printed cards.

The community inventory repeats a 19-card Detroit atlas. Three Detroit title readings remain uncertain. Page 1 of the scanned rulebook lists 110 Detroit, 90 Nethervoid, 70 Dark Carnival, 42 Purchase and 13 Bone cards. The recovered records therefore fall short, and their identities/copy counts have not been certified against a complete physical retail set. Starting equipment is allocated from this observed finite supply; combinations exhausting it are rejected rather than manufacturing cards. Card artwork is not reproduced. The board photograph retains glare and cropping. Online rooms are publicly accessible by invitation link.

## Board controls

The board follows your piece, pans and pivots as you move, and frames your legal destinations. Use Follow turn to watch the active player, Full board for the overview, or drag to explore. Rotate with the arrow buttons or Shift-drag; use the zoom buttons or pinch and twist with two fingers. The minimap keeps your place visible. Keyboard controls work with the board focused: arrows pan, +/− zoom, [/] rotate, and Home returns to your piece. Movement effects respect reduced-motion settings.

## Online play and chat

Joined players can chat in the lobby and during a game. Messages persist across reloads, and simultaneous messages do not interfere with game turns. Chat retains the latest 100 messages, limits each to 500 characters, and checks membership and author identity on the server. [Firebase setup and testing](docs/FIREBASE.md) describes the server configuration.

## Sources

- [Scanned rulebook](https://drive.google.com/file/d/1B5uLPQUczukkIaobj1eUxzcDutSJ-1Ml/view)
- [Community Tabletop Simulator project](https://steamcommunity.com/sharedfiles/filedetails/?id=3079987608)
- Each card record in `lib/rules/cards.json` links to its source photograph. `lib/rules/characters.json` and `lib/rules/spaces.json` hold the researched character/board records. Descriptions are newly worded mechanical summaries, not a verbatim rulebook or card-text transcription.

This is a beta release; the fidelity and automation limits described above remain in progress.

## Development

Node 22.13+ (Node 24 recommended). Install dependencies with `npm run install:ci`, apply the D1 migration using the configured local tooling, and run `npm run dev -- --port 4179`. Production builds use the configured hosting workflow.

`npm test` checks character setup, finite stock, turn permissions, passage costs, combat, trade consent, table adjudication, inventory limits, death, ending structures, and legacy-room preservation. Type checking: `npx tsc --noEmit`.

Validation is recorded in `docs/validation.md`. Automated checks cover implemented rules, persistent state and player permissions; they do not establish physical-game fidelity or replace human acceptance playtesting.

## GitHub Pages deployment

GitHub Pages serves the game from the `gh-pages` branch, with the folder set to `/ (root)` in Settings → Pages. Run `npm run build:pages` to create `dist-pages`, then publish its contents at the branch root with an empty `.nojekyll` file. Source stays on `main`.

The frontend connects to the existing live game API for room state and chat. Only `https://kirkcreason-dev.github.io` is allowed as a cross-origin browser client. Pages seats use a random browser-local token; the original game address retains its cookie sessions. Invitations preserve the Pages path. Database credentials and unrevealed game state remain on the server.

`node tests/pages.integration.mjs` checks a production backend on port 4181, including cross-origin sessions, two-player chat, starting a game, and denied spectator/origin requests. `GAME_TEST_URL` can select another explicitly intended test target; this check creates a new test room.
