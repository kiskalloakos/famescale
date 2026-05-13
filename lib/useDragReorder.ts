import { useState } from 'react';
import { Platform } from 'react-native';

// Web-only drag-to-reorder using native HTML5 events.
// react-native-web passes unknown props through to the underlying <div>,
// so the View receiving these handlers picks them up at runtime on web.
// On native, all returned handlers are no-ops (until we add gesture-handler).

export interface DragRowState {
  draggable: boolean;
  isDragging: boolean;
  isHovered: boolean;
  onDragStart: (e: any) => void;
  onDragEnd: () => void;
  onDragOver: (e: any) => void;
  onDrop: (e: any) => void;
}

const NOOP_STATE = (id: string): DragRowState => ({
  draggable: false,
  isDragging: false,
  isHovered: false,
  onDragStart: () => {},
  onDragEnd: () => {},
  onDragOver: () => {},
  onDrop: () => {},
});

export function useDragReorder<T extends { id: string }>(
  items: T[],
  onReorder: (next: T[]) => void | Promise<void>,
) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  if (Platform.OS !== 'web') {
    return (id: string) => NOOP_STATE(id);
  }

  return (id: string): DragRowState => ({
    draggable: true,
    isDragging: dragId === id,
    isHovered: hoverId === id && dragId !== id && dragId !== null,
    onDragStart: (e) => {
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
      } catch {}
      setDragId(id);
    },
    onDragEnd: () => {
      setDragId(null);
      setHoverId(null);
    },
    onDragOver: (e) => {
      e.preventDefault();
      try {
        e.dataTransfer.dropEffect = 'move';
      } catch {}
      if (dragId && dragId !== id) setHoverId(id);
    },
    onDrop: (e) => {
      e.preventDefault();
      const from = items.findIndex((it) => it.id === dragId);
      const to = items.findIndex((it) => it.id === id);
      setDragId(null);
      setHoverId(null);
      if (from === -1 || to === -1 || from === to) return;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onReorder(next);
    },
  });
}
