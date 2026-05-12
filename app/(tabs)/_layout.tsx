import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SetupData, getSetup, refreshSetup } from '../../lib/setup';

export default function TabLayout() {
  const [setup, setSetup] = useState<SetupData>({
    completed: true,
    investmentTabName: 'Investments',
    showRevenue: true,
  });

  useEffect(() => {
    let cancelled = false;
    getSetup().then((d) => {
      if (!cancelled && d) setSetup(d);
    });
    refreshSetup().then((d) => {
      if (!cancelled && d) setSetup(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0D0D0D',
          borderTopColor: '#1C1C1C',
          paddingBottom: 4,
        },
        tabBarActiveTintColor: '#00C896',
        tabBarInactiveTintColor: '#555',
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
          title: setup.investmentTabName,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={setup.investmentTabName === 'Savings' ? 'wallet-outline' : 'trending-up-outline'}
              size={size}
              color={color}
            />
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
