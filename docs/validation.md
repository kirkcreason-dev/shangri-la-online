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
4. Replace the imperfect board photograph and reconcile visual components before making any replica claim. Official beta branding does not establish complete game fidelity.

This is an official online beta, now publicly accessible. Passing these checks does not make it a complete or release-ready replica.

## Firebase rooms and chat update

- 117 unit/engine tests pass, including chat validation, authoritative authors, duplicate retry handling, cooldowns, and bounded history.
- TypeScript and targeted ESLint checks pass; the production build succeeds.
- Firestore emulator checks pass for atomic creation, stale game revisions, independent chat writes, persistent history, and room creation limits.
- HTTP checks pass for two and six independent players using Firestore: join, ready, start, private-state filtering, simultaneous-turn rejection, movement, and synchronized views.
- Chat HTTP checks pass in both D1 and Firestore modes: membership, author spoof prevention, concurrent authors, retry idempotency, rate/length limits, reconnect, and unchanged game revision.
- Browser verification confirms sending with Enter, displaying the server-authorized name, clearing the sent draft, and retaining the message after a reload.
- The production Firebase project and default database are separate from emulator test data. Production activation requires the server's database credential and a deployment with that secret configured. Site sharing remains separate from room invitations.
