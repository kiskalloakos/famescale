import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// ─────────────────────────────────────────────────────────────────────────────
// Synthesized sound via Web Audio API (web only). Mobile relies on haptics.
// AudioContext is lazily created on first interaction (browsers gate it).
// ─────────────────────────────────────────────────────────────────────────────

type WebAudioCtx = AudioContext;

// Flip to true to re-enable Web Audio sound effects across the app.
// Haptics continue to fire on mobile regardless of this flag.
const SOUND_ENABLED = false;

let ctx: WebAudioCtx | null = null;
let enabled = true;

function getCtx(): WebAudioCtx | null {
  if (!SOUND_ENABLED) return null;
  if (Platform.OS !== 'web') return null;
  if (!enabled) return null;
  if (ctx) return ctx;
  try {
    const Anyway = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (!Anyway) return null;
    ctx = new Anyway();
    return ctx;
  } catch {
    return null;
  }
}

interface Note {
  freq: number;
  /** Seconds */
  duration: number;
  /** Seconds from start of sequence */
  start: number;
  type?: OscillatorType;
  /** Peak gain (0..1). Defaults to 0.18. */
  gain?: number;
}

function playSequence(notes: Note[]): void {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  for (const n of notes) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.value = n.freq;
    const peak = n.gain ?? 0.18;
    const t0 = now + n.start;
    const t1 = t0 + n.duration;
    // Quick attack, exponential-ish decay — avoids clicks.
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + Math.min(0.008, n.duration / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Haptics — no-op on web.
// ─────────────────────────────────────────────────────────────────────────────

function impact(style: Haptics.ImpactFeedbackStyle): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(style).catch(() => {});
}

function notify(type: Haptics.NotificationFeedbackType): void {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(type).catch(() => {});
}

function selection(): void {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — semantic, not literal. Caller asks for the *intent*.
// ─────────────────────────────────────────────────────────────────────────────

export const feedback = {
  /** Generic tap (open modal, expand row). */
  tap(): void {
    impact(Haptics.ImpactFeedbackStyle.Light);
    playSequence([{ freq: 1200, duration: 0.04, start: 0, type: 'sine', gain: 0.08 }]);
  },

  /** Pick / toggle a discrete option (switch, picker row, eye toggle). */
  select(): void {
    selection();
    playSequence([{ freq: 880, duration: 0.05, start: 0, type: 'triangle', gain: 0.1 }]);
  },

  /** A thing got saved / completed (modal Save, mark cost paid). */
  success(): void {
    impact(Haptics.ImpactFeedbackStyle.Medium);
    playSequence([
      { freq: 523.25, duration: 0.09, start: 0, type: 'triangle', gain: 0.14 }, // C5
      { freq: 659.25, duration: 0.13, start: 0.07, type: 'triangle', gain: 0.14 }, // E5
    ]);
  },

  /** Money came IN — bright ascending arpeggio. */
  moneyIn(): void {
    notify(Haptics.NotificationFeedbackType.Success);
    playSequence([
      { freq: 523.25, duration: 0.07, start: 0, type: 'triangle', gain: 0.13 }, // C5
      { freq: 659.25, duration: 0.07, start: 0.05, type: 'triangle', gain: 0.13 }, // E5
      { freq: 783.99, duration: 0.08, start: 0.1, type: 'triangle', gain: 0.13 }, // G5
      { freq: 1046.5, duration: 0.14, start: 0.15, type: 'triangle', gain: 0.14 }, // C6
    ]);
  },

  /** Money went OUT — softer descending tone (no alarm). */
  moneyOut(): void {
    impact(Haptics.ImpactFeedbackStyle.Medium);
    playSequence([
      { freq: 587.33, duration: 0.08, start: 0, type: 'triangle', gain: 0.12 }, // D5
      { freq: 440.0, duration: 0.14, start: 0.06, type: 'triangle', gain: 0.12 }, // A4
    ]);
  },

  /** Destructive action (delete with undo). Warning, not error. */
  destroy(): void {
    notify(Haptics.NotificationFeedbackType.Warning);
    playSequence([
      { freq: 392.0, duration: 0.08, start: 0, type: 'triangle', gain: 0.11 }, // G4
      { freq: 261.63, duration: 0.14, start: 0.06, type: 'triangle', gain: 0.11 }, // C4
    ]);
  },

  /** Drag-and-drop release. Short low thump. */
  dragEnd(): void {
    impact(Haptics.ImpactFeedbackStyle.Soft);
    playSequence([{ freq: 110, duration: 0.07, start: 0, type: 'sine', gain: 0.16 }]);
  },

  /** Something went wrong (validation / alert). */
  error(): void {
    notify(Haptics.NotificationFeedbackType.Error);
    playSequence([
      { freq: 311.13, duration: 0.1, start: 0, type: 'square', gain: 0.08 }, // Eb4
      { freq: 293.66, duration: 0.18, start: 0.08, type: 'square', gain: 0.08 }, // D4
    ]);
  },

  /** Master switch — set to false to silence (e.g. user-facing mute). */
  setEnabled(on: boolean): void {
    enabled = on;
  },
};
