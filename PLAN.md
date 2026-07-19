# KiloGuessr — Product & Technical Plan

*v1 plan, agreed 2026-07-19. Prototype: https://claude.ai/code/artifact/2704a965-335d-4c62-9aa1-bd90420fe44d*

KiloGuessr (a nod to GeoGuessr) is a kg plate-math trainer for powerlifters:
read a loaded barbell and type the total, or load a bar to hit a target weight.
This plan turns the working prototype into a proper website with accounts,
ranks, and leaderboards at **kiloguessr.liftinglookup.com**.

## Locked decisions

| Decision | Choice |
|---|---|
| Name | KiloGuessr |
| Domain | kiloguessr.liftinglookup.com (standalone infra, independent of liftinglookup) |
| Backend | All-AWS serverless: Cognito + API Gateway (HTTP API) + Lambda + DynamoDB |
| Frontend | Rebuild in Next.js/React (TypeScript) |
| Ranked modes | Endurance–Read, Endurance–Load, Sprint–Read, Sprint–Load |
| Unranked | Practice (all current settings stay fully configurable, playable without an account) |
| Ranked access | Account required — no guest ranked play |
| Region | us-east-1 |
| Weekly reset | Sunday at midnight US Eastern |
| Sprint miss penalty | +10 s |
| Ranks/tiers | Parked — launch with raw leaderboards, revisit later |
| Music | Cut from the product (removed from prototype too) |
| Instagram | Optional profile link (self-reported in v1) |

## 1. Product spec

### Game modes

**Practice** (unranked, no account needed)
- Exactly the prototype: Read/Load, Practice/Endurance clock, bar 25/20/15,
  collars on/off, smallest plate 5/2.5/1.25/0.25, max load 75–525.
- Runs fully client-side; nothing submitted.

**Ranked** (account required; standardized ruleset so scores are comparable)
- Standard settings for all ranked runs: **20 kg bar, collars on, plates down
  to 1.25, max 375**. Shorthand answers (2/7 ⇒ .5) allowed. Number-key loading allowed.
- **Endurance–Read**: 60 s start, +2 s per good lift, −10 s per miss.
  Score = good lifts. Tiebreak: accuracy, then earlier submission.
- **Endurance–Load**: same clock, building the bar. Separate board (different skill).
- **Sprint–Read**: exactly 10 bars. Score = total time + 10 s penalty per miss.
  Lower is better.
- **Sprint–Load**: same rules, building the bar to 10 targets. Separate board.
- Boards: **all-time** and **weekly** (reset Sunday at midnight US Eastern —
  the week rolls over at 00:00 America/New_York going into Monday) per mode.
  Top 100 + your own row.

### Ranks — parked for later

Launch with raw leaderboards only (scores, no tiers). The plate-themed tier idea
(Chrome 1.25 → Black 2.5 → White 5 → Green 10 → Yellow 15 → Blue 20 → Red 25,
per mode) stays on the shelf — revisit once real score distributions exist.

### Accounts & profiles

- Email + password via Cognito (email verification). Google sign-in later if wanted.
- Unique public handle (claimed at signup, changeable, uniqueness enforced in DynamoDB,
  basic denylist filter).
