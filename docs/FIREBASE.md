# Firebase online rooms and chat

The server can save new rooms in Firestore. Existing D1 rooms continue in D1. Game actions use optimistic concurrency; two actions from the same revision cannot both win. Chat is separate from game state, so sending a message cannot invalidate a dice roll or card response.

## Production setup

Project: `shangri-la-online-game`. Create the default Firestore database in production mode. Keep the rules in `firestore.rules`: deny direct client access. The browser uses the game's room API and existing HttpOnly session cookie. It never receives a service account key, deck order, or another player's session identifier.

Create a dedicated server service account with the Cloud Datastore User role (`roles/datastore.user`) on this project. Store its JSON credential in the hosting provider's encrypted server secret `FIREBASE_SERVICE_ACCOUNT`, and set `FIREBASE_PROJECT_ID=shangri-la-online-game`. Do not put the credential in Git, browser code, public variables, or a deployed asset. Deploy the new environment revision together with this code. Do not enable these variables until the database and credential are ready.

No Firebase browser configuration, Analytics, or paid upgrade is required. This does not change who can access the hosted site: friends need access to the site as well as the room link.

## Local verification

Start the official Firebase emulator with:

```
npx firebase-tools@15.32.0 emulators:start --only firestore --project demo-shangri-la
```

Use an ignored `.dev.vars` file containing:

```
FIREBASE_PROJECT_ID="demo-shangri-la"
FIRESTORE_EMULATOR_HOST="127.0.0.1:8188"
```

Restart the dev server on port 4179. `node tests/firestore.integration.mjs` checks atomic writes, conflict handling, persistent chat and creation limits against the emulator. `python3 tests/chat.integration.py` checks two independent browser sessions through the HTTP API. Remove `.dev.vars` and restart to test D1 mode; apply the SQL migrations to local D1 first. `python3 tests/multiplayer.integration.py` exercises full two- and six-player games in D1 mode.

Messages are restricted to players who joined the room. Names and authors come from the server's player records. Each message has a retry identifier, a 500-character limit, and a two-second per-player cooldown. Each room retains the latest 100 messages. Chat works in the lobby, during turns, and after the game. Updates poll every two seconds; hidden tabs pause chat polling. Losing the session cookie loses control of that seat, just as before this change.
