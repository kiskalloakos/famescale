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
- `app/(tabs)/_layout.tsx` — **material-top-tabs pager** (react-native-pager-view)
  positioned at the bottom via `withLayoutContext`, with a custom icon-only
  dark `tabBar`. Native finger-tracked swipe. `withLayoutContext`'s 3rd arg
  is `true` so declared `<Screen>` children are the definitive route set;
  visibility is `setup.showX` filtering of those children. The navigator is
  `key`-ed on the visible set so a visibility toggle does a clean remount
  (avoids react-native-tab-view pager-vs-state desync).
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
- `finance.ts` — pure, dependency-free money/logic (`fv`,
  `monthsSinceStart`, `computeNetWorth`, `resetStaleCosts`); unit-tested
  (`finance.test.ts`, 26 cases). `userId()` lives in `supabase.ts`;
  `CURRENCIES` in `currencies.ts` — both deduped, don't re-inline.
- `supabase.ts` — client; anon key from `EXPO_PUBLIC_*` env. **RLS is the only
  access control.** All 8 tables use `FOR ALL ... USING/WITH CHECK
  (auth.uid() = user_id)`. Audit SQL at repo root: `SECURITY_VERIFY.sql`
  (read-only check), `SECURITY_TODO.sql`, `MIGRATION_*.sql`. Run
  `SECURITY_VERIFY.sql` in the Supabase SQL editor whenever a table is added.

**Stack:** Expo ~54, React 19, React Native 0.81, TypeScript strict, New
Architecture. expo-router 6, @react-navigation/material-top-tabs 7 +
react-native-pager-view, Supabase, gesture-handler/reanimated,
draggable-flatlist, safe-area-context.

## Conventions & gotchas

These are non-obvious and have bitten before — respect them:

- **Screens seed state from `peekX()`, not empty defaults.** Reverting to
  `useState([])`/`useState(DEFAULT)` reintroduces a first-visit layout bounce.
- **Tab screens use `<View>` + `useSafeAreaInsets()`, not `<SafeAreaView>`.**
  SafeAreaView committed `paddingTop: 0` for one frame → visible jump.
- **The dark navigation theme in `app/_layout.tsx` is load-bearing.**
  react-native-screens paints the native screen background from
  `theme.colors.background`; without it, tab transitions flash white.
- **Tab swipe is native (pager), not a JS gesture.** The navigator is
  `key`-ed on the visible-tab set: toggling a tab in Settings remounts it
  (screens re-seed from `peekX()` instantly; scroll resets — acceptable for a
  rare action). Don't try to "fix" the toggle with post-hoc `navigate()` —
  react-native-tab-view desyncs the pager view from nav state on runtime
  route-list changes; the remount is the working fix. `animationEnabled:false`
  keeps taps instant; swipe still animates regardless.
- **`@expo/cli` must match the Expo SDK major** (54.x — *not* 55). A mismatch
  ships a Metro whose HMR URL format Expo Go rejects, crashing the dev server.
- **UUIDs come from `newId()`** (`lib/dashboard.ts`, expo-crypto). Never
  `Math.random()`.
- react-native-draggable-flatlist@4.0.3 emits a cosmetic `measureLayout`
  warning under the New Architecture; it's suppressed via `LogBox.ignoreLogs`
  in `app/_layout.tsx`. Drag works — don't chase it.
