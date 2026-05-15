import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CURRENCIES } from '../../lib/currencies';
import {
  getCurrencyForPage,
  peekCurrencyForPage,
  refreshCurrencyForPage,
} from '../../lib/currency';
import {
  Cost,
  getDashboard,
  peekDashboard,
  refreshDashboard,
} from '../../lib/dashboard';
import { glowGreen, glowAmber } from '../../lib/glows';

function fmt(value: number, symbol: string): string {
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseAmt(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function Recurrings() {
  const insets = useSafeAreaInsets();
  const [costs, setCosts] = useState<Cost[]>(() => peekDashboard().costs);
  const [currency, setCurrency] = useState(() => peekCurrencyForPage('dashboard'));

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getDashboard().then((d) => {
        if (!cancelled) setCosts(d.costs);
      });
      refreshDashboard().then((d) => {
        if (!cancelled) setCosts(d.costs);
      });
      getCurrencyForPage('dashboard').then((c) => {
        if (!cancelled) setCurrency(c);
      });
      refreshCurrencyForPage('dashboard').then((c) => {
        if (!cancelled) setCurrency(c);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency + ' ';
  const total = costs.reduce((sum, c) => sum + parseAmt(c.amount), 0);
  const paid = costs.reduce((sum, c) => (c.paid ? sum + parseAmt(c.amount) : sum), 0);
  const left = Math.max(0, total - paid);
  const pct = total > 0 ? Math.min(1, paid / total) : 0;

  const sorted = [...costs].sort((a, b) => (a.dueDay ?? 1) - (b.dueDay ?? 1));

  return (
    <View style={[s.container, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero — paid / left this month */}
        <View style={s.heroCard}>
          <View style={s.heroRow}>
            <View>
              <Text style={s.heroLabel}>LEFT TO PAY</Text>
              <Text style={[s.heroAmount, glowAmber]}>{fmt(left, symbol)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.heroLabel}>PAID SO FAR</Text>
              <Text style={[s.heroPaid, glowGreen]}>{fmt(paid, symbol)}</Text>
            </View>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${pct * 100}%` }]} />
          </View>
          <Text style={s.heroSub}>
            {fmt(total, symbol)} total · {costs.length}{' '}
            {costs.length === 1 ? 'recurring' : 'recurrings'}
          </Text>
        </View>

        {/* This month */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>This month</Text>
          </View>

          {sorted.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="repeat-outline" size={26} color="#333" />
              <Text style={s.emptyText}>No recurring costs yet</Text>
              <Text style={s.emptyHint}>
                Add monthly costs on the Dashboard — they’ll show up here.
              </Text>
            </View>
          ) : (
            sorted.map((c, i) => (
              <View
                key={c.id}
                style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: '#1A1A1A' }]}
              >
                <View
                  style={[s.statusDot, c.paid ? s.statusPaid : s.statusDue]}
                >
                  <Ionicons
                    name={c.paid ? 'checkmark' : 'time-outline'}
                    size={13}
                    color={c.paid ? '#00C896' : '#FFA94D'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowName, c.paid && s.rowNamePaid]}>{c.name}</Text>
                  <Text style={s.rowDue}>Due {ordinal(c.dueDay ?? 1)}</Text>
                </View>
                <Text style={[s.rowAmount, c.paid && s.rowAmountPaid]}>
                  {fmt(parseAmt(c.amount), symbol)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll: { paddingHorizontal: 16, paddingTop: 6 },

  heroCard: {
    backgroundColor: '#121212',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    padding: 22,
    marginBottom: 14,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroAmount: { fontSize: 30, fontWeight: '700', color: '#FFA94D' },
  heroPaid: { fontSize: 20, fontWeight: '700', color: '#00C896' },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1E1E1E',
    marginTop: 18,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#00C896' },
  heroSub: { fontSize: 12, color: '#666', marginTop: 10 },

  card: {
    backgroundColor: '#121212',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    overflow: 'hidden',
  },
  cardHeader: { padding: 18 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#BBB', letterSpacing: 0.5 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  statusDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusPaid: { backgroundColor: '#0D1F1A', borderColor: '#1F3A30' },
  statusDue: { backgroundColor: '#241804', borderColor: '#3A2A0F' },
  rowName: { fontSize: 15, fontWeight: '600', color: '#EEE' },
  rowNamePaid: { color: '#777' },
  rowDue: { fontSize: 12, color: '#666', marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '700', color: '#FFF', fontVariant: ['tabular-nums'] },
  rowAmountPaid: { color: '#777' },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8, paddingHorizontal: 24 },
  emptyText: { fontSize: 14, color: '#777', fontWeight: '600' },
  emptyHint: { fontSize: 12, color: '#555', textAlign: 'center' },
});
