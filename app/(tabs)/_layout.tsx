import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, ScrollView, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withLayoutContext } from 'expo-router';
import {
  createMaterialTopTabNavigator,
  type MaterialTopTabBarProps,
} from '@react-navigation/material-top-tabs';
import { SetupData, getSetup, peekSetup, refreshSetup, subscribeSetup } from '../../lib/setup';

// react-native-pager-view under the hood → real finger-tracked paging.
// The `true` 3rd arg makes the declared <Screen> children the definitive
// route set (default would include every file route), so conditionally
// rendering them below actually hides tabs.
const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator, undefined, true);

const DEFAULT_SETUP: SetupData = {
  completed: true,
  showInvestments: true,
  showSavings: false,
  showRevenue: true,
  showDebts: false,
  showNetWorth: false,
  includeDebtsInNetWorth: true,
};

// Tab bar order. `always` tabs ignore setup; the rest mirror the old
// `href: setup.showX ? undefined : null` visibility exactly.
const TABS: {
  name: string;
  title: string;
  visible: (s: SetupData) => boolean;
}[] = [
  { name: 'index', title: 'Dashboard', visible: () => true },
  { name: 'investments', title: 'Investments', visible: (s) => s.showInvestments },
  { name: 'savings', title: 'Savings', visible: (s) => s.showSavings },
  { name: 'revenue', title: 'Revenue', visible: (s) => s.showRevenue },
  { name: 'debts', title: 'Debts', visible: (s) => s.showDebts },
  { name: 'net-worth', title: 'Net Worth', visible: (s) => s.showNetWorth },
  { name: 'settings', title: 'Settings', visible: () => true },
];

const TITLE_FOR: Record<string, string> = Object.fromEntries(
  TABS.map((t) => [t.name, t.title]),
);

// Copilot-style segmented pill row at the top, horizontally scrollable so any
// number of tabs fits. The focused pill auto-scrolls into view, so swiping to
// an off-screen tab still keeps its pill visible.
function TopBar({ state, navigation }: MaterialTopTabBarProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const layouts = useRef<Record<number, { x: number; width: number }>>({});
  const viewport = useRef(0);

  const scrollActiveIntoView = (index: number, animated = true) => {
    const l = layouts.current[index];
    if (!l || !viewport.current) return;
    const target = l.x + l.width / 2 - viewport.current / 2;
    scrollRef.current?.scrollTo({ x: Math.max(0, target), animated });
  };

  useEffect(() => {
    // Non-animated: rapid tab changes (fast swipe/tap) would otherwise stack
    // competing glide animations and stutter. Snapping keeps it smooth and
    // consistent with the instant pill-highlight change.
    scrollActiveIntoView(state.index, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index]);

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 10 }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        contentContainerStyle={styles.row}
        onLayout={(e) => {
          viewport.current = e.nativeEvent.layout.width;
          // On (re)mount the effect above fires before pills have measured;
          // once the viewport is known, snap the active pill into view.
          scrollActiveIntoView(state.index, false);
        }}
      >
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          return (
            <Pressable
              key={route.key}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                layouts.current[i] = { x, width };
                // After a remount the active pill measures last; snap to it.
                if (i === state.index) scrollActiveIntoView(i, false);
              }}
              style={[styles.pill, focused && styles.pillActive]}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
            >
              <Text style={[styles.pillText, focused && styles.pillTextActive]}>
                {TITLE_FOR[route.name] ?? route.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function TabLayout() {
  const [setup, setSetup] = useState<SetupData>(() => peekSetup() ?? DEFAULT_SETUP);

  useEffect(() => {
    let cancelled = false;
    getSetup().then((d) => {
      if (!cancelled && d) setSetup(d);
    });
    refreshSetup().then((d) => {
      if (!cancelled && d) setSetup(d);
    });
    const unsubscribe = subscribeSetup((d) => {
      if (!cancelled) setSetup(d);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const visible = useMemo(() => TABS.filter((t) => t.visible(setup)), [setup]);

  // react-native-tab-view's pager view desyncs from navigation state when the
  // route array length changes at runtime (the toggle jitter / wrong-page /
  // stale-state bugs). Keying the navigator on the visible set forces a clean
  // remount on visibility change; expo-router is URL-driven so it re-derives
  // the correct focused tab from the current path. Screens re-seed instantly
  // from the peekX() cache. Visibility toggles are rare, so the remount cost
  // is acceptable in exchange for zero pager desync.
  const navKey = visible.map((t) => t.name).join('|');

  return (
    <MaterialTopTabs
      key={navKey}
      tabBarPosition="top"
      tabBar={(props) => <TopBar {...props} />}
      style={{ backgroundColor: '#0D0D0D' }}
      // Snap (no animation) for tab taps; finger-tracked swipe still animates
      // (RNTV keeps swipe animation regardless of this flag).
      screenOptions={{ animationEnabled: false }}
    >
      {visible.map((t) => (
        <MaterialTopTabs.Screen key={t.name} name={t.name} />
      ))}
    </MaterialTopTabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#0D0D0D',
    paddingBottom: 18,
  },
  row: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: '#1C1C1C',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 0.2,
  },
  pillTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
});
