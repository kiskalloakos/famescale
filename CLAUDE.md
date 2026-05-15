# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npx expo start          # Start Metro bundler (scan QR with Expo Go on phone)
npx expo start --ios    # Open in iOS Simulator
npx expo start --android # Open in Android emulator
npx expo start --web    # Open in browser
npm test                # Jest — pure logic in lib/ only (ts-jest, node env)
```

No lint command is configured. `npm test` is scoped to `lib/**/*.test.ts`
(pure modules, no React Native imports — no jest-expo / RN mocking). Component
tests, if added, would need a separate jest-expo project.

## Architecture

**Expo (React Native) + expo-router** finance app. Cloud-synced via Supabase,
no custom backend.

**Routing** (file-based, under `app/`):
- `index.ts` — entry point; `registerRootComponent`.
- `app/_layout.tsx` — root. Auth/onboarding/recovery phase machine, Supabase
  session + password-recovery deep links, `SafeAreaProvider`,
  `GestureHandlerRootView`, and a forced dark navigation theme.
- `app/(tabs)/_layout.tsx` — bottom tab navigator (icon-only, dark). Tab
  visibility is conditional via `href: setup.showX ? undefined : null`.
- `app/(tabs)/*.tsx` — the 7 screens: `index` (Dashboard), `investments`,
  `savings`, `revenue`, `debts`, `net-worth`, `settings`.
- `app/+html.tsx` — web HTML shell incl. CSP.
- `app.json` — Expo config (`scheme: famescale`, `newArchEnabled: true`).

**Data layer** (`lib/`): each domain (dashboard, investments, savings, debts,
revenue, currency, setup, transactions) exposes the same shape:
- `getX()` — local read from profile-scoped AsyncStorage (`storage.ts`).
- `peekX()` — synchronous read of an in-memory cache (primed at sign-in in the
  root layout). Screens seed `useState` from this so the first paint already
  has real data.
- `refreshX()` — authoritative read from Supabase, writes back to local.
- `saveX()` — local + Supabase upsert (via `sync.ts` `reportable()` →
  `SyncIndicator`).
- `finance.ts` — pure money math (`fv`, `monthsSinceStart`); unit-tested.
- `supabase.ts` — client; anon key from `EXPO_PUBLIC_*` env. **RLS is the only
  access control.** All 8 tables use `FOR ALL ... USING/WITH CHECK
  (auth.uid() = user_id)`. Audit SQL at repo root: `SECURITY_VERIFY.sql`
  (read-only check), `SECURITY_TODO.sql`, `MIGRATION_*.sql`. Run
  `SECURITY_VERIFY.sql` in the Supabase SQL editor whenever a table is added.

**Stack:** Expo ~54, React 19, React Native 0.81, TypeScript strict, New
Architecture. expo-router 6, @react-navigation/bottom-tabs 7, Supabase,
gesture-handler/reanimated, draggable-flatlist, safe-area-context.

## Conventions & gotchas

These are non-obvious and have bitten before — respect them:

- **Screens seed state from `peekX()`, not empty defaults.** Reverting to
  `useState([])`/`useState(DEFAULT)` reintroduces a first-visit layout bounce.
- **Tab screens use `<View>` + `useSafeAreaInsets()`, not `<SafeAreaView>`.**
  SafeAreaView committed `paddingTop: 0` for one frame → visible jump.
- **The dark navigation theme in `app/_layout.tsx` is load-bearing.**
  react-native-screens paints the native screen background from
  `theme.colors.background`; without it, tab transitions flash white.
- **`SwipeBetweenTabs`** wraps every tab for horizontal swipe nav; the gesture
  is enabled only on the focused screen (stacked handlers otherwise cascade).
- **`@expo/cli` must match the Expo SDK major** (54.x — *not* 55). A mismatch
  ships a Metro whose HMR URL format Expo Go rejects, crashing the dev server.
- **UUIDs come from `newId()`** (`lib/dashboard.ts`, expo-crypto). Never
  `Math.random()`.
- react-native-draggable-flatlist@4.0.3 emits a cosmetic `measureLayout`
  warning under the New Architecture; it's suppressed via `LogBox.ignoreLogs`
  in `app/_layout.tsx`. Drag works — don't chase it.
