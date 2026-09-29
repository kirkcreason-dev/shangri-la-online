# Shangri-La Online

An unofficial, playable browser adaptation inspired by **The Quest for Shangri-La**. This is a prototype, not an official release or a perfect replica. No endorsement by ICP, Psychopathic Records, or Dark Carnival Games is claimed.

## Play

Enter a name, choose one of the 18 character names, and create a table. Copy its invite link so friends can join. Everyone marks themselves ready and the host starts. Tables support 2–6 players; a host can add practice opponents for solo play.

Roll, choose a highlighted destination, then resolve an encounter or challenge another player in your space. Improve your combat bonus, cross the three regions, and defeat the guardian at Shangri-La. The in-game **Rules & sources** panel explains this version.

Seats reconnect in the same browser using a persistent, HTTP-only cookie. Save the invite link. Clearing cookies loses control of that seat. Rooms save after every action. Anyone who knows a room code can watch; they can join only before the game starts. There is no lobby listing, kick feature, or turn timer.

Site access is separate from room invitations. A private hosted preview is available only to the owner until its audience is changed to allow other visitors.

## Implemented

- Original board photograph with all 60 spaces mapped across Detroit, Nethervoid, and Dark Carnival.
- 18 selectable character names; uniform prototype starting stats.
- Shared rooms, ready controls, turn ownership, saved state, reconnection, spectators, and practice opponents.
- Server-generated dice and shuffled encounters. Future deck contents and session credentials are never sent to the browser.
- Movement, regional passages, encounters, combat, supplies, healing, player challenges, one rebirth, elimination, and victory.
- Optimistic concurrency prevents double actions. Clients poll every two seconds and refresh after conflicts.
- Desktop and phone layouts; keyboard-accessible move choices.
- Optional WebMCP tools to read the current table and perform validated game actions.

## Differences from the physical game

The 48 encounter cards and one guardian ending are newly written. Setup, passage tolls, location effects, inheritance, and the finale are simplified. Every character starts with 5 life, 2 combat bonus, $300, and a tonic. Character powers, original card decks, trading, ranged combat, Bones effects, and the original ten endings are not implemented. Printed board instructions are reference material; the action panel controls the prototype rules.

The board reference photograph has glare and slight cropping. It is not a clean publisher-supplied scan. Research links and remaining gaps are in [docs/research.md](docs/research.md); factual character setup references are preserved separately and are not active game rules.

## Local development

Requires Node.js 24+ for the test runner, npm, and Git for publishing. The app uses React, Vinext, Cloudflare Workers, and D1.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_solid_echo.sql
npm run dev -- --host 127.0.0.1 --port 4179
```

Apply the migration only once to a fresh local database. Game data stays in ignored `.wrangler/state`. No external API keys are required. `.openai/hosting.json` identifies this Site and requests its D1 binding; use the Sites plugin workflow to publish this project. For a different hosting account, configure its Worker and D1 bindings explicitly rather than reusing the Site identifier.

```sh
npm test
npx tsc --noEmit
npm run build
```

Engine tests cover ownership, readiness, legal movement, resource requirements, hidden state, encounter sequencing, death and rebirth, bots, and complete simulated matches. Local integration checks also verified two separate player sessions, reconnection, spectators, concurrent requests, stale revisions, and a complete shared turn. Browser QA verified creating a room, adding a practice opponent, playing actions, and tool error handling.

## Source and artwork

Original application code and adaptation text were created for this project. The board photograph and referenced game artwork belong to their respective creators. Public availability does not establish a redistribution license. The full rulebook and original card/character scans are not bundled in this app, and no license to third-party materials is granted here.
