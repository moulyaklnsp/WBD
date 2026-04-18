# ChessHive v1.0.2

ChessHive is a full-stack chess platform for campus communities with role-based dashboards for `player`, `coordinator`, `organizer`, and `admin`.

It combines tournament workflows, store + wallet flows, announcements, meetings, chat, blogs, and analytics in one system.

## Project Snapshot

- Frontend: React 18 + Redux Toolkit + React Router + Framer Motion
- Backend: Express + MongoDB + Socket.IO + JWT + Session auth
- API docs: Swagger at `/api-docs`
- Roles supported: `admin`, `organizer`, `coordinator`, `player`

## Monorepo Layout

```text
ChessHive.v1.0.2/
|-- backend/
|   |-- app.js
|   |-- .env.example
|   |-- src/
|   |   |-- app.js
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- middlewares/
|   |   |-- models/
|   |   |-- routes/
|   |   |-- services/
|   |   `-- utils/
|   `-- logs/
|-- frontend/
|   |-- package.json
|   |-- public/
|   |-- src/
|   |   |-- routes/AppRoutes.jsx
|   |   |-- pages/
|   |   |-- components/
|   |   |-- features/
|   |   |-- services/
|   |   `-- utils/
|   `-- logs/
|-- DETAILED_README.md
`-- readme_full.md
```

## Features by Role

### Public

- Landing pages: Home, About, Contact Us, Blogs
- Auth: Signup with OTP verification, Login, Forgot Password OTP flow

### Player

- Dashboard, profile, tournaments, pairings, rankings
- Growth analytics, watch/TV pages, streams
- Store, cart, order tracking, wallet top-up, subscriptions
- Feedback, reviews, complaints, settings

### Coordinator

- Tournament CRUD
- Pairings/rankings + enrolled players + feedback management
- Store management, order and complaint resolution
- Blog management, announcements, calendar, meetings
- Streaming control + chess events

### Organizer

- Coordinator management
- Tournament approval/rejection
- Sales and growth analytics
- Meeting scheduling and profile tools

### Admin

- System dashboard
- Contact queue management
- Coordinator / organizer / player management
- Tournament oversight
- Payment and growth analytics

## Tech Stack

- Runtime: Node.js
- Frontend: React, Redux Toolkit, Framer Motion, Chart.js
- Backend: Express, MongoDB native driver, Socket.IO
- Auth: JWT (access + refresh) + express-session
- Docs: swagger-jsdoc + swagger-ui-express
- Email: Nodemailer (OTP workflows)
- Uploads: Multer + Cloudinary utilities

## Prerequisites

- Node.js 18+ recommended
- npm
- MongoDB (local or remote)

## Quick Start

This repo has separate frontend and backend projects. Start both.

### 1) Backend Setup

```bash
cd backend
npm install
```

Create `.env`:

```bash
cp .env.example .env
```

Run backend:

```bash
npm run dev
```

Default backend URL: `http://localhost:3001`

### 2) Frontend Setup

```bash
cd frontend
npm install
npm start
```

Default frontend URL: `http://localhost:3000`

> `frontend/package.json` uses proxy `http://localhost:3001` for relative `/api/*` requests.

## Environment Variables (Backend)

From `backend/.env.example`:

```env
MONGODB_URI=mongodb://localhost:27017/chesshive
SESSION_SECRET=your_session_secret_here
SESSION_COOKIE_NAME=sid
JWT_ACCESS_SECRET=change_me
JWT_REFRESH_SECRET=change_me
PORT=3001
NODE_ENV=development
```

Optional email variables for OTP mail delivery:

```env
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASS=
```

## NPM Scripts

### Backend (`backend/package.json`)

- `npm run dev` -> start backend with nodemon
- `npm start` -> start backend with node

### Frontend (`frontend/package.json`)

- `npm start` -> start React dev server
- `npm run build` -> production build
- `npm test` -> test runner

## Routes and Access Model

- Public routes are mounted directly (auth + public APIs)
- Role APIs are mounted with guards:
  - `/admin/*`
  - `/organizer/*`
  - `/coordinator/*`
  - `/player/*`

Frontend page routing is centralized in:

- `frontend/src/routes/AppRoutes.jsx`

## API Documentation

After backend startup:

- Swagger UI: `http://localhost:3001/api-docs`
- OpenAPI JSON: `http://localhost:3001/api-docs.json`

## Real-time and Background Services

- Socket.IO server initialized in `backend/src/app.js`
- Chat APIs in `backend/src/routes/chatRoutes.js`
- Tournament scheduler service starts on backend boot

## Current MongoDB Collections

Observed collections in this project database:

- `announcements`
- `blogs`
- `cart`
- `chat_messages`
- `chess_events`
- `complaints`
- `contact`
- `enrolledtournaments_team`
- `feedbacks`
- `logs`
- `meetingsdb`
- `notifications`
- `order_complaints`
- `orders`
- `otps`
- `player_settings`
- `player_stats`
- `product_reviews`
- `products`
- `rating_history`
- `refresh_tokens`
- `reviews`
- `sales`
- `sessions`
- `signup_otps`
- `streams`
- `subscription_history`
- `subscriptionstable`
- `tournament_complaints`
- `tournament_files`
- `tournament_pairings`
- `tournament_players`
- `tournament_team_pairings`
- `tournaments`
- `user_balances`
- `users`

## Troubleshooting

- If auth or API calls fail, verify both servers are running:
  - Frontend on `3000`
  - Backend on `3001`
- If Mongo connection fails, re-check `MONGODB_URI`.
- If OTP emails are not sent, configure email env vars.
- If role pages return unauthorized, check session/JWT state and role guard middleware.

## Notes

- Root does not contain a single `package.json`; run frontend and backend independently.
- Keep secrets out of git; use local `.env` only.
- Existing extended docs are available in `DETAILED_README.md` and `readme_full.md`.