- Optional Instagram link (powerlifting lives on IG): user sets their IG username,
  shown as a tappable @handle on their profile and leaderboard rows. v1 is
  self-reported — no OAuth (Meta app review isn't worth it yet); verified linking
  can come later if impersonation becomes a problem.
- Public profile: handle, Instagram link, bests per mode, runs played, member-since.
- Practice requires no account; hitting "Ranked" prompts sign-in.
- Minimal PII (email only). Add a short privacy page + ToS at launch.

## 2. Architecture

```
Browser (Next.js app)
  ├─ Practice: local game engine, no network
  └─ Ranked:   POST /runs → server-issued cards → play → POST submit → server scores
        │
CloudFront ── Next.js app (OpenNext via SST) ── kiloguessr.liftinglookup.com
        │
API Gateway (HTTP API, JWT authorizer ← Cognito) ── api.kiloguessr.liftinglookup.com
        │
     Lambda (Node/TS handlers)
        │
     DynamoDB (single table, on-demand)
```

### Stack

- **Next.js (App Router, TS)** — pages: `/` play (practice), `/ranked`,
  `/leaderboards`, `/profile/[handle]`, auth pages.
- **packages/engine** — framework-agnostic TS port of the prototype's logic:
  card generation (seeded RNG), grading incl. shorthand rule, endurance clock,
  sprint scoring. Pure functions + unit tests. Used by web (practice) *and*
  Lambda (ranked generation/scoring) so client and server can never disagree.
- React components re-implement the stage SVG, rack, HUD. Visual design carries
  over 1:1 (same tokens/palette). No music in the product.
- **SST v3** as IaC: one config deploys Next (OpenNext/CloudFront), Lambdas,
  DynamoDB, Cognito, domains/certs. `sst dev` for local development.
- **Repo**: pnpm monorepo — `apps/web`, `packages/engine`, `packages/functions`.
  GitHub + Actions: typecheck/test on PR, deploy `staging` on main, manual promote to prod.
- **Region**: us-east-1.

### Data model (DynamoDB single table)

| Item | PK | SK | Notes |
|---|---|---|---|
| Profile | `USER#<sub>` | `PROFILE` | handle, instagram, createdAt, counters |
| Handle claim | `HANDLE#<lower>` | `CLAIM` | uniqueness via conditional put |
| Best per mode | `USER#<sub>` | `BEST#<mode>` | conditional update if better |
| Run record | `USER#<sub>` | `RUN#<ts>` | audit/history, TTL ~90 days |
| Board row | `LB#<mode>#<window>` (GSI1PK) | padded score (GSI1SK) | window = `ALL` or `2026-W30`; score inverted for high-is-better |

Top-100 = single GSI query. Exact personal rank = count query (fine at hobby scale).

### API (v1)

- `POST /v1/runs` `{mode}` → `{runId, cards[], serverStartedAt}` — server-seeded
  cards (endurance gets a surplus batch, e.g. 120; sprints exactly 10)
- `POST /v1/runs/{id}/submit` `{answers: [{idx, answer|plates, ms}]}` →
  `{score, verdicts, best, rankPos}` — server re-simulates and scores
- `GET /v1/leaderboards/{mode}?window=all|week` → top 100 + caller's row
- `GET /v1/me` · `PATCH /v1/me {handle, instagram}` · `GET /v1/users/{handle}`

### Anti-cheat (v1 posture)

Client never sends a score — only answers to server-issued cards.
Server validations: run token single-use with expiry; wall-clock duration between
issue and submit must cover claimed times; per-card minimum (~800 ms); endurance
clock re-simulated server-side (run must end exactly when clock hits 0); rate
limits per user/IP. Not bot-proof (nothing client-side is), but stops score
forgery and casual tampering. Heuristics/shadow-flagging can come later.

## 3. Hosting & DNS specifics

- Route 53: hosted zone `liftinglookup.com` already exists. SST adds
  `kiloguessr` (CloudFront alias) and `api.kiloguessr` (API GW custom domain) records.
- Certs via ACM (auto through SST, DNS-validated). No changes to the existing
  liftinglookup site.
- Envs: personal dev stage (`sst dev`), `staging` (e.g. kiloguessr-staging.…), `prod`.
- Cost estimate at hobby scale: < $5/month (Cognito free < 10k MAU, Lambda/API GW/
  DynamoDB within free tier or pennies, CloudFront pennies).

## 4. Milestones

1. **M0 — Skeleton**: repo, SST config, hello-world Next app live on the subdomain.
2. **M1 — Engine parity**: `packages/engine` ported with unit tests (generation,
   grading, shorthand, endurance math); Practice mode fully playable, visual parity
   with prototype (minus music).
3. **M2 — Accounts**: Cognito wired, signup/login, handle claim, profile page.
4. **M3 — First ranked loop**: run issue → play → submit → score for
   Endurance–Read; all-time board live.
5. **M4 — Full ranked**: Endurance–Load + both Sprints, weekly windows, Instagram
   links on profiles and board rows.
6. **M5 — Launch polish**: mobile pass, empty/error states, privacy/ToS pages,
   OG share images ("27 good lifts in Endurance–Read"), then announce.

## 5. Open items (decide during build, defaults noted)

- Handle moderation — default denylist only.
- Instagram verification — v1 is a self-reported link; OAuth verification later
  only if impersonation becomes a problem.
- Tier system — parked (see Ranks); design against real score distributions
  after launch.
