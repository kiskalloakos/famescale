# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npx expo start          # Start Metro bundler (scan QR with Expo Go on phone)
npx expo start --ios    # Open in iOS Simulator
npx expo start --android # Open in Android emulator
npx expo start --web    # Open in browser
```

No lint or test commands are configured yet.

## Architecture

This is a bare-minimum **Expo (React Native)** app using the classic single-file structure:

- `index.ts` — entry point; calls `registerRootComponent(App)`
- `App.tsx` — the entire application lives here (no routing, no screens directory)
- `app.json` — Expo config (name, icons, splash, platform settings)

**Stack:** Expo ~54, React 19, React Native 0.81, TypeScript (strict mode), New Architecture enabled (`newArchEnabled: true`).

There is no navigation library, no state management library, and no styling framework — just core React Native `StyleSheet`. This is a **finance app** in early development. Natural next steps as it grows: `expo-router` (file-based routing) and `AsyncStorage` for persistence.
