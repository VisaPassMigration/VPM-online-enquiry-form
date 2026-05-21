# Vercel Preview Setup (Beginner Guide)

This guide explains the **simplest way** to put this app online so you can open `/intake` in a real browser without running terminal commands locally.

## What this app needs before deployment

- It is a Next.js app and can deploy directly to Vercel.
- It uses Prisma with PostgreSQL (`DATABASE_URL` is required).
- Staff login uses Auth.js credentials and needs `AUTH_SECRET`.
- The intake submit API writes to database tables and creates audit records.

## Is it deploy-ready for Vercel?

**Yes, with setup.**

You can deploy now, but it will not fully work until environment variables and a hosted PostgreSQL database are configured in Vercel.

## Required environment variables

Set these in Vercel Project Settings → Environment Variables:

- `DATABASE_URL` (required)
- `AUTH_SECRET` (required)
- `AUTH_TRUST_HOST=true` (recommended)
- `NEXTAUTH_URL` (recommended for explicit auth callback base URL)
- `NEXT_PUBLIC_INTAKE_FORM_URL` (recommended for staff email templates)

Optional depending on your use case:

- `DIRECT_URL` (optional non-pooled DB connection)
- `EMAIL_PROVIDER`, `EMAIL_FROM`, and provider keys if you want real email sending
- `CONSULTATION_BOOKING_URL`
- `SEED_BOSS_ADMIN_EMAIL` (only needed if using seeding helper)

## Is a database required for `/intake` submit?

**Yes.**

`/intake` can render without database, but successful submit requires database writes (submission, points snapshot, risk flags, and audit events).

## Non-technical deployment steps (exact click path)

1. Put this repo in GitHub (if not already).
2. Go to [https://vercel.com/new](https://vercel.com/new).
3. Click **Import Git Repository** and choose this repo.
4. Keep framework as **Next.js** (Vercel auto-detects it).
5. Before clicking Deploy, open **Environment Variables** and add at minimum:
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `AUTH_TRUST_HOST=true`
6. Click **Deploy**.
7. After first deploy finishes, open Project → **Settings** → **Domains** and note your URL (example: `https://vpm-intake-platform.vercel.app`).
8. Go to **Settings** → **Environment Variables** and set:
   - `NEXTAUTH_URL=https://<your-domain>`
   - `NEXT_PUBLIC_INTAKE_FORM_URL=https://<your-domain>/intake`
9. Trigger a redeploy from the latest commit (Deployments tab → Redeploy).
10. Run database migrations for production using your normal Prisma migration process before full submit testing.

## URL patterns you will use

- Public intake page: `https://<your-domain>/intake`
- Staff sign-in page: `https://<your-domain>/api/auth/signin`
- Staff dashboard page: `https://<your-domain>/dashboard`

## Current blockers before full online flow works

1. **Hosted PostgreSQL not configured** (`DATABASE_URL` missing or invalid).
2. **Database schema not migrated** in deployed environment.
3. **No active staff user records/roles** in database for login/authorization.
4. **Auth secret not set** (`AUTH_SECRET`).
5. Optional: email provider settings if you expect real outbound email.

## Fast smoke test after deploy

1. Open `https://<your-domain>/intake`.
2. Fill required fields and submit.
3. Confirm success message appears.
4. Open `https://<your-domain>/api/auth/signin` and try staff login using a seeded/known staff email.
5. Open `https://<your-domain>/dashboard` and confirm authenticated access.
