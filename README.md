# Game Hub

A small site for playing board games with friends remotely. Pick a game from the catalogue, share the 4-letter code (or invite link), and the host starts once everyone is in.

Runs entirely on Firebase's free Spark plan: Realtime Database for live rooms, anonymous Auth so each browser keeps its seat after a refresh, and Hosting for the site. Nothing to maintain, and the free plan does not pause from inactivity.

## One-time setup

1. Go to <https://console.firebase.google.com> and create a project (Google Analytics is not needed).
2. **Build → Authentication → Get started → Sign-in method** → enable **Anonymous**.
3. **Build → Realtime Database → Create database** → pick a location → start in **locked mode** (the real rules get deployed in step 6).
4. **Project settings (gear icon) → Your apps → Web (`</>`)** → register an app. Copy the `firebaseConfig` values into `src/firebaseConfig.ts`. Make sure `databaseURL` is filled in; if it is missing, copy it from the top of the Realtime Database page.
5. Install and log in:
   ```sh
   npm install
   npx firebase login
   npx firebase use --add   # pick your project
   ```
6. Deploy the site and the database rules:
   ```sh
   npm run deploy
   ```
   The site is then live at `https://<your-project-id>.web.app`.

## Local development

```sh
npm run dev
```

This talks to your real Firebase project, so you can test locally with friends' rooms showing up live.

## How it works

- `src/games/catalogue.ts`: the list of games shown on the hub (placeholders for now).
- `src/rooms.ts`: creating, joining, kicking, starting, and presence (online/offline dots).
- `database.rules.json`: who may do what. Only the host can start or kick, kicked players can't rejoin, and nobody can join after the game starts. Min/max player counts are enforced by the app UI, since Firebase rules can't count players.
