# KiloGuessr

Kg plate math for powerlifters — read the bar, load the bar, climb the
leaderboards. Live at [kiloguessr.liftinglookup.com](https://kiloguessr.liftinglookup.com).

See [PLAN.md](./PLAN.md) for the full product and technical plan.

## Layout

- `apps/web` — Next.js app (game, leaderboards, profiles)
- `packages/engine` — shared game logic (card generation, grading, scoring)
- `packages/functions` — Lambda handlers (from M3)
- `sst.config.ts` — SST v3 infrastructure (Next.js, Cognito, DynamoDB, domains)

## Develop

```sh
pnpm install
pnpm dev          # sst dev — live Lambda + Next dev server
```

## Deploy

```sh
npx sst deploy --stage production   # → kiloguessr.liftinglookup.com
```

AWS region: us-east-1. DNS: Route 53 zone `liftinglookup.com`.
