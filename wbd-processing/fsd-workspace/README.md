# Chess Hive — Project README

This repository contains two main parts:

- `chesshive-react/` — React Single Page Application (frontend)
- `ChessHivev1.0.2/` — Legacy Express server + Socket.IO (backend)

This README documents how to run the website locally, what each route does, where data is loaded from, database collections, and developer notes for extending the project.

---

## Quick start (prerequisites)
- Node.js (v14+ recommended)
- npm (or yarn)
- MongoDB (local `mongod` or cloud MongoDB Atlas)
- Windows PowerShell (commands below assume PowerShell on Windows)

## Run backend (Express + Socket.IO)
1. Open PowerShell, go to the server folder:
```powershell
cd .\ChessHivev1.0.2\
npm install
node app.js
```
2. The server uses `PORT` environment variable or defaults to `3000`. The server console prints the active port.

Notes: `app.js` sets up `express-session` and `socket.io`. Many endpoints rely on `req.session` for authentication.

## Run frontend (React SPA)
1. Open a new PowerShell and start the React dev server:
```powershell
cd .\chesshive-react\
npm install
npm start
```
2. By default CRA runs on port `3000`. If your backend is already using `3000`, choose another port for React:
```powershell
#$env:PORT=3001; npm start
```

Deployment: You can build the frontend with `npm run build` in `chesshive-react` and serve `build/` via the Express server.

---

## Project structure overview

- `chesshive-react/` — frontend
  - `src/index.js` — React entry point
  - `src/App.js` — client-side routes (maps URL paths to page components)
  - `src/pages/` — page components (Home, Login, ContactUs, player/*, organizer/*, coordinator/*, admin/*)
  - `src/index.css` — global styles and theme variables

- `ChessHivev1.0.2/` — backend
  - `app.js` — Express app, session setup, Socket.IO server, and mounting of routers
  - `player_app.js` — player router (mounted at `/player`) with JSON APIs under `/player/api/*`
  - `routes/auth.js` — signup/login, server-rendered pages, and `POST /contactus` (form flow)
  - `routes/databasecongi.js` — DB connect helper (exports `connectDB()`)
  - `views/` and `public/` — server templates and static assets

---

## Key frontend routes (client-side pages)
These are defined in `src/App.js` and map to React components. Examples:

- `/` → `Home`
- `/login` → `Login`
- `/signup` → `Signup`
- `/contactus` → `ContactUs` (client form posts JSON to `/api/contactus`)
- `/player/player_tournament` → `PlayerTournament` (fetches `/player/api/tournaments`)
- `/player/player_chat` → `PlayerChat` (uses Socket.IO and fetches `/api/chat/history`, `/api/chat/contacts`)

There are many other role-specific routes — see `src/App.js` for the full list.

---

## Key backend routes and APIs
The Express server exposes both server-rendered pages and JSON APIs. Important endpoints:

- Authentication & session:
  - `POST /api/login` — login (creates session)
  - `POST /api/login/mfa-verify` — MFA verification
  - `GET /api/session` — returns session info as JSON

- Chat & realtime (Socket.IO):
  - `io.on('connection')` handles `join`, `chatMessage`, `chessJoin`, `chessMove` and persists to `chat_messages`.
  - `GET /api/chat/history` — returns last messages for a room
  - `GET /api/chat/contacts` — returns user's contacts summary

- Player APIs (in `player_app.js`, mounted at `/player`):
  - `GET /player/api/profile` — player profile, wallet, stats
  - `GET /player/api/tournaments` — list of approved tournaments + enrollment data
  - `POST /player/api/join-individual` — enroll individual player
  - `POST /player/api/join-team` — enroll team
  - `GET /player/api/pairings` — compute/return pairings (uses `swissPairing()`)
  - `GET /player/api/rankings` — tournament rankings
  - `GET /player/api/store` — shop items and wallet
  - `POST /player/api/buy` — purchase item
  - `POST /player/api/add-funds` — add wallet balance (form flow in auth router also exists)

- Contact form:
  - `POST /contactus` (in `routes/auth.js`) — server-rendered form handler that inserts into `contact` collection and redirects to a page.
  - NOTE: Frontend `ContactUs.jsx` posts JSON to `/api/contactus` and expects a JSON response. The server currently does not expose `/api/contactus`. See "Mismatch" below.

---

## Data flow examples

1) Player tournaments page (`/player/player_tournament`)
  - Frontend mounts `PlayerTournament` and fetches `/player/api/tournaments`.
  - `player_app.js` queries MongoDB (`tournaments`, `user_balances`, `tournament_players`, `enrolledtournaments_team`, `subscriptionstable`) and returns JSON with tournaments, enrolled lists, wallet balance and subscription info.
  - Frontend renders the list and shows Join buttons.

2) Join individual tournament
  - Frontend POSTs to `/player/api/join-individual` with `{ tournamentId }`.
  - Backend checks `req.session`, validates user, checks wallet balance and subscription, deducts entry fee in `user_balances`, inserts into `tournament_players` and returns JSON success.

3) Chat (realtime)
  - Clients connect via Socket.IO to the same server; after `join` events, messages are emitted and persisted to `chat_messages`.

---

## Database collections (overview)

- `users` — users and roles (`player`, `coordinator`, `organizer`, `admin`)
- `user_balances` — wallet balance per user
- `tournaments` — tournament metadata (name, date, entry_fee, status, type)
- `tournament_players` — individual enrollments
- `enrolledtournaments_team` — team enrollments
- `tournament_pairings` — stored pairings and results
- `player_stats` — player stats and ratings
- `chat_messages` — chat history
- `products`, `sales` — store inventory and purchases
- `contact` — messages from Contact Us
- `subscriptionstable` — subscription records

---

## Known issues / mismatches and recommended fixes

- Contact Us mismatch:
  - Frontend `ContactUs.jsx` sends JSON to `/api/contactus` and expects JSON response.
  - Server currently implements `POST /contactus` (form submit + redirect) in `routes/auth.js`.
  - Fix options:
    1. Add `POST /api/contactus` that accepts JSON, inserts into `contact`, and returns JSON `{ success: true }`.
    2. Or change frontend to submit a classic form POST to `/contactus` and handle redirect.

- Dev port conflict: Both backend and frontend default to port `3000`. Use `PORT` env or run React on another port.

- Session and cookies: The backend uses `express-session`. When using CRA dev server, ensure API calls are proxied or cookies are shared properly.

---

## Developer notes & tips

- Environment variables you should set in production or local `.env` (recommended):
  - `PORT` — server port
  - `MONGO_URI` — MongoDB connection string
  - `SESSION_SECRET` — express-session secret
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — if using nodemailer to send email notifications

- To add admin notifications for contact messages:
  - Option A (email): use `nodemailer` in `routes/auth.js` when inserting into `contact`.
  - Option B (socket): emit `io` event to an admin room; admin UI listens for `new-contact` events.
  - Option C (UI): build an admin page that queries `contact` and shows unread messages.

- Regenerate the Word doc from markdown (we include a script):
  - `python .\scripts\md_to_docx.py chesshive-react/docs/Website_Flow_Telugu.md chesshive-react/docs/Website_Flow_Telugu.docx`

---

## Where I edited files recently
- Updated frontend CSS and player pages to use theme variables (dark mode improvements).

---

If you want, I can now:
- Add `POST /api/contactus` JSON endpoint and optionally send admin email (need SMTP creds), or
- Create an admin UI page to read contact messages, or
- Translate this README/flow doc to Telugu script.

Tell me which of these you'd like me to implement next.
