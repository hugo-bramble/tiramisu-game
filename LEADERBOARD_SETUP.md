# Global Leaderboard Setup (10 minutes)

The game has a global leaderboard ready — it just needs a Firestore database to talk to. **Without setup, the leaderboard falls back to local-only on each device.**

## Setup steps

1. **Create a Firebase project** — go to https://console.firebase.google.com → "Add project" → name it `chelsea-tiramisu` (or anything). Skip Google Analytics.

2. **Enable Firestore** — in the project dashboard:
   - Build → Firestore Database → "Create database"
   - Choose a location (eur3 / london is closest)
   - Select **"Start in test mode"** for now (allows public read/write — fine for a casual game)

3. **Get your Project ID** — Project settings (gear icon top-left) → General tab → look for "Project ID" (e.g. `chelsea-tiramisu`).

4. **Add it to the build** — create a `.env` file in the repo root with:
   ```
   VITE_FIRESTORE_PROJECT_ID=your-project-id-here
   ```
   Or add it as a GitHub Actions repo secret named `VITE_FIRESTORE_PROJECT_ID` and tweak the workflow to pass it as an env var during build.

5. **Push** — the workflow rebuilds & deploys. Leaderboard goes live globally on next page load.

## How it works

- On game over, scores ≥ 1m are POSTed to `firestore.googleapis.com/.../leaderboard`
- The Welcome screen's 🏆 button fetches the top 25 globally
- Without `VITE_FIRESTORE_PROJECT_ID` set, the app falls back to localStorage-only leaderboard

## Notes

- **Test mode is open** — anyone can write/read your collection. Bot vandalism risk.
- For production, lock down with **Firestore rules** that:
  - Reject scores > some sane max (e.g., 50000cm)
  - Rate-limit per IP via App Check or a Cloudflare Worker proxy
  - Validate payload shape

Sample rule that caps insanity:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leaderboard/{doc} {
      allow read: if true;
      allow create: if request.resource.data.cm is int
                    && request.resource.data.cm > 0
                    && request.resource.data.cm < 50000
                    && request.resource.data.name is string
                    && request.resource.data.name.size() <= 20;
      allow update, delete: if false;
    }
  }
}
```
