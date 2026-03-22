# ChessHive — Detailed Technical README

> Comprehensive mapping of architecture, files, APIs, data stores and flows for the ChessHive project.

---

## 🚀 Project Summary
ChessHive is a campus-focused chess community platform with multiple user roles (player, coordinator, organizer, admin). It supports signup/login (OTP-based), tournaments (create/approve/enroll/pairings), matchmaking & live matches, store & product sales, meetings scheduling, notifications, and player profiles.

Key folders:
- `Chesshivev1.0.2/` — legacy/monolithic backend server (Express + MongoDB + EJS views + API endpoints). Main runtime: `app.js`.
- `chesshive-react/` — React frontend (SPA) using React Router and Redux slices for features.

---

## 📁 Repo layout (high level)
- Chesshivev1.0.2/
  - `app.js` — main Express server; mounts routers and defines global APIs (login, OTP verify, notifications, session, etc.). Uses express-session.
  - `organizer_app.js`, `coordinator_app.js`, `player_app.js`, `admin_app.js` — role-specific routers with REST endpoints.
  - `routes/*` — helper routes like `auth.js` (signup, OTP flow) and `databasecongi.js` (Mongo connection & collection initialization).
  - `public/js/*` — client side scripts (legacy pages) e.g., `tournament_management.js`.
  - `utils.js` — small helpers used across apps.
- chesshive-react/
  - `src/pages/*` — React pages (PlayerTournament, Login, Signup, Player dashboard pages, Coordinator/Organizer pages, ContactUs etc.)
  - `src/features/*` — redux slices (auth, notifications, products, sales)
  - `src/components/*` — UI components used by pages

---

## 🧭 Architecture Overview
This section describes how pieces fit together and where responsibilities lie.

### Backend responsibilities
- **Auth & Sessions**: `app.js` and `routes/auth.js` handle signup, login, OTP generation and verification, and session establishment (stored in `req.session`).
- **Data layer (repositories)**: MongoDB collections are defined and validated in `routes/databasecongi.js`. Collections include `users`, `tournaments`, `products`, `sales`, `meetingsdb`, `notifications`, `otps`, `signup_otps`, `user_balances`, `subscriptionstable`, `player_stats`, `tournament_pairings`, etc.
- **Domain logic**: Coordinators create tournaments and pairings (`coordinator_app.js`), organizers approve/reject tournaments and manage store/sales (`organizer_app.js`), players interact with tournaments and matchmaking (`player_app.js`). Pairings algorithm (Swiss pairing) is implemented in `coordinator_app.js` (`swissPairing`).
- **Matchmaking & live matches**: `player_app.js` contains in-memory matchmaking structures (`queue`, `tickets`, `matches`, `pendingRequests`) and APIs to request/accept matches and submit moves. Currently implemented as a poll-based or server-push model; `socket.io` is available (dependency present) for future real-time hub work.
- **Payments & Wallet**: Wallet balances stored in `user_balances` and updated by `/player/add-funds`, subscriptions deducted and stored in `subscriptionstable`, product purchases inserted into `sales`.
- **Notifications**: Stored in `notifications` collection; player-facing endpoints exist at `/api/notifications` and `/api/notifications/mark-read`.

### Frontend responsibilities
- **Pages** call backend REST endpoints for the flows:
  - `Login` -> POST `/api/login`, POST `/api/verify-login-otp`
  - `Signup` -> POST `/api/signup` and `/api/verify-signup-otp`
  - `PlayerTournament` -> GET `/player/api/tournaments` (shows tournaments + enrollment)
  - Store pages -> GET `/organizer/api/store` or `/coordinator/api/store/products` and POST purchase actions
  - Notifications UI -> GET `/api/notifications`
- **Redux** slices sync server state for notifications, products, sales, and auth.

---

## 🔗 Detailed API & File Map (key endpoints)
All backend code is in `Chesshivev1.0.2/` unless specified.

### Authentication & sessions
- POST `/api/signup` (routes/auth.js) — takes signup form, stores signup data in `signup_otps` and sends OTP.
- POST `/api/verify-signup-otp` — validates OTP and creates a `users` entry; initializes `user_balances` for players.
- POST `/api/login` (app.js) — validates email/password, generates a login OTP inserted into `otps`, emails OTP.
- POST `/api/verify-login-otp` — validates and sets session (`req.session.userID`, `userEmail`, `userRole`, username, college, etc.).
- GET `/api/session` — returns session summary to client.

