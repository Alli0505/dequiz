# DeQuiz — Deployment & Backend Setup

The app runs in **local mode** out of the box (progress in `localStorage`, no login). To turn on **real Google sign-in + a global leaderboard**, do the steps below. They're the parts that need your own accounts — the app code is already wired for them.

Order matters: deploy first (to get a stable URL), then Supabase + Google, then flip on the env vars.

---

## 1. Deploy the frontend to Vercel

1. Go to <https://vercel.com> and sign in **with GitHub**.
2. **Add New → Project**, import the repo **`Alli0505/dequiz`**.
3. Vercel auto-detects Vite (build `npm run build`, output `dist`). Click **Deploy**.
4. You'll get a URL like `https://dequiz-xxxx.vercel.app`. **Copy it** — you need it below.

Every `git push` to `main` now auto-deploys. (It works immediately in local mode; sign-in stays simulated until step 4.)

---

## 2. Create the Supabase project + database

1. Go to <https://supabase.com>, sign in, **New project** (pick a name/region, set a DB password).
2. When it's ready: **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and **Run**. This creates the `profiles` table, unique-nickname index, and security policies.
3. **Project Settings → API**: copy the **Project URL** and the **anon/public** key. (Keep the `service_role` key secret — it is NOT used here.)

---

## 3. Enable Google sign-in

**a) Create a Google OAuth client**
1. <https://console.cloud.google.com> → create/select a project.
2. **APIs & Services → OAuth consent screen**: set it up (External), add your email as a test user.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application**.
4. Under **Authorized redirect URIs**, add the callback shown in Supabase (next step) — it looks like:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client secret**.

**b) Turn it on in Supabase**
1. Supabase **Authentication → Providers → Google**: enable it, paste the Client ID + secret, save. (This page shows the exact callback URL to paste back into Google in step a4.)
2. Supabase **Authentication → URL Configuration**: set **Site URL** to your Vercel URL from step 1, and add it (plus `http://localhost:5191` for local dev) under **Redirect URLs**.

---

## 4. Point the app at Supabase (env vars)

**On Vercel** (production): Project → **Settings → Environment Variables**, add:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | your Project URL from step 2 |
| `VITE_SUPABASE_ANON_KEY` | your anon key from step 2 |

Then **redeploy** (Deployments → ⋯ → Redeploy) so the build picks them up.

**For local dev**: copy `.env.example` to `.env.local`, fill in the same two values, and restart `npm run dev`. The "Continue with Google" button now does a real login.

---

## How the modes work

- **No env vars** → local mode: simulated sign-in, `localStorage` progress, seeded local leaderboard. Nothing breaks.
- **Env vars set** → Supabase mode: real Google OAuth, profiles persisted in Postgres, a genuinely global leaderboard, and enforced unique nicknames (case-insensitive).

The switch is automatic — see `src/supabase.js` (`isSupabaseConfigured`) and `src/backend.js`.

## Notes / next steps

- Scores are currently written from the client, so a determined user could tamper with their own total. For a competitive leaderboard, move score-writing behind a Supabase **Edge Function** / RPC that validates each quiz. Fine for launch; worth hardening later.
- `.env.local` is gitignored — never commit real keys. The anon key is safe to expose in the browser (that's its purpose); the `service_role` key must never ship to the client.
