import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrency, refreshCurrency } from '../../lib/currency';
import { getDashboard, refreshDashboard } from '../../lib/dashboard';
import { getInvestments, refreshInvestments } from '../../lib/investments';
import { getSavings, refreshSavings } from '../../lib/savings';
import { getDebts, refreshDebts } from '../../lib/debts';
import { SetupData, getSetup, refreshSetup, saveSetup, subscribeSetup } from '../../lib/setup';

const CURRENCIES = [
  { code: 'RON', symbol: 'lei ' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'HUF', symbol: 'Ft ' },
  { code: 'CHF', symbol: 'Fr ' },
];

function fmt(value: number, symbol: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  return `${sign}${symbol}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseAmt(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export default function NetWorth() {
  const [cash, setCash] = useState(0);
  const [invested, setInvested] = useState(0);
  const [saved, setSaved] = useState(0);
  const [debts, setDebts] = useState(0);
  const [currency, setCurrency] = useState('RON');
  const [setup, setSetup] = useState<SetupData | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const applyDashboard = (d: { accounts: { amount: string }[] }) => {
        if (cancelled) return;
        setCash(d.accounts.reduce((s, a) => s + parseAmt(a.amount), 0));
      };
      const applyInvestments = (i: { totalInvested: string }) => {
        if (cancelled) return;
        setInvested(parseAmt(i.totalInvested));
      };
      const applySavings = (i: { totalInvested: string }) => {
        if (cancelled) return;
        setSaved(parseAmt(i.totalInvested));
      };
      const applyDebts = (list: { amount: string }[]) => {
        if (cancelled) return;
        setDebts(list.reduce((s, d) => s + parseAmt(d.amount), 0));
      };

      getDashboard().then(applyDashboard);
      refreshDashboard().then(applyDashboard);
      getInvestments().then(applyInvestments);
      refreshInvestments().then(applyInvestments);
      getSavings().then(applySavings);
      refreshSavings().then(applySavings);
      getDebts().then(applyDebts);
      refreshDebts().then(applyDebts);
      getCurrency().then((c) => !cancelled && setCurrency(c));
      refreshCurrency().then((c) => !cancelled && setCurrency(c));
      getSetup().then((s) => !cancelled && s && setSetup(s));
      refreshSetup().then((s) => !cancelled && s && setSetup(s));
      const unsub = subscribeSetup((s) => !cancelled && setSetup(s));
      return () => {
        cancelled = true;
        unsub();
      };
    }, []),
  );

  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency + ' ';
  const investmentsEnabled = setup?.showInvestments !== false;
  const savingsEnabled = setup?.showSavings === true;
  const debtsEnabled = setup?.showDebts !== false;
  const debtsCountInTotal = debtsEnabled && setup?.includeDebtsInNetWorth !== false;
  const investedTotal = (investmentsEnabled ? invested : 0) + (savingsEnabled ? saved : 0);
  const netWorth = cash + investedTotal - (debtsCountInTotal ? debts : 0);

  const toggleDebtsInNetWorth = async () => {
    if (!setup) return;
    const next: SetupData = { ...setup, includeDebtsInNetWorth: !setup.includeDebtsInNetWorth };
    setSetup(next);
    await saveSetup(next);
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>NET WORTH</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.heroCard}>
          <Text style={s.heroLabel}>NET WORTH</Text>
          <Text
            style={[
              s.heroAmount,
              netWorth < 0 && { color: '#FF6B6B', textShadowColor: 'rgba(255, 107, 107, 0.45)' },
            ]}
          >
            {fmt(netWorth, symbol)}
          </Text>
          <Text style={s.heroSub}>In your global currency · {currency}</Text>
        </View>

        <View style={s.breakdownCard}>
          <Text style={s.breakdownTitle}>Breakdown</Text>

          <View style={s.line}>
            <View style={s.lineLeft}>
              <Ionicons name="wallet-outline" size={16} color="#00C896" />
              <Text style={s.lineLabel}>Cash on hand</Text>
            </View>
            <Text style={s.linePos}>{fmt(cash, symbol)}</Text>
          </View>

          {investmentsEnabled && (
            <View style={[s.line, s.lineBordered]}>
              <View style={s.lineLeft}>
                <Ionicons name="trending-up-outline" size={16} color="#00C896" />
                <Text style={s.lineLabel}>Investments</Text>
              </View>
              <Text style={s.linePos}>{fmt(invested, symbol)}</Text>
            </View>
          )}

          {savingsEnabled && (
            <View style={[s.line, s.lineBordered]}>
              <View style={s.lineLeft}>
                <Ionicons name="wallet-outline" size={16} color="#00C896" />
                <Text style={s.lineLabel}>Savings</Text>
              </View>
              <Text style={s.linePos}>{fmt(saved, symbol)}</Text>
            </View>
          )}

          {debtsEnabled && (
            <View style={[s.line, s.lineBordered]}>
              <View style={s.lineLeft}>
                <Ionicons
                  name="document-text-outline"
                  size={16}
                  color={debtsCountInTotal ? '#FF6B6B' : '#3A3A3A'}
                />
                <Text style={[s.lineLabel, !debtsCountInTotal && s.lineLabelMuted]}>Debts</Text>
                <TouchableOpacity
                  onPress={toggleDebtsInNetWorth}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={s.eyeBtn}
                >
                  <Ionicons
                    name={debtsCountInTotal ? 'eye-outline' : 'eye-off-outline'}
                    size={14}
                    color={debtsCountInTotal ? '#555' : '#3A6A5A'}
                  />
                </TouchableOpacity>
              </View>
              <Text style={[s.lineNeg, !debtsCountInTotal && s.lineMuted]}>
                {debtsCountInTotal ? '− ' : ''}
                {fmt(debts, symbol)}
              </Text>
            </View>
          )}

          <View style={s.totalRow}>
            <Text style={s.totalLabel}>NET WORTH</Text>
            <Text style={[s.totalValue, netWorth < 0 && { color: '#FF6B6B' }]}>
              {fmt(netWorth, symbol)}
            </Text>
          </View>
        </View>

        <Text style={s.footnote}>
          Aggregated from the data you already track. Numbers refresh whenever you open this tab.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#FFF', letterSpacing: 3 },
  scroll: { paddingHorizontal: 16 },

  heroCard: {
    backgroundColor: '#151515',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  heroLabel: { fontSize: 10, fontWeight: '600', color: '#555', letterSpacing: 1.5, marginBottom: 10 },
  heroAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: '#00C896',
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0, 200, 150, 0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  heroSub: { fontSize: 11, color: '#444', marginTop: 10, fontWeight: '500' },

  breakdownCard: {
    backgroundColor: '#151515',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 16,
    overflow: 'hidden',
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#BBB',
    letterSpacing: 0.5,
    padding: 18,
    paddingBottom: 12,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  lineBordered: { borderTopWidth: 1, borderTopColor: '#1C1C1C' },
  lineLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineLabel: { fontSize: 14, color: '#CCC', fontWeight: '500' },
  linePos: { fontSize: 14, color: '#EEE', fontWeight: '500', fontVariant: ['tabular-nums'] },
  lineNeg: { fontSize: 14, color: '#FF6B6B', fontWeight: '500', fontVariant: ['tabular-nums'] },
  lineLabelMuted: { color: '#555', textDecorationLine: 'line-through' },
  lineMuted: { color: '#3A3A3A', textDecorationLine: 'line-through' },
  eyeBtn: { padding: 4, marginLeft: 4 },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
    backgroundColor: '#0F0F0F',
  },
  totalLabel: { fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 1.5 },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#00C896', fontVariant: ['tabular-nums'] },

  footnote: { fontSize: 12, color: '#444', textAlign: 'center', marginTop: 4, lineHeight: 18, fontWeight: '500' },
});
