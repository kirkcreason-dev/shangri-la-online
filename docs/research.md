# Component research — September 29, 2026

The scanned printed rulebook and a community Tabletop Simulator inventory are the evidence behind this assisted edition. Their card totals disagree; the app is not a complete retail replica.

## Sources

- [Scanned 12-page rulebook](https://drive.google.com/file/d/1B5uLPQUczukkIaobj1eUxzcDutSJ-1Ml/view), especially the contents on page 1, setup and maximum Combat Bonus on page 2, and ending explanations on pages 8–9.
- [Community Tabletop Simulator mod](https://steamcommunity.com/sharedfiles/filedetails/?id=3079987608).
- [Public mod data](https://cdn.steamusercontent.com/ugc/2208514167419734330/45F0ED0C677AEA69B021A1117CCABA7CA799F8B5/).
- [Board photograph](https://cdn.steamusercontent.com/ugc/2208514167401741381/685D77C4EC146B157FB5180623B94D921B0A1B36/).
- Every component in `lib/rules/cards.json` links to its source photograph. Character and space records are in `lib/rules/characters.json` and `lib/rules/spaces.json`.

## Inventory discrepancy

| Deck | Printed contents, page 1 | Recovered playable records |
| --- | ---: | ---: |
| Detroit | 110 | 101 |
| Nethervoid | 90 | 90 |
| Dark Carnival | 70 | 69 |
| Purchase | 42 | 40 |
| Bones | 13 | 13 |

These are counts of physical objects, not unique titles. The Detroit inventory repeats a 19-card atlas; determining which repeated faces belong in a retail set requires a complete physical inventory. The Purchase stack contains two Cash objects excluded from the 40 playable Item cards. The matching Nethervoid total alone does not prove identity or copy-count fidelity. Missing identities must not be invented to pad the decks.

Three Detroit title readings remain provisional: the Homie at source card 3300 and the two challenge cards 7910/8010. The card records retain their source notes. The rulebook describes all ten endings, although the recovered mod has eight ending objects. The ten implemented structures use the rulebook explanations.

The character photograph reads Mack Benjamin, while the rulebook contents list Hack Benjamin. The game retains the photographed record name. This is a source disagreement, not simply a mistaken secondary listing.

All 60 board spaces (28 Detroit, 20 Nethervoid, 12 Dark Carnival) and all 18 character records have been mapped. The board photograph has glare and edge cropping. Card artwork is not reproduced. Mechanical summaries are newly worded; verification against the complete physical game remains in progress.

## Implemented timing conventions

Rules edition 3 integrates Casket before ordinary death or inheritance, defers newly revealed endings for a Psychopathic Ring decision, recalculates printed borrowed powers by current positions, and persists Bone durations and delegated control. King High Bone uses a server timestamp ten real minutes after the draw, including disconnect time. Crystal Ball peeks are visible only to the controlling seat.

The sources do not resolve every interaction. This table counts timed Bones over future full turns after applying them immediately, uses stable lobby order for the left-hand seat, gives Amputation's three-Item cap precedence over Backpack, and cures Concussion on an unmodified movement total of six. Borrowed powers are printed powers, not recursively borrowed copies. These conventions are shown in the game; they are not presented as verified publisher rulings.

126 component records still require some table adjudication, including conditional Action cards and exceptional Item/Homie effects. Logged controls support cooperative play but are not a complete rules engine. Full release requires the missing inventory, remaining effects, and real multi-person acceptance playtesting.

## Conditional Items and Homies update

Core paths for 52 additional records are now automated, leaving 126 records marked for table adjudication. Bridget, Fat Tittie Kittie and Fat Sweaty Betty have female-Homie metadata based on explicit pronouns on their source cards. The uncertain card 3300 and Milenko's Hat remain marked for review; the latter opens a ruling after placing the target because its off-turn arrival sequence is not specified.

Choices are recorded before bonuses, rerolls and Life-saving effects commit. The original action and private random tape replay with accepted choices; unfinished changes are not published to opponents. Reroll priority is the roller followed by stable lobby order, with the first replacement accepted. A pending response pauses the table, including practice opponents, whose choices belong to the host. Active Item buttons are available at safe action boundaries; exceptional simultaneous card conflicts still need the shared table controls. Noosawaa's beneficial immunity is applied automatically. These timing conventions are implementation choices, not verified publisher rulings.

Dr. Dinglenut's creation count follows him on transfer. Borrowed Items retain their single-use marker through trades. Blow-up Doll can replace a required Homie discard; Rocket Launcher recoil resolves after the combat penalty and before victory is awarded. Tests cover these paths, but not every combination with conditional Fiends or endings.
