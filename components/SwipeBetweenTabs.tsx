import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

// PHASE 2: tab swiping is now handled natively by the pager navigator in
// app/(tabs)/_layout.tsx (react-native-pager-view via material-top-tabs).
// This wrapper is reduced to a passthrough so its old gesture handler can't
// fight the pager. Kept (instead of unwrapping all 7 screens) so the change
// is one file and trivially reversible. If Phase 2 sticks, fully remove this
// and its call sites.
interface Props {
  name: string;
  children: ReactNode;
}

export default function SwipeBetweenTabs({ children }: Props) {
  return <View style={styles.fill}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
