import { useEffect, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withLayoutContext } from 'expo-router';
import {
  createMaterialTopTabNavigator,
  type MaterialTopTabBarProps,
} from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
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
  icon: keyof typeof Ionicons.glyphMap;
  visible: (s: SetupData) => boolean;
}[] = [
  { name: 'index', icon: 'home-outline', visible: () => true },
  { name: 'investments', icon: 'trending-up-outline', visible: (s) => s.showInvestments },
  { name: 'savings', icon: 'wallet-outline', visible: (s) => s.showSavings },
  { name: 'revenue', icon: 'bar-chart-outline', visible: (s) => s.showRevenue },
  { name: 'debts', icon: 'document-text-outline', visible: (s) => s.showDebts },
  { name: 'net-worth', icon: 'pulse-outline', visible: (s) => s.showNetWorth },
  { name: 'settings', icon: 'person-circle-outline', visible: () => true },
];

const ICON_FOR: Record<string, keyof typeof Ionicons.glyphMap> = Object.fromEntries(
  TABS.map((t) => [t.name, t.icon]),
);

function BottomBar({ state, navigation }: MaterialTopTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 4 }]}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        return (
          <Pressable
            key={route.key}
            style={styles.tab}
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
            <Ionicons
              name={ICON_FOR[route.name] ?? 'ellipse-outline'}
              size={24}
              color={focused ? '#FFF' : '#555'}
            />
          </Pressable>
        );
      })}
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
      tabBarPosition="bottom"
      tabBar={(props) => <BottomBar {...props} />}
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
    flexDirection: 'row',
    backgroundColor: '#0D0D0D',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1C1C1C',
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
