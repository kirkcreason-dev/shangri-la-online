# Rules edition 3 validation

Validated locally September 29, 2026.

- 114 engine tests pass (`npm test`), covering baseline play and the new lifecycle/control paths. These include Casket before death loss, Mortal Combat exclusion, Ring replacement before fatal/victory effects, borrowed-power range and timing, all Bone paths, expiry, delegated actions, privacy, capacity/cures, Crystal Ball inspection, and 42 new possession/reaction scenarios.
- TypeScript checks pass (`npx tsc --noEmit`).
- Persisted HTTP scenarios pass for both two and six independent cookie sessions (`python3 tests/multiplayer.integration.py`, with the local dev server on port 4179). They exercise lobby setup, spectators, authorization, simultaneous-write conflicts, movement, temporary control, timed expiry, reconnects, Casket recovery, Ring replacement, persisted cross-player card responses, duplicate-response conflicts and saved victory. The tests stage local card/ending fixtures only in newly created integration rooms; they are scripted scenarios, not complete human acceptance playtests.
- Browser checks cover creating and starting a table, selecting a character, adding a practice opponent, drawing King High Bone through the shared controls, its visible countdown, removed token, and unavailable trade/rule controls during absence.
- Browser checks also cover Behind the Paint before rolling, host control of a practice opponent’s Toy Box response, reloading a pending response, and resuming destination selection.
- Production build and archive validation run through the Sites publishing workflow.

Old rules editions remain readable and require a new table for edition 3. No existing room state is converted or deleted. The test scenarios use local D1 storage; deployment access remains unchanged.

## Remaining release gates

1. Reconcile the printed inventory (110/90/70 Action cards, 42 Purchase) with recovered records (101/90/69, 40 Purchase). Identify missing cards and confirm duplicate quantities; resolve the three provisional titles.
2. Automate and verify the remaining 126 component records with conditional/manual effects, plus exceptional cross-card interactions. For example, a Random Bone Generator result of zero has no printed result in some tables; the game opens a logged ruling rather than inventing one. Table dice are explicitly raw and require manual modifiers.
3. Verify the disclosed timing conventions against publisher rulings or consistent physical play. Run complete multi-person acceptance games, including mobile use and real disconnects. Pending card responses currently pause the table until their controlling seat returns; there is no automatic timeout.
4. Replace the imperfect board photograph and reconcile visual components before making any replica claim. No official status is claimed.

This update is a private assisted-tabletop build. Passing these checks does not make it a complete or release-ready replica.