### Tournaments & Pairing
- Coordinator:
  - GET `/coordinator/api/tournaments` — fetch tournaments for coordinator (coordinator_app.js)
  - POST `/coordinator/api/tournaments` — create a tournament
  - PUT `/coordinator/api/tournaments/:id` — update tournament
  - DELETE `/coordinator/api/tournaments/:id` — soft remove tournament
- Organizer:
  - GET `/organizer/api/tournaments` — list tournaments (organizer_app.js)
  - POST `/organizer/api/tournaments/approve` — mark `status: 'Approved'`
  - POST `/organizer/api/tournaments/reject` — mark `status: 'Rejected'`
- **Pairings**: `coordiantor_app.js` implements `swissPairing(players, totalRounds)` which sorts by score, avoids repeats, assigns byes, and generates per-round pairings (stored in `tournament_pairings` collection).

### Players & Matchmaking
- POST `/player/api/request-match` — enqueue and create `tickets` in-memory; if queue pairs, a match is created and `tickets` updated with `matchId`.
- POST `/player/api/match/request` — targeted request to another user; stored as `pendingRequests` in memory.
- POST `/player/api/match/accept` — accept request, create a `matchId`, assign colors.
- GET `/player/api/match/:matchId` — get match info / role
- POST `/player/api/match/:matchId/move` — submit a move; stored in `matches` map (moves array) and optionally update `state.fen`.
- Poll-based endpoints for ticket/status: GET `/player/api/match/ticket/:ticketId`.

> Note: matchmaking uses in-memory data structures; if you need persistence or horizontal scaling, migrate to DB-backed or WebSocket-based match hubs.

### Store & Sales
- GET `/organizer/api/store` — list `products` and aggregated `sales`
- POST `/coordinator/api/store/addproducts` — add product document to `products` collection
- Purchases: purchases create a `sales` document and update `user_balances` (wallets) via `/player/add-funds` and purchase endpoints that decrement wallets.

### Meetings & Notifications
- POST `/organizer/api/meetings` — insert into `meetingsdb`
- GET `/organizer/api/meetings/organized` — meetings organized by the session user
- GET `/api/notifications`, POST `/api/notifications/mark-read`

### Contact & Feedback
- `/api/contactus` (legacy and JSON): validates submitter and inserts into `contact` collection.
- Feedback endpoints exist to request feedback for tournaments and insert `feedbacks` documents.

---

## 🗄️ Database schema & collections (summary)
File: `routes/databasecongi.js` initializes validators for major collections. Key collections:
- `users` — schema with required `name,email,password,role,isDeleted` (role enum: admin/organizer/coordinator/player)
- `tournaments` — name, date, location, entry_fee, status, added_by, type, no_of_rounds
- `tournament_pairings` — stores pairings, rounds, bye info
- `feedbacks` — tournament feedback per player
- `user_balances` — wallet_balance per `user_id`
- `subscriptionstable` — subscription periods
- `products` and `sales` — store data
- `meetingsdb` — meetings scheduled by organizers/coordinators
- `notifications` — player notifications (e.g., feedback_request)
- `otps`, `signup_otps` — OTP storage for login/signup
- `player_stats`, `tournament_players`, `enrolledtournaments_team` — tournament/player enrollment and stats

---

## 🔁 Typical Data Flows (step-by-step)
### 1) Signup -> Verify -> Create user
1. Frontend POST `/api/signup` with signup data; server validates and stores in `signup_otps` + generates OTP (collection `otps`).
2. Email OTP (nodemailer). Frontend asks user to enter OTP.
3. POST `/api/verify-signup-otp` validates OTP, creates `users` entry, creates a `user_balances` document for players, sets `req.session` and redirects to role-specific dashboard.

### 2) Login flow (email + password -> OTP)
1. POST `/api/login` with email+password; server verifies credentials.
2. If user exists, generate OTP stored in `otps` and send by email (Ethereal fall-back available if no SMTP configured).
3. POST `/api/verify-login-otp` validates OTP and sets session values (userEmail, userRole, username, userCollege).

### 3) Create/Approve Tournament
1. Coordinator POST `/coordinator/api/tournaments` to create tournament; document added with `status: 'Pending'`.
2. Organizer reviews and POST `/organizer/api/tournaments/approve` to set `status: 'Approved'` and populate `approved_by`, `approved_date`.
3. When tournament begins or when pairing requested, `coordinator_app.js` uses swiss pairing to compute rounds and writes `tournament_pairings` collection.

### 4) Enroll & Tournament Player Lifecycle
1. Players enroll (flow may be stored in `tournament_players` or `enrolledtournaments_team` depending on team vs individual).
2. Once enrolled, pairings reference players; match results update `player_stats` and leaderboard computed via `GET /player/api/rankings`.

