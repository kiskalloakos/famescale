import React from 'react';
import { Platform, ScrollView, ScrollViewProps } from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';

// On web we keep a regular ScrollView (the HTML5 drag flow lives in DraggableRow).
// On native we use NestableScrollContainer so we can drop NestableDraggableFlatList
// inside it for each sortable list.
export default function SortableScroll(props: ScrollViewProps) {
  if (Platform.OS === 'web') {
    return <ScrollView {...props} />;
  }
  return <NestableScrollContainer {...(props as any)} />;
}
