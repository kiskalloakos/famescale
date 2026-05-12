import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { CURRENCY_KEY } from '../../constants/storage';
import {
  RevenueState,
  getRevenue,
  saveRevenue,
  allTimeTotal,
  previousEntry,
  activeMonthCount,
} from '../../lib/revenue';

const CURRENCIES = [
  { code: 'RON', symbol: 'lei ' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'HUF', symbol: 'Ft ' },
  { code: 'CHF', symbol: 'Fr ' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(value: number, symbol: string): string {
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function Revenue() {
  const [state, setState] = useState<RevenueState | null>(null);
  const [currency, setCurrency] = useState('RON');
  const [editVisible, setEditVisible] = useState(false);
  const [monthInputs, setMonthInputs] = useState<string[]>(Array(12).fill(''));

  useFocusEffect(
    useCallback(() => {
      getRevenue().then(setState);
      AsyncStorage.getItem(CURRENCY_KEY).then((val) => {
        if (val) setCurrency(val);
      });
    }, []),
  );

  if (!state) {
    return <SafeAreaView style={s.container} />;
  }

  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency + ' ';
  const currentEntry = state.entries.find((e) => e.label === state.currentYearLabel);
  const currentAmount = currentEntry?.amount ?? 0;
  const currentMonths = currentEntry?.months;
  const prev = previousEntry(state);
  const total = allTimeTotal(state.entries);

  let growthPct: number | null = null;
  if (prev && prev.amount > 0) {
    growthPct = ((currentAmount - prev.amount) / prev.amount) * 100;
  }

  // Monthly average — prefer count of months with actual data, fall back to /12.
  const activeCount = activeMonthCount(currentMonths);
  let monthlyAvg = 0;
  let avgLabel = '';
  if (activeCount > 0) {
    monthlyAvg = currentAmount / activeCount;
    avgLabel = `across ${activeCount} active month${activeCount === 1 ? '' : 's'}`;
  } else if (currentAmount > 0) {
    monthlyAvg = currentAmount / 12;
    avgLabel = 'assuming full year';
  }

  // Largest month (if monthly data exists)
  let bestMonth: { name: string; amount: number } | null = null;
  if (currentMonths) {
    const maxIdx = currentMonths.reduce((mi, val, i, arr) => (val > arr[mi] ? i : mi), 0);
    if (currentMonths[maxIdx] > 0) {
      bestMonth = { name: MONTHS[maxIdx], amount: currentMonths[maxIdx] };
    }
  }

  const openEdit = () => {
    const seed = currentMonths
      ? currentMonths.map((m) => (m > 0 ? String(m) : ''))
      : Array(12).fill('');
    setMonthInputs(seed);
    setEditVisible(true);
  };

  const updateMonth = (idx: number, value: string) => {
    setMonthInputs((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  const liveTotal = monthInputs.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

  const saveEdit = async () => {
    const months = monthInputs.map((v) => parseFloat(v) || 0);
    const amount = months.reduce((a, b) => a + b, 0);
    const updated: RevenueState = {
      ...state,
      entries: state.entries.map((e) =>
        e.label === state.currentYearLabel ? { ...e, amount, months } : e,
      ),
    };
    setState(updated);
    await saveRevenue(updated);
    setEditVisible(false);
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>REVENUE</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Main current-year card */}
        <TouchableOpacity style={s.heroCard} onPress={openEdit} activeOpacity={0.85}>
          <View style={s.heroTopRow}>
            <Text style={s.heroYear}>{state.currentYearLabel}</Text>
            <View style={s.currentPill}>
              <Text style={s.currentPillText}>CURRENT</Text>
            </View>
          </View>

          <Text style={s.heroAmount}>{fmt(currentAmount, symbol)}</Text>

          {growthPct !== null && (
            <View style={s.growthRow}>
              <Ionicons
                name={growthPct >= 0 ? 'trending-up' : 'trending-down'}
                size={14}
                color={growthPct >= 0 ? '#00C896' : '#FF4C4C'}
              />
              <Text style={[s.growthText, { color: growthPct >= 0 ? '#00C896' : '#FF4C4C' }]}>
                {growthPct >= 0 ? '+' : ''}
                {growthPct.toFixed(1)}% vs {prev!.label}
              </Text>
            </View>
          )}

          <View style={s.heroDivider} />

          <View style={s.heroFooter}>
            <Text style={s.heroFooterLabel}>All-time total</Text>
            <Text style={s.heroFooterValue}>{fmt(total, symbol)}</Text>
          </View>

          <View style={s.editHint}>
            <Ionicons name="pencil-outline" size={11} color="#444" />
            <Text style={s.editHintText}>Tap to update monthly</Text>
          </View>
        </TouchableOpacity>

        {/* Monthly average + best month */}
        {currentAmount > 0 && (
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statLabel}>MONTHLY AVG</Text>
              <Text style={s.statValue}>{fmt(monthlyAvg, symbol)}</Text>
              {avgLabel ? <Text style={s.statSub}>{avgLabel}</Text> : null}
            </View>
            {bestMonth && (
              <View style={s.statCard}>
                <Text style={s.statLabel}>BEST MONTH</Text>
                <Text style={s.statValue}>{fmt(bestMonth.amount, symbol)}</Text>
                <Text style={s.statSub}>{bestMonth.name}</Text>
              </View>
            )}
          </View>
        )}

        {/* Monthly breakdown peek */}
        {currentMonths && currentMonths.some((m) => m > 0) && (
          <View style={s.breakdownCard}>
            <Text style={s.breakdownTitle}>This year, by month</Text>
            <View style={s.breakdownGrid}>
              {MONTHS.map((m, i) => {
                const val = currentMonths[i];
                const isEmpty = !val || val === 0;
                return (
                  <View key={m} style={s.breakdownItem}>
                    <Text style={s.breakdownMonth}>{m}</Text>
                    <Text style={[s.breakdownAmount, isEmpty && s.breakdownEmpty]}>
                      {isEmpty ? '—' : fmt(val, symbol)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <Text style={s.footnote}>
          Past years are kept in your Profile under Revenue History.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Monthly editor modal */}
      <Modal visible={editVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={s.overlay}>
            <View style={s.sheet}>
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>{state.currentYearLabel} by month</Text>
                <View style={s.liveTotal}>
                  <Text style={s.liveTotalLabel}>TOTAL</Text>
                  <Text style={s.liveTotalValue}>{fmt(liveTotal, symbol)}</Text>
                </View>
              </View>

              <ScrollView
                style={s.monthList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {MONTHS.map((m, i) => (
                  <View key={m} style={s.monthRow}>
                    <Text style={s.monthLabel}>{m}</Text>
                    <Text style={s.currencyHint}>{symbol.trim()}</Text>
                    <TextInput
                      style={s.monthInput}
                      value={monthInputs[i]}
                      onChangeText={(v) => updateMonth(i, v)}
                      placeholder="0"
                      placeholderTextColor="#333"
                      keyboardType="decimal-pad"
                    />
                  </View>
                ))}
              </ScrollView>

              <View style={s.sheetActions}>
                <TouchableOpacity style={s.btnCancel} onPress={() => setEditVisible(false)}>
                  <Text style={s.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnSave} onPress={saveEdit}>
                  <Text style={s.btnSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroYear: { fontSize: 14, color: '#666', fontWeight: '600', letterSpacing: 1 },
  currentPill: {
    backgroundColor: '#0D1F1A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00C896',
  },
  currentPillText: { fontSize: 9, color: '#00C896', fontWeight: '700', letterSpacing: 1 },

  heroAmount: { fontSize: 44, fontWeight: '700', color: '#FFF', letterSpacing: -1, marginTop: 12 },

  growthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  growthText: { fontSize: 13, fontWeight: '500' },

  heroDivider: { height: 1, backgroundColor: '#1E1E1E', marginVertical: 18 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroFooterLabel: { fontSize: 13, color: '#555' },
  heroFooterValue: { fontSize: 15, fontWeight: '600', color: '#AAA' },

  editHint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 16, justifyContent: 'center' },
  editHintText: { fontSize: 11, color: '#444' },

  // Stats row (monthly avg, best month)
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#151515',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  statLabel: { fontSize: 9, fontWeight: '700', color: '#555', letterSpacing: 1.2, marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  statSub: { fontSize: 11, color: '#444', marginTop: 3 },

  // Monthly breakdown grid
  breakdownCard: {
    backgroundColor: '#151515',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 16,
  },
  breakdownTitle: { fontSize: 12, fontWeight: '600', color: '#BBB', letterSpacing: 0.5, marginBottom: 14 },
  breakdownGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  breakdownItem: { width: '25%', paddingVertical: 8 },
  breakdownMonth: { fontSize: 10, fontWeight: '600', color: '#444', letterSpacing: 1, marginBottom: 3 },
  breakdownAmount: { fontSize: 13, fontWeight: '500', color: '#CCC' },
  breakdownEmpty: { color: '#2A2A2A', fontWeight: '400' },

  footnote: { fontSize: 12, color: '#444', textAlign: 'center', marginTop: 8, lineHeight: 18 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#2C2C2C',
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  liveTotal: { alignItems: 'flex-end' },
  liveTotalLabel: { fontSize: 9, fontWeight: '700', color: '#555', letterSpacing: 1 },
  liveTotalValue: { fontSize: 18, fontWeight: '700', color: '#00C896', marginTop: 2 },

  monthList: { marginBottom: 12 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 10,
  },
  monthLabel: { fontSize: 13, fontWeight: '600', color: '#888', width: 36 },
  currencyHint: { fontSize: 13, color: '#444', width: 24, textAlign: 'right' },
  monthInput: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },

  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#222',
    alignItems: 'center',
  },
  btnCancelText: { fontSize: 15, color: '#666', fontWeight: '500' },
  btnSave: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#00C896',
    alignItems: 'center',
  },
  btnSaveText: { fontSize: 15, color: '#000', fontWeight: '700' },
});