### 5) Matchmaking & Moves
1. Player POST `/player/api/request-match` -> if queue empty, create `ticket`; else create `match` in memory and update ticket owners.
2. Players can poll ticket via `/player/api/match/ticket/:ticketId` or check `/player/api/match/:matchId` for status.
3. Moves posted to `/player/api/match/:matchId/move` update `matches` state.

### 6) Store purchase
1. Player adds funds by POST `/player/add-funds` (server updates `user_balances`).
2. Purchase endpoint verifies wallet, deducts price, writes `sales` record and reduces product `availability`.

---

## ⚙️ Server & Run Instructions
### Requirements
- Node.js (a reasonably recent LTS); `Chesshivev1.0.2` lists `node` and uses `socket.io` and `mongodb` driver.
- MongoDB running locally on `mongodb://localhost:27017` (default DB name: `chesshive`).
- Optional SMTP env vars for real email delivery: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- Optional: set `SESSION_SECRET` and `SESSION_COOKIE_NAME` in env for production.

### Start backend (Chesshivev1.0.2)
1. cd Chesshivev1.0.2
2. npm install
3. Start MongoDB (e.g., `mongod`)
4. npm start (defaults to `PORT=3001` if not set)

### Start frontend (React)
1. cd chesshive-react
2. npm install
3. npm start (by default `react-scripts` starts at `http://localhost:3000`). Proxy config in `package.json` points to `http://localhost:3001` so API calls to `/api/*` are proxied to backend.

### Dev tips
- You can use dev header overrides for role checks (see `isCoordinator`/`isPlayer` in `app.js`) in development mode to bypass login for testing: add HTTP headers (`x-dev-role`, `x-dev-email`) in requests.
- If SMTP not configured, the server uses Ethereal test accounts or logs OTPs in console for testing.

---

## 🔒 Security & Limitations
- Passwords are stored plainly in this codebase (no hashing) — **do not** use real passwords on public deployments. Add bcrypt hashing and secure handling.
- Matchmaking is in-memory and thus not horizontally scalable — use persistent storage (DB) or implement Socket.io hubs for real-time matching when scaling.
- OTPs are stored in `otps` collection and expire after 5 minutes; ensure proper cleanup and auditing as needed.

---

## 🧩 Mapping to diagrams & class design (detailed)
This section expands the high-level mapping into a diagram-ready, itemized reference so you can draw a complete class diagram meeting the assignment requirements.

### 1) Entities and Value Objects (detailed)
For your class diagram, treat each **Entity** as a separate class (with an id and mutable state). Below are suggested attributes and a couple of behaviour methods (if applicable). Use the repository names and collection fields to pick attributes.

- **User (Entity)** — file: `routes/auth.js`, collection: `users`
  - attributes: id, name, email, password, role (admin|organizer|coordinator|player), college, phone, dob, isDeleted
  - methods: authenticate(), changePassword(), updateProfile()

- **Player (Entity / specialization of User)** — logical class: (can inherit from User)
  - attributes: rating, walletBalance, subscription, statsRef
  - methods: enrollTournament(tournamentId), addFunds(amount)

- **Tournament (Aggregate Root)** — collection: `tournaments`
  - attributes: id, name, date, time, location, entry_fee (Money), type, noOfRounds, coordinator (username), status (TournamentStatus)
  - methods: approve(), reject(), addEnrollment(), computePairings()

- **Enrollment (Entity)** — collections: `tournament_players` or `enrolledtournaments_team`
  - attributes: id, tournamentId, playerId/username, college, roleInTeam, status, feePaid (Money)
  - methods: approvePlayer(), refund()

- **Match (Aggregate Root)** — in-memory `matches` + persisted `tournament_pairings`
  - attributes: matchId, players[2], state (GameState), moves[] (ChessMove), colors, result
  - methods: applyMove(move), endMatch(result)

- **Pairing / Round (Entity)** — persisted in `tournament_pairings`
  - attributes: roundNumber, pairings[] (each pairing has player1, player2, result), byePlayer

- **Product (Entity)** — collection: `products`
  - attributes: id, name, price (Money), imageUrl, coordinator, college, availability
  - methods: reserve(), reduceAvailability()

- **Sale / Order (Entity)** — collection: `sales`
  - attributes: id, productId, buyer, price (Money), college, purchaseDate
  - methods: refund(), receipt()

- **Meeting (Entity)** — collection: `meetingsdb`
  - attributes: id, title, date, time, link, role, name
  - methods: schedule(), cancel()

- **Notification (Entity)** — collection: `notifications`
  - attributes: id, userId, type, tournamentId?, read (bool), date, payload
  - methods: markRead(), deliver()

