import React, { useEffect, useRef } from 'react';
import { View, Platform, ViewProps } from 'react-native';

export interface DragHandlers {
  draggable: boolean;
  onDragStart: (e: any) => void;
  onDragEnd: () => void;
  onDragOver: (e: any) => void;
  onDrop: (e: any) => void;
}

interface Props extends ViewProps {
  handlers: DragHandlers;
}

// react-native-web's <View> silently filters out arbitrary HTML props like
// `draggable` and `onDragStart`. We use a ref to grab the underlying DOM node
// and attach native drag listeners directly. handlersRef keeps the closures
// fresh so we don't have to re-attach on every render.
export default function DraggableRow({ handlers, style, children, ...rest }: Props) {
  const ref = useRef<any>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = ref.current;
    if (!node) return;

    const onDragStart = (e: DragEvent) => handlersRef.current.onDragStart(e);
    const onDragEnd = () => handlersRef.current.onDragEnd();
    const onDragOver = (e: DragEvent) => handlersRef.current.onDragOver(e);
    const onDrop = (e: DragEvent) => handlersRef.current.onDrop(e);

    node.addEventListener('dragstart', onDragStart);
    node.addEventListener('dragend', onDragEnd);
    node.addEventListener('dragover', onDragOver);
    node.addEventListener('drop', onDrop);

    return () => {
      node.removeEventListener('dragstart', onDragStart);
      node.removeEventListener('dragend', onDragEnd);
      node.removeEventListener('dragover', onDragOver);
      node.removeEventListener('drop', onDrop);
    };
  }, []);

  // Keep the native `draggable` attribute in sync with the current value.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = ref.current;
    if (node) node.draggable = handlers.draggable;
  }, [handlers.draggable]);

  return (
    <View ref={ref} style={style} {...rest}>
      {children}
    </View>
  );
}
