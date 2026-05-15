import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SetupData, getSetup, peekSetup, refreshSetup, subscribeSetup } from '../../lib/setup';

const DEFAULT_SETUP: SetupData = {
  completed: true,
  showInvestments: true,
  showSavings: false,
  showRevenue: true,
  showDebts: false,
  showNetWorth: false,
  includeDebtsInNetWorth: true,
};

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

  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        lazy: false,
        animation: 'none',
        freezeOnBlur: false,
        tabBarStyle: {
          backgroundColor: '#0D0D0D',
          borderTopColor: '#1C1C1C',
          paddingBottom: 4,
        },
        tabBarActiveTintColor: '#FFF',
        tabBarInactiveTintColor: '#555',
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="investments"
        options={{
          title: 'Investments',
          href: setup.showInvestments ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="savings"
        options={{
          title: 'Savings',
          href: setup.showSavings ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="revenue"
        options={{
          title: 'Revenue',
          href: setup.showRevenue ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="debts"
        options={{
          title: 'Debts',
          href: setup.showDebts ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="net-worth"
        options={{
          title: 'Net Worth',
          href: setup.showNetWorth ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pulse-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
