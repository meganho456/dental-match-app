# DentalMatch

A swipe-based job marketplace connecting dental assistants with dental clinics — matching temporary and permanent roles with skills, availability, and location.

---

## Features

- **Dual-sided marketplace** — separate flows for dental assistants (job seekers) and clinics (employers)
- **Swipe-based discovery** — Tinder-style card swiping for both assistants browsing jobs and clinics browsing candidates
- **Temp & permanent roles** — distinct workflows for shift-based temp work and full-time placements
- **Bidding system** — assistants propose hourly rates when applying to temp jobs
- **Skill matching** — filter by dental software (Open Dental, Dentrix, Eaglesoft, etc.) and assistant tier (RDA/DA)
- **Availability scheduling** — weekly availability matrix for assistants
- **Radius-based search** — travel distance filtering
- **Time tracking** — clock-in/out for active temp shifts
- **Review system** — post-placement star ratings between assistants and clinics
- **External job ingestion** — import job listings from external sources (Indeed, LinkedIn, etc.)
- **JWT auth** with role-based access control (ASSISTANT, CLINIC, ADMIN)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS 4 |
| Animations | Framer Motion |
| Routing | React Router DOM 7 |
| HTTP Client | Axios |
| Backend | Node.js, Express 5, TypeScript |
| ORM | Prisma 7 |
| Database | PostgreSQL |
| Auth | JWT + bcryptjs |
| Security | Helmet, CORS |

---

## Project Structure

```
dental-match-app/
├── client/          # React frontend (Vite + TypeScript)
│   └── src/
│       ├── pages/   # HomePage, LoginPage, RegisterPage, SwipePage, Dashboards
│       ├── components/  # SwipeCard, Navbar, Toast
│       └── context/ # AuthContext (JWT state)
├── server/          # Express backend (Node.js + TypeScript)
│   └── src/
│       ├── routes/      # auth, jobs, matches, assistants, clinics, reviews
│       ├── controllers/ # Business logic
│       ├── middleware/  # requireAuth, requireRole
│       └── services/    # jobIngestion
│   └── prisma/
│       └── schema.prisma
└── screenshots/     # App screenshots
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+

### 1. Clone and install

```bash
git clone https://github.com/your-username/dental-match-app.git
cd dental-match-app

# Install client dependencies
cd client && npm install

# Install server dependencies
cd ../server && npm install
```

### 2. Configure environment

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dental_match?schema=public
JWT_SECRET=your-secret-at-least-64-chars-long
JWT_EXPIRES_IN=7d
PORT=3001
```

### 3. Set up the database

```bash
cd server
npm run prisma:migrate
npm run prisma:generate
```

### 4. Run the app

In two separate terminals:

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

The client runs at `http://localhost:5173` and proxies `/api` requests to `http://localhost:3001`.

---

## API Overview

All routes are prefixed with `/api`.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/auth/register` | Create account (ASSISTANT or CLINIC) | — |
| POST | `/auth/login` | Login, returns JWT | — |
| GET | `/auth/me` | Current user info | Required |
| GET | `/jobs` | List jobs (filters: type, city, tier, date) | — |
| POST | `/jobs` | Create job posting | CLINIC |
| POST | `/matches` | Apply/bid on a job | ASSISTANT |
| PATCH | `/matches/:id/status` | Accept, decline, clock in/out, place | Role-based |
| GET | `/assistants` | Browse available assistants | CLINIC |
| POST | `/reviews` | Submit post-match review | Required |

---

## Data Model

Key entities in the Prisma schema:

- **User** — email, hashed password, role
- **AssistantProfile** — tier, software skills, hourly rate, travel radius, availability
- **ClinicProfile** + **ClinicLocation** — company info, address, geocoordinates
- **JobPosting** — type (TEMP/PERMANENT), status, rate, required skills, shift times
- **Match** — links an assistant to a job posting; tracks status through the full lifecycle
- **Review** — post-match star rating + comment

Match status lifecycle:
```
PENDING → ACCEPTED → CLOCKED_IN → CLOCKED_OUT → PLACED
        ↘ DECLINED
        ↘ CANCELLED
```

---

## Scripts

### Client

```bash
npm run dev       # Start dev server
npm run build     # Type-check + production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

### Server

```bash
npm run dev              # Start with hot-reload (ts-node-dev)
npm run build            # Compile TypeScript
npm run start            # Run compiled server
npm run prisma:migrate   # Run DB migrations
npm run prisma:generate  # Regenerate Prisma client
npm run ingest           # Run external job ingestion
```
