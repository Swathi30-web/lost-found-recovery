# Lost & Found Item Recovery System

React + TypeScript + Vite + Tailwind CSS + React Router + Axios + JSON Server (no external APIs).

## Run locally
```bash
npm install
npm run dev        # starts JSON Server (:3001) and Vite (:5173) together
```
Open http://localhost:5173. Reset demo data any time with `npm run reset-db`.

| Role   | Email        | Password |
|--------|--------------|----------|
| Admin  | admin@lf.com | admin123 |
| Staff  | staff@lf.com | staff123 |
| User   | user@lf.com  | user123  |
| User 2 | meena@lf.com | user123  |

## Feature map (spec section 4)
- **Auth & access** – login/logout, role-based routes (`Protected`), session in localStorage; deactivated users cannot log in.
- **Lost reports** – create / view / edit / status management, image upload + preview, contact preference, duplicate prevention.
- **Found items** – register / edit (staff) with storage location and status.
- **Search & matching** – filter by name, category, location, date, status; sort newest/oldest. Matches are auto-generated on every new report
  (category 35 + keywords 30 + location 20 + date window 15, threshold 55) and **confirmed or dismissed by the owner or staff**.
- **Claims & verification** – Submitted → Under Review → More Information Required → Approved / Rejected; verification records; claimant can reply to info requests.
- **Handover** – an approved claim creates a handover: Ready for Handover → Handed Over (date + verifier recorded) → Closed.
- **Status tracking** – every change writes a timestamped `activityLogs` entry shown as "Activity history".
- **Notifications** – match suggestions, claim updates, info requests, handover updates; unread badge; mark read.
- **Admin dashboard & reports** – totals, lost/found/claim status summaries, category-wise report, handover history; user & category management.
- **Validation / states** – required fields, no future dates, duplicates blocked, loading / empty / error / success states.

All data goes through Axios to JSON Server (`users, categories, lostReports, foundItems, matchSuggestions, claims, verifications, handovers, notifications, activityLogs`).

## Deploy
JSON Server needs a running server, so a static host alone is not enough.
- **Vercel (all-in-one):** import the repo. `vercel.json` + `api/index.cjs` host JSON Server as a serverless function at `/api`
  (demo data lives in `/tmp`, so it resets on cold starts).
- **Netlify:** deploy the frontend (`netlify.toml` included) and host JSON Server elsewhere (Render, Railway, ...
  `npx json-server db.json --host 0.0.0.0 --port $PORT`), then set the env var `VITE_API_URL=https://your-api-host`.