Value objects (immutable small aggregated types):
- **Money (Value Object)** — amount, currency
- **GameState (Value Object)** — fen (string)
- **ChessMove (Value Object)** — from, to, at (timestamp)
- **TournamentStatus (enum)** — Pending, Approved, Rejected, Removed

---
### 2) Aggregates & Relations (how to model in your class diagram)
Use composition (filled diamond) when an aggregate "owns" internal entities or value objects. Use association for references and multiplicities.

- **Tournament (Aggregate Root)**
  - owns 0..* **Enrollment** (composition)
  - has 0..* **Pairings** (composition)
  - references 1 **User** (coordinator) (association)

- **Player (Aggregate Root)**
  - has 0..* **Match** references (association)
  - owns **Wallet** (part of Player or as `user_balances`) (composition)

- **Match (Aggregate Root)**
  - owns 0..* **ChessMove** (value objects) (composition)
  - contains 1 **GameState** (value object)

- **Product (Aggregate Root)**
  - has 0..* **Sale** (association)

Multiplicities and example associations to include in the diagram:
- Tournament 1 --- 0..* Enrollment
- Enrollment * --- 1 Player (or reference to User)
- Tournament 1 --- 0..* Pairing
- Pairing 1 --- 0..* Match
- Match 1 --- 0..* ChessMove
- Product 1 --- 0..* Sale

Add labels where helpful (e.g., "enrolledPlayers", "pairings").

---
### 3) Services (domain & application services)
Map services to files that implement their primary behavior. Show service classes in diagram (as separate nodes) and add dependency arrows to the Repositories they use.

- **AuthService** — file: `routes/auth.js` and `app.js` login handlers
  - responsibilities: signup(), sendOtp(), verifyOtp(), restoreAccount(), sessionManagement()
  - uses: `UserRepository`, `OtpRepository`

- **TournamentService** — `coordinator_app.js`, `organizer_app.js`
  - responsibilities: createTournament(), updateTournament(), approveTournament(), rejectTournament(), scheduleTournament()
  - uses: `TournamentRepository`, `NotificationRepository`, `TournamentPairingsRepository`

- **PairingService** — function `swissPairing` in `coordinator_app.js`
  - responsibilities: generatePairings(players, rounds), persistPairings()
  - uses: `TournamentRepository`, `TournamentPairingsRepository`, `PlayerRepository`

- **MatchService / MatchmakingService** — `player_app.js`
  - responsibilities: requestMatch(), createTicket(), pairPlayers(), acceptMatch(), submitMove()
  - uses: in-memory (matches map) or `MatchRepository` (if persisted), `NotificationService`

- **StoreService** — `organizer_app.js` endpoints
  - responsibilities: addProduct(), listProducts(), processPurchase(), salesReport()
  - uses: `ProductRepository`, `SaleRepository`, `WalletRepository` (`user_balances`)

- **NotificationService** — `app.js` and router endpoints
  - responsibilities: createNotification(), listNotifications(), markRead()
  - uses: `NotificationRepository`, `UserRepository`, `TournamentRepository`

- **MeetingService** — `organizer_app.js`
  - responsibilities: scheduleMeeting(), listMeetingsForUser()
  - uses: `MeetingRepository`

- **RankingService** — (logical) computes tournament standings using `player_stats` and `tournament_pairings`

---
### 4) Repositories (persistence mapping)
Model repositories as interfaces in your class diagram (label as <<repository>>). Use collection names and common methods.

- **UserRepository** — collection: `users` — methods: findById(), findByEmail(), save(), update()
- **TournamentRepository** — collection: `tournaments` — methods: find(), findById(), save(), update()
- **TournamentPairingsRepository** — collection: `tournament_pairings` — methods: savePairings(), getPairingsByTournament()
- **EnrollmentRepository** — collections: `tournament_players`, `enrolledtournaments_team` — methods: enroll(), findByTournament()
- **MatchRepository** — (optional/persistent) collection: `tournament_pairings` / in-memory `matches` — methods: saveMatch(), updateMatch()
- **ProductRepository** — collection: `products`
- **SaleRepository** — collection: `sales`
- **MeetingRepository** — collection: `meetingsdb`
- **NotificationRepository** — collection: `notifications`
- **OtpRepository** — collections: `otps`, `signup_otps`
- **WalletRepository** — collection: `user_balances`

---
### 5) Relations between Services and Repositories
Draw directed dependency arrows (service -> repository). Here are the main pairs:
- AuthService -> UserRepository, OtpRepository
- TournamentService -> TournamentRepository, TournamentPairingsRepository, NotificationRepository
- PairingService -> TournamentPairingsRepository, PlayerRepository
- MatchService -> MatchRepository (or in-memory store) and NotificationService
- StoreService -> ProductRepository, SaleRepository, WalletRepository
- NotificationService -> NotificationRepository, UserRepository

