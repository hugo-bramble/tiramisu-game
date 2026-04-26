// ─── GLOBAL LEADERBOARD via Firestore REST API ──────────────────────────────
// To enable global leaderboard:
// 1. Go to https://console.firebase.google.com → create new project
// 2. Build → Firestore Database → Create database → Start in TEST MODE
// 3. Copy your projectId from project settings
// 4. Paste it in PROJECT_ID below (or set VITE_FIRESTORE_PROJECT_ID in .env)
// 5. Commit & push — leaderboard goes live globally
//
// Test-mode rules allow anyone to read/write. For production you'd
// want hardened rules + a Cloudflare Worker proxy or App Check token.
const PROJECT_ID = import.meta.env.VITE_FIRESTORE_PROJECT_ID || '';
const COLLECTION = 'leaderboard';

const isConfigured = () => !!PROJECT_ID;

const baseUrl = () =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}`;

export async function fetchGlobalLeaderboard(limit = 25) {
  if (!isConfigured()) return null;
  try {
    // Use runQuery for ordered + limited results (more efficient than client-side sort)
    const queryUrl =
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
    const body = {
      structuredQuery: {
        from: [{ collectionId: COLLECTION }],
        orderBy: [{ field: { fieldPath: 'cm' }, direction: 'DESCENDING' }],
        limit,
      },
    };
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data || [])
      .filter(d => d.document)
      .map(d => ({
        name: d.document.fields?.name?.stringValue || 'Anonymous',
        cm: parseInt(d.document.fields?.cm?.integerValue || '0', 10),
        date: parseInt(d.document.fields?.date?.integerValue || '0', 10),
      }));
  } catch (e) {
    return null;
  }
}

export async function postScore(name, cm) {
  if (!isConfigured()) return false;
  try {
    const safeName = String(name || 'Anonymous').slice(0, 20);
    const safeCm = Math.max(0, Math.min(1000000, Math.floor(cm)));
    const body = {
      fields: {
        name: { stringValue: safeName },
        cm: { integerValue: String(safeCm) },
        date: { integerValue: String(Date.now()) },
      },
    };
    const res = await fetch(baseUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export const isGlobalLeaderboardConfigured = isConfigured;
