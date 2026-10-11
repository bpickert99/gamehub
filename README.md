# Game Hub

A small site for playing board games with friends remotely. Pick a game from the catalogue, share the 4-letter code (or invite link), and the host starts once everyone is in.

Runs entirely on Firebase's free Spark plan: Realtime Database for live rooms, anonymous Auth so each browser keeps its seat after a refresh, and Hosting for the site. Nothing to maintain, and the free plan does not pause from inactivity.

## Deploying

Every push to `main` builds the site and deploys it (plus the database rules) to <https://gamehub-19816.web.app> using GitHub Actions (`.github/workflows/deploy.yml`). You can also run it by hand from the repo's **Actions → Deploy to Firebase → Run workflow**.

One-time setup, all in the browser:

1. Firebase console → **Authentication → Sign-in method** → enable **Anonymous**.
2. Google Cloud console → **IAM & Admin → Service accounts** (project `gamehub-19816`) → **Create service account** named `github-deploy`, with roles **Firebase Admin** and **API Keys Viewer**.
3. Open that service account → **Keys → Add key → Create new key → JSON**. A file downloads.
4. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**. Name it `FIREBASE_SERVICE_ACCOUNT` and paste the whole contents of the JSON file.

## Local development

```sh
npm run dev
```

This talks to your real Firebase project, so you can test locally with friends' rooms showing up live.

## How it works

- `src/games/catalogue.ts`: the list of games shown on the hub (placeholders for now).
- `src/rooms.ts`: creating, joining, kicking, starting, and presence (online/offline dots).
- `database.rules.json`: who may do what. Only the host can start or kick, kicked players can't rejoin, and nobody can join after the game starts. Min/max player counts are enforced by the app UI, since Firebase rules can't count players.
