// Lightweight global toast bus. One toast at a time (newer replaces older).

export interface ToastAction {
  label: string;
  onPress: () => void | Promise<void>;
}

export interface Toast {
  id: string;
  message: string;
  action?: ToastAction;
}

type Listener = (toast: Toast | null) => void;
const listeners = new Set<Listener>();
let current: Toast | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach((fn) => fn(current));
}

export function showToast(message: string, action?: ToastAction, durationMs = 3500): string {
  const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  if (timer) clearTimeout(timer);
  current = { id, message, action };
  emit();
  timer = setTimeout(() => {
    if (current?.id === id) dismissToast();
  }, durationMs);
  return id;
}

export function dismissToast(): void {
  if (!current) return;
  current = null;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  emit();
}

export function subscribeToast(fn: Listener): () => void {
  listeners.add(fn);
  fn(current);
  return () => {
    listeners.delete(fn);
  };
}
