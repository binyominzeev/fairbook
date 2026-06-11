# fairbook

Safe and AI-checked social networking — discourse with dignity and intellectual honesty.

## What is fairbook?

fairbook is a Facebook-like social network built around a single mission: meaningful discussion with respectful disagreement.

> "The goal is not agreement. The goal is disagreement with dignity and intellectual honesty."

### Core features

| Feature | Description |
|---|---|
| **Feed** | Posts from people you follow and communities you belong to |
| **Shared content** | Share news articles with source attribution and optional AI context |
| **AI Discourse Layer** | Every comment is analyzed for discourse quality signals — no censorship, just a mirror |
| **Steelman** | Request an AI-generated fair summary of another user's position; they can approve or reject it |
| **Thread Reflection** | For long discussions, generate an AI summary of agreements, disagreements, and open questions |
| **Communities** | Public or invite-only groups |
| **Connections** | Follow people to see their posts |

### AI Discourse Signals

**Positive:** `answered_question`, `acknowledged_valid_point`, `accurately_represented_opponent`, `constructive_contribution`

**Neutral:** `partially_answered_question`, `off_topic`

**Negative:** `personal_attack`, `strawman_argument`, `motive_attribution`, `topic_derailment`, `escalatory_language`

The AI is not a judge. It is a mirror.

### No global reputation system

There is no karma, no likes as ranking signals, and no influencer scores. Quality signals are per-comment only.

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your `OPENAI_API_KEY` and `JWT_SECRET`.

### 3. Set up the database

```bash
npx prisma migrate dev
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Tech stack

- **Next.js 16** (App Router, TypeScript)
- **Prisma 7** + SQLite (dev) / PostgreSQL (production)
- **Tailwind CSS**
- **OpenAI GPT-4o-mini** for discourse analysis, steelmanning, and reflection
- **jose** for JWT authentication

## Design principles

- Prioritize transparency over engagement
- AI annotations explain, not adjudicate
- No addictive UX patterns
- User control and privacy
