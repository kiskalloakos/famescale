import { ReactNode, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useNavigation } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { SetupData, peekSetup, subscribeSetup } from '../lib/setup';

// Order of tabs in the bottom tab bar. Visibility flags are sourced from
// setup so swipes only land on tabs the user actually has enabled.
const ALL_TABS: { name: string; visible: (s: SetupData) => boolean }[] = [
  { name: 'index', visible: () => true },
  { name: 'investments', visible: (s) => s.showInvestments },
  { name: 'savings', visible: (s) => s.showSavings },
  { name: 'revenue', visible: (s) => s.showRevenue },
  { name: 'debts', visible: (s) => s.showDebts },
  { name: 'net-worth', visible: (s) => s.showNetWorth },
  { name: 'settings', visible: () => true },
];

const DEFAULT_SETUP: SetupData = {
  completed: true,
  showInvestments: true,
  showSavings: false,
  showRevenue: true,
  showDebts: false,
  showNetWorth: false,
  includeDebtsInNetWorth: true,
};

// Thresholds tuned to feel intentional without competing with vertical
// scrolls or the drag-to-reorder gesture used on Dashboard/Debts.
const SWIPE_DISTANCE = 50;
const SWIPE_VELOCITY = 500;

interface Props {
  name: string;
  children: ReactNode;
}

export default function SwipeBetweenTabs({ name, children }: Props) {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [setup, setSetup] = useState<SetupData>(() => peekSetup() ?? DEFAULT_SETUP);

  useEffect(() => subscribeSetup(setSetup), []);

  const { prev, next } = useMemo(() => {
    const order = ALL_TABS.filter((t) => t.visible(setup)).map((t) => t.name);
    const idx = order.indexOf(name);
    return {
      prev: idx > 0 ? order[idx - 1] : null,
      next: idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null,
    };
  }, [setup, name]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        // only the visible tab's gesture is live, so a single swipe can't
        // cascade through stacked screens' handlers
        .enabled(isFocused)
        // only activate on a clear horizontal swipe
        .activeOffsetX([-30, 30])
        // bail the moment vertical motion dominates so vertical scrolls and
        // NestableDraggableFlatList drag-to-reorder always win
        .failOffsetY([-15, 15])
        // run callbacks on the JS thread so we can call navigation directly
        .runOnJS(true)
        .onEnd((e) => {
          const left = e.translationX < -SWIPE_DISTANCE || e.velocityX < -SWIPE_VELOCITY;
          const right = e.translationX > SWIPE_DISTANCE || e.velocityX > SWIPE_VELOCITY;
          if (left && next) (navigation as { navigate: (n: string) => void }).navigate(next);
          else if (right && prev) (navigation as { navigate: (n: string) => void }).navigate(prev);
        }),
    [navigation, prev, next, name, isFocused],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.fill}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
