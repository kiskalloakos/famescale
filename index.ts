// Hermes (React Native's JS engine) doesn't expose `document` or `location`.
// Metro's HMR client touches both at module load, which throws ReferenceError
// in development on native. Defining minimal stubs here, before importing the
// real entry, keeps the HMR runtime happy without affecting app behavior.
const g = globalThis as any;
if (typeof g.document === 'undefined') {
  g.document = undefined;
}
if (typeof g.location === 'undefined') {
  g.location = { href: 'http://localhost:8081/' };
}

require('expo-router/entry');
