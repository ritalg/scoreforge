# ScoreForge

AI-powered SAT prep platform with adaptive quizzing, spaced repetition, AI essay scoring, and full tutor/parent portals.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | SQLite (dev) via Drizzle ORM + better-sqlite3 |
| AI | OpenAI GPT-4o (essay scoring, question extraction) |
| Search | MeiliSearch (optional — falls back to SQLite LIKE) |
| Monitoring | OpenTelemetry + Sentry + Prometheus + Grafana |
| Auth | JWT in httpOnly cookie |
| PWA | vite-plugin-pwa + Workbox |
| i18n | react-i18next (English + Spanish) |

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
# Required
JWT_SECRET=your-secret-key-min-32-chars
DATABASE_PATH=../data/scoreforge.db

# AI features (optional)
OPENAI_API_KEY=sk-...

# Email (optional — uses jsonTransport in dev without SMTP_HOST)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
EMAIL_FROM=ScoreForge <noreply@scoreforge.coach>
APP_URL=http://localhost:5173

# Search (optional — falls back to SQLite LIKE search)
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_KEY=masterKey

# Monitoring (optional)
SENTRY_DSN=https://...@sentry.io/...
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Superadmin seed credentials
SUPERADMIN_EMAIL=admin@scoreforge.coach
SUPERADMIN_PASSWORD=Admin123!
```

### 3. Initialize the database

```bash
cd server
npm run setup      # creates tables
npm run seed       # seeds demo users and sample data
```

### 4. Start development servers

```bash
# From repo root — starts both client (port 5173) and server (port 3001)
npm run dev
```

Open http://localhost:5173

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Super Admin | admin@scoreforge.coach | Admin123! |
| Admin | content@scoreforge.coach | Admin123! |
| Tutor | tutor@scoreforge.coach | Tutor123! |
| Student | student@scoreforge.coach | Student123! |
| Student 2 | student2@scoreforge.coach | Student123! |
| Parent | parent@scoreforge.coach | Parent123! |

## Project Structure

```
scoreforge/
├── client/          # React frontend (Vite)
│   └── src/
│       ├── pages/   # student/, admin/, tutor/, parent/, auth/
│       ├── components/
│       ├── lib/     # api.ts, i18n.ts, offlineStore.ts
│       └── store/   # authStore.ts (Zustand)
├── server/          # Express backend
│   └── src/
│       ├── routes/  # All API routes
│       ├── services/ # AI, email, search, SR, XP
│       ├── db/      # Drizzle schema, setup, seed, migrations
│       └── middleware/
├── shared/          # Shared TypeScript types and constants
├── tests/
│   └── e2e/         # Playwright tests (auth, quiz, admin)
├── monitoring/      # Prometheus + Grafana config
└── docker-compose.yml
```

## Key Features

- **Adaptive Mock Test** — Module 1 performance gates Module 2 difficulty
- **Spaced Repetition (SM-2)** — for questions and flashcards
- **AI Essay Scorer** — GPT-4o grades SAT-style essays with rubric feedback
- **AI Question Extraction** — extracts questions from uploaded PDFs
- **Study Groups** — invite codes, leaderboards, activity feed
- **Tutor Portal** — roster management, cohort analytics, custom assignments
- **Parent Portal** — read-only progress dashboard, weekly email digest
- **Test Calendar** — track official SAT dates with countdown
- **PWA** — installable, offline-capable (flashcards + saved questions via IndexedDB)
- **Gamification** — XP, levels, streaks, 12 badge types, leaderboard
- **i18n** — English and Spanish

## Running Tests

### E2E (Playwright)

```bash
# Requires running dev server
npm run test:e2e

# Or with a specific browser
npx playwright test --project=chromium
```

### Type checking

```bash
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit
```

## Docker

### Build and run

```bash
docker build -t scoreforge .
docker run -p 3001:3001 \
  -e JWT_SECRET=changeme \
  -e OPENAI_API_KEY=sk-... \
  -v $(pwd)/data:/app/data \
  scoreforge
```

### Full stack with monitoring

```bash
docker compose up
```

Services:
- App: http://localhost:3001
- MeiliSearch: http://localhost:7700
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000

## Admin CSV Bulk Import

Navigate to **Admin → Bulk CSV Import**. Upload a CSV with columns:

```
question_text,choice_a,choice_b,choice_c,choice_d,correct_answer,topic_key,difficulty,explanation
```

Questions are imported as `pending_review` and require admin approval before appearing in the question bank.

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | Yes | — | Secret for JWT signing (min 32 chars) |
| `DATABASE_PATH` | No | `../data/scoreforge.db` | SQLite database path |
| `OPENAI_API_KEY` | No | — | GPT-4o for essay scoring and question extraction |
| `SMTP_HOST` | No | — | SMTP for emails (uses jsonTransport if unset) |
| `APP_URL` | No | `http://localhost:5173` | Base URL for email links |
| `MEILISEARCH_URL` | No | — | MeiliSearch instance (uses SQLite search if unset) |
| `SENTRY_DSN` | No | — | Sentry error tracking DSN |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | — | OpenTelemetry collector endpoint |
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | `production` serves client build from `client/dist` |
