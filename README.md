**Savva — Mobile app**

This repository contains the Savva mobile app (React Native / Expo-style routing) and supporting Supabase serverless functions. The app helps kids and parents understand spending, set goals, connect bank accounts via Plaid, and exchange coaching signals.

**Highlights**
- **Multi-role app**: separate experiences for `kid` and `parent` users (onboarding, dashboards, settings, notifications).
- **Bank linking**: Plaid integration for linking accounts and syncing transactions via Supabase Edge Functions.
- **Goals & nudges**: per-category monthly goals with nudges and coaching signals.
- **Connections**: parent-child connection requests and visibility controls.
- **Offline-friendly auth**: Supabase auth with persisted sessions using `AsyncStorage`.

**What’s in this repo**
- **App routing & entry**: [app/_layout.tsx](app/_layout.tsx)
- **Auth screens**: [app/(auth)/login.tsx](app/(auth)/login.tsx), [app/(auth)/signup.tsx](app/(auth)/signup.tsx), [app/(auth)/welcome.tsx](app/(auth)/welcome.tsx)
- **Kid flow**: home, transactions, goals, insights, connections, notifications, settings under [app/(kid)/](app/(kid)/)
- **Parent flow**: parent dashboard, notifications, settings under [app/(parent)/](app/(parent)/)
- **Components**: reusable UI components in [components/](components/) (examples: [components/Header.tsx](components/Header.tsx), [components/BottomNav.tsx](components/BottomNav.tsx), [components/AnimatedSplash.tsx](components/AnimatedSplash.tsx), [components/GoalCard.tsx](components/GoalCard.tsx))
- **Business logic & helpers**: [lib/](lib/) — `supabase.ts`, `plaid.ts`, `spending.ts`, `metrics.ts`, `onboarding.ts`, `theme.ts` (core helpers and utilities)
- **Supabase functions**: serverless functions in [supabase/functions/](supabase/functions/) (example: [supabase/functions/create-link-token/index.ts](supabase/functions/create-link-token/index.ts))
- **Android native project**: full Android folder for native build ([android/](android/))

**Key user flows & features (detailed)**
- **Sign up / Sign in**: `signup` collects `full_name`, `username`, `email`, `password`, and `role` (`kid` or `parent`). `login` signs in and redirects based on role and onboarding state. See [app/(auth)/signup.tsx](app/(auth)/signup.tsx) and [app/(auth)/login.tsx](app/(auth)/login.tsx).
- **Onboarding**: lightweight onboarding checks persisted state and shows a checklist; controlled by [lib/onboarding.ts](lib/onboarding.ts) and [app/(auth)/welcome.tsx](app/(auth)/welcome.tsx).
- **Kid dashboard**: spending pie chart, sync status, goals, insights, Plaid bank linking. Bank linking uses `createLinkToken` in [lib/plaid.ts](lib/plaid.ts) and the serverless function [supabase/functions/create-link-token/index.ts](supabase/functions/create-link-token/index.ts).
- **Parent dashboard**: view connected kids, coaching signals (goal nudges, spend velocity), recent transactions, send connection requests. Logic lives in [app/(parent)/index.tsx](app/(parent)/index.tsx) and spending helpers in [lib/spending.ts](lib/spending.ts).
- **Transactions & Sync**: transactions are stored in `transactions` table and synced via Supabase function `sync-transactions` (invoked from client with `supabase.functions.invoke`). See `syncTransactions` usage in [app/(kid)/index.tsx](app/(kid)/index.tsx).
- **Goals**: CRUD and per-category monthly limits; goal nudge calculation and severity lives in [lib/spending.ts](lib/spending.ts).
- **Notifications**: in-app notification feed, mark-as-read, mark-all-read features (kid & parent). Implemented in [app/(kid)/notifications.tsx](app/(kid)/notifications.tsx) and [app/(parent)/notifications.tsx](app/(parent)/notifications.tsx).
- **Profile & Settings**: both roles can edit profile, change email/password, and update metadata stored in Supabase Auth and `users` table. See [app/(kid)/settings.tsx](app/(kid)/settings.tsx) and [app/(parent)/settings.tsx](app/(parent)/settings.tsx).
- **Metrics & offline queueing**: client-side event tracking is queued in `AsyncStorage` by [lib/metrics.ts](lib/metrics.ts).

**Technical notes / architecture**
- Frontend: React Native (Expo Router style), TypeScript, functional components/hooks.
- Auth & backend: Supabase for Auth, Realtime, Postgres storage, and Edge Functions for Plaid interactions.
- Local storage: `@react-native-async-storage/async-storage` used for auth session persistence, onboarding flag, metrics queue, and splash visibility.
- Styling: centralized tokens in [lib/theme.ts](lib/theme.ts).

**Environment variables**
Create a `.env` (or use platform-specific config) with at least these values:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-supabase-url.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=public-anon-key
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox
SUPABASE_SERVICE_ROLE_KEY=service-role-key (only for secure server envs)
```

Note: `EXPO_PUBLIC_*` values are safe to expose in the client; secrets such as `PLAID_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` must only be present in server-side or CI/CD environments.

**Install & run (development)**
Prerequisites: Node.js, Yarn or npm, Java & Android Studio (for Android builds), and a Supabase project.

```bash
# install
npm install

# start Metro / Expo dev server
npm start

# run on Android emulator/device (React Native CLI or Expo dev client)
npx react-native run-android
```

If you use Expo Go / Dev Client, follow the local Expo workflow your project uses.

**Supabase Edge Functions (Plaid integration)**
- The repo contains a Deno function at [supabase/functions/create-link-token/index.ts](supabase/functions/create-link-token/index.ts) that calls Plaid to mint a Link token. Store `PLAID_CLIENT_ID` and `PLAID_SECRET` in your Supabase function environment variables.
- There are other serverless function invocations from the client (for example `exchange-public-token` and `sync-transactions`) — ensure corresponding functions exist and have the right env variables set in your Supabase project.

**Database expectations (Postgres tables)**
The app expects several tables/columns — common ones include:
- `users` (id, full_name, username, email, role)
- `transactions` (id, user_id, merchant_name, category, amount, transaction_date)
- `goals` (id, user_id, category, monthly_limit)
- `notifications` (id, user_id, type, message, read, created_at)
- `plaid_accounts` (id, user_id, ...)
- `parent_child_connections` and `connection_requests`

Schema is referenced across the app files (search for `.from('...')` calls in [app/](app) and [lib/](lib)).

**Developer tips & troubleshooting**
- If auth sessions do not persist, verify `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are correct in your environment and that `AsyncStorage` is available.
- Plaid errors: confirm `PLAID_CLIENT_ID` and `PLAID_SECRET` are set in the server/runtime env for functions. Use `PLAID_ENV=sandbox` for local testing.
- If a function returns permission errors, confirm the function environment uses a service role key for elevated access where necessary.

**Where to look in code**
- App entry & routing: [app/_layout.tsx](app/_layout.tsx)
- Kid dashboard: [app/(kid)/index.tsx](app/(kid)/index.tsx)
- Parent dashboard: [app/(parent)/index.tsx](app/(parent)/index.tsx)
- Shared UI: [components/](components/)
- Helpers: [lib/](lib/)
- Supabase functions: [supabase/functions/](supabase/functions/)

**Next steps you might want**
- Add a `README.md` section with database migration SQL or a `supabase` project export.
- Document each Supabase Edge Function with its expected request/response shape.
- Add unit tests for `lib/spending.ts` helpers (deterministic, easy to test).

---

README created automatically to reflect app capabilities. See [README.md](README.md) for the file you are reading.