Add multiplicities where appropriate (e.g., TournamentService may call TournamentRepository for a single tournament or query many). Indicate whether calls are read (GET) or write (POST/UPDATE) if you want more detail.

---
### 6) Hubs (real-time channels)
The project has Socket.IO available (`socket.io` dependency). The following Hubs are good to include in the diagram (presented as separate components or classes labelled <<hub>>):
- **MatchHub** (planned / can be implemented using `socket.io`)
  - responsibilities: broadcastMove(matchId, move), invite(opponent), notifyMatchStart(), notifyMatchEnd()
  - interacts with: MatchService, NotificationService
- **ChatHub**
  - responsibilities: sendMessage(room, payload), joinRoom(), fetchHistory()
  - interacts with: NotificationService (for mentions) and `chat_messages` collection when persisting
- **NotificationHub**
  - responsibilities: pushNotification(userId, payload), subscribe(userId)
  - interacts with: NotificationService

Note: Currently some functionality is implemented via polling and in-memory maps; if you implement hubs, draw them as separate components and show the service calls they perform.

---
### 7) Relations between Hubs and Services
Use dependency arrows from each Hub to the Services they call.
- MatchHub -> MatchService (create match, apply moves), NotificationService (send match invites)
- ChatHub -> NotificationService (create mention notifications), MeetingService (for meeting rooms)
- NotificationHub -> NotificationService (reads DB) and UserRepository (user session lookup)

---
### Diagram drawing tips & checklist (so you don’t miss any required item)
- Header: **Project name**, **Project domain**, **Project number**, **Team leader name + roll**, **All team members + roll numbers** (place this top center). This is required by assignment.
- Diagram elements to include: Entities, Value Objects (use <<value>>), Aggregates (mark aggregate roots), Services (<<service>>), Repositories (<<repository>>), Hubs (<<hub>>).
- Use composition (filled diamond) from aggregate root to owned entities/value objects (e.g., Tournament -> Enrollment). Use plain association for references (e.g., Enrollment -> Player).
- Annotate multiplicities (1, 0..*, 1..*). Add simple method names in each class (e.g., Tournament.approve(), Match.applyMove()).
- Show service -> repository dependencies (dashed or solid dependency arrows) and hub -> service relations.
- Include a short legend on the diagram explaining symbols (composition, aggregation, association, dependency, multiplicity).
- Export as PNG or JPEG from draw.io or PlantUML plugin. **Do not use AI-generated images**.

---
### Example minimal class list to draw (copy into draw.io or PlantUML)
- User
- Player : inherits User
- Tournament (aggregate root)
- Enrollment
- Pairing / Round
- Match (aggregate root)
- ChessMove <<value>>
- GameState <<value>>
- Product
- Sale
- Meeting
- Notification
- AuthService <<service>>
- TournamentService <<service>>
- MatchService <<service>>
- StoreService <<service>>
- NotificationService <<service>>
- UserRepository <<repository>>
- TournamentRepository <<repository>>
- MatchRepository <<repository>>
- ProductRepository <<repository>>
- MatchHub <<hub>>
- ChatHub <<hub>>
- NotificationHub <<hub>>

Add the header block with project and team details, then lay out aggregates clearly and connect services to repositories and hubs to services.

---

---

## ✅ Recommendations & Next Steps (for improvements)
- Use **bcrypt** for password hashing and use environment-configured JWT or secure cookies for sessions in production.
- Replace in-memory matchmaking with **Socket.IO** hubs (server -> room per match) for real-time updates and horizontal scaling.
- Add automated tests for pairing (edge cases: odd players, repeated opponents), notifications, and transactions (wallet/purchase).
- Add input sanitization & rate limiting on public endpoints (e.g., OTP sending) to reduce abuse.

---

## 📌 Quick references (files → responsibilities)
- `app.js` — server entry, login/verify OTP, session, notification endpoints, mounts routers.
- `routes/databasecongi.js` — DB connect, collections + validators
- `routes/auth.js` — signup flows (OTP, signup data storage)
- `coordinator_app.js` — tournament creation, pairing generation (Swiss algorithm)
- `organizer_app.js` — approve/reject tournaments, store & sales aggregation, meeting endpoints
- `player_app.js` — matchmaking queue, match endpoints, basic player REST CRUD
- `chesshive-react/src/pages/*` — UI pages; map by name to backend endpoints (see comments in README above)
