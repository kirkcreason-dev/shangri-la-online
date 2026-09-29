# Shangri-La Online

An unofficial multiplayer **assisted tabletop** for The Quest for Shangri-La. This is not an official release, a visual replica, or a fully automated implementation of every physical-game interaction.

## Corrected rules edition

New tables use version 2. Existing prototype rooms remain readable and are preserved; they cannot be converted into a mix of incompatible rule sets.

- All 18 character records use researched starting Life, Combat Bonus, Cash, allegiance, location, equipment, and paraphrased power descriptions.
- All 60 board spaces have audited effects. The Pipeline costs $100 inward. The Portal costs one Item inward. Magic Ninja waives tolls; Shangri-La still requires 15 base Combat Bonus.
- The recovered Action decks contain 101 Detroit, 90 Nethervoid, and 69 Dark Carnival component records. Names, numbers and mechanical summaries replace the invented 48-card prototype deck.
- The Purchase supply contains 40 Item cards representing 14 types. Thirteen Bone cards are included. Cash objects found in the community Purchase stack are excluded from the shop supply.
- Combat supports one selected Weapon, ranged attacks, both players declaring equipment before rolling, natural 1/10 results, weapon breakage, optional armor, conditional modifiers, and the winner’s choice of PvP penalty.
- Item inventories, Homies, Purchase stock, trade offers requiring acceptance, first-death replacement characters, and all ten ending structures are represented.
- Room state is saved in D1. Session cookies identify seats, spectators cannot act, and revision checks reject concurrent stale writes. Deck order and unrevealed endings stay on the server.

## Assisted effects and remaining fidelity limits

The game automates movement, core combat, common board effects, basic purchases, and several character powers. **Most conditional cards, persistent Bones, and unusual power interactions require table adjudication.** Each component shows its paraphrased mechanics and source link. Logged controls let the resolving player or host roll dice, adjust stats, move tokens, transfer/discard/retrieve cards, and record conditions. Conditional combat modifiers are explicitly declared. These controls assume a cooperative table; they are not an anti-cheat rules engine.

Manual controls do not automatically enforce every timing window or override an already resolved ending/death. Resurrection Items, replacement endings, borrowed powers, temporary turn control, real-time Bone effects, and other exceptions need further automated integration. Do not treat this edition as mechanically perfect or tournament verified.

The community inventory repeats a 19-card Detroit atlas. Three Detroit title readings remain uncertain. The observed counts have not been certified against a complete physical retail set. Starting equipment is allocated from this observed finite supply; combinations exhausting it are rejected rather than manufacturing cards. Card artwork is not reproduced. The board photograph retains glare and cropping. Shared online rooms require every participant to have access under the Site’s existing sharing settings.

## Sources

- [Scanned rulebook](https://drive.google.com/file/d/1B5uLPQUczukkIaobj1eUxzcDutSJ-1Ml/view)
- [Community Tabletop Simulator project](https://steamcommunity.com/sharedfiles/filedetails/?id=3079987608)
- Each card record in `lib/rules/cards.json` links to its source photograph. `lib/rules/characters.json` and `lib/rules/spaces.json` hold the researched character/board records. Descriptions are newly worded mechanical summaries, not a verbatim rulebook or card-text transcription.

No affiliation with, endorsement by, or official status from ICP/Psychopathic Records or the original game’s creators is claimed.

## Development

Node 22.13+ (Node 24 recommended). Install dependencies with `npm run install:ci`, apply the D1 migration using the configured local tooling, and run `npm run dev -- --port 4179`. Production builds use the bundled Sites build workflow. The deployment configuration is `.openai/hosting.json`.

`npm test` checks character setup, finite stock, turn permissions, passage costs, combat, trade consent, table adjudication, inventory limits, death, ending structures, and legacy-room preservation. Type checking: `npx tsc --noEmit`.

Validation for this update: 33 engine tests, TypeScript checks, browser lobby/combat/turn handoff, and local HTTP checks with independent sessions for create/join/ready/start, spectators, concurrent moves, encounter resolution and reconnection. This validates the implementation paths covered, not full physical-game fidelity.
