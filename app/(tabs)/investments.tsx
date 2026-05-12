import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { INVESTMENTS_KEY, CURRENCY_KEY } from '../../constants/storage';

const STORAGE_KEY = INVESTMENTS_KEY;

interface InvestmentData {
  totalInvested: string;
  startMonth: string;
  startYear: string;
  annualReturn: string;
}

const CURRENCIES = [
  { code: 'RON', symbol: 'lei ' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'HUF', symbol: 'Ft ' },
  { code: 'CHF', symbol: 'Fr ' },
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthsSinceStart(year: number, month: number): number {
  const now = new Date();
  const diff = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month) + 1;
  return Math.max(1, diff);
}

function fv(pv: number, pmt: number, annualRate: number, months: number): number {
  const r = annualRate / 100 / 12;
  if (r === 0) return pv + pmt * months;
  return pv * Math.pow(1 + r, months) + pmt * ((Math.pow(1 + r, months) - 1) / r);
}

function fmt(value: number, symbol: string): string {
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtFull(value: number, symbol: string): string {
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Investments() {
  const [data, setData] = useState<InvestmentData>({
    totalInvested: '',
    startMonth: String(new Date().getMonth() + 1),
    startYear: String(new Date().getFullYear()),
    annualReturn: '7',
  });
  const [currency, setCurrency] = useState('RON');
  const [configExpanded, setConfigExpanded] = useState(false);
  const [yearlyExpanded, setYearlyExpanded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) setData(JSON.parse(data));
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(CURRENCY_KEY).then((val) => {
        if (val) setCurrency(val);
      });
    }, []),
  );

  const persist = useCallback((d: InvestmentData) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  }, []);

  const update = (field: keyof InvestmentData, value: string) => {
    const updated = { ...data, [field]: value };
    setData(updated);
    persist(updated);
  };

  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency + ' ';
  const pv = parseFloat(data.totalInvested) || 0;
  const sy = parseInt(data.startYear) || new Date().getFullYear();
  const sm = parseInt(data.startMonth) || 1;
  const months = monthsSinceStart(sy, sm);
  const pmt = pv > 0 ? pv / months : 0;
  const rate = parseFloat(data.annualReturn) || 0;

  const val1y = fv(pv, pmt, rate, 12);
  const val5y = fv(pv, pmt, rate, 60);
  const val10y = fv(pv, pmt, rate, 120);

  const yearlyRows = Array.from({ length: 10 }, (_, i) => {
    const startBal = fv(pv, pmt, rate, i * 12);
    const endBal = fv(pv, pmt, rate, (i + 1) * 12);
    const interest = endBal - startBal - pmt * 12;
    return { year: i + 1, startBal, endBal, interest };
  });

  const startLabel = `${MONTH_LABELS[sm - 1]} ${sy}`;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>INVESTMENTS</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Main input card */}
        <View style={s.card}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitle}>Portfolio</Text>
          </View>

          {/* Total invested — primary input */}
          <Text style={s.label}>TOTAL CURRENTLY INVESTED</Text>
          <TextInput
            style={s.input}
            value={data.totalInvested}
            onChangeText={(v) => update('totalInvested', v)}
            placeholder="0.00"
            placeholderTextColor="#444"
            keyboardType="decimal-pad"
          />
          {pv > 0 && (
            <Text style={s.subHint}>
              avg {fmtFull(pmt, symbol)} / month since {startLabel}
            </Text>
          )}

          {/* Configure — collapsible */}
          <TouchableOpacity
            style={s.configRow}
            onPress={() => setConfigExpanded(!configExpanded)}
            activeOpacity={0.7}
          >
            <Text style={s.configLabel}>Configure</Text>
            <View style={s.configRight}>
              {!configExpanded && (
                <Text style={s.configSummary}>
                  {startLabel} · {data.annualReturn || '7'}%
                </Text>
              )}
              <Ionicons
                name={configExpanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color="#444"
                style={{ marginLeft: 6 }}
              />
            </View>
          </TouchableOpacity>

          {configExpanded && (
            <View style={s.configBody}>
              <Text style={s.label}>STARTED INVESTING</Text>
              <View style={s.monthGrid}>
                {MONTH_LABELS.map((m, i) => {
                  const active = data.startMonth === String(i + 1);
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[s.monthBtn, active && s.monthBtnActive]}
                      onPress={() => update('startMonth', String(i + 1))}
                    >
                      <Text style={[s.monthBtnText, active && s.monthBtnTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                style={[s.input, { marginTop: 10 }]}
                value={data.startYear}
                onChangeText={(v) => update('startYear', v)}
                placeholder="2025"
                placeholderTextColor="#444"
                keyboardType="number-pad"
                maxLength={4}
              />

              <Text style={s.label}>EXPECTED ANNUAL RETURN (%)</Text>
              <TextInput
                style={s.input}
                value={data.annualReturn}
                onChangeText={(v) => update('annualReturn', v)}
                placeholder="7"
                placeholderTextColor="#444"
                keyboardType="decimal-pad"
              />
              <Text style={s.hint}>7% is recommended for most stock market investments</Text>
            </View>
          )}
        </View>

        {/* 1yr / 5yr / 10yr */}
        {pv > 0 && (
          <>
            <View style={s.projRow}>
              {[
                { label: '1 YEAR', value: val1y },
                { label: '5 YEARS', value: val5y },
                { label: '10 YEARS', value: val10y },
              ].map(({ label, value }) => (
                <View key={label} style={s.projCard}>
                  <Text style={s.projLabel}>{label}</Text>
                  <Text style={s.projValue}>{fmt(value, symbol)}</Text>
                  <Text style={s.projGain}>+{fmt(value - pv, symbol)}</Text>
                </View>
              ))}
            </View>

            {/* Yearly breakdown */}
            <View style={s.card}>
              <TouchableOpacity
                style={s.collapseHeader}
                onPress={() => setYearlyExpanded(!yearlyExpanded)}
                activeOpacity={0.7}
              >
                <Text style={s.cardTitle}>Yearly Breakdown</Text>
                <Ionicons
                  name={yearlyExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#555"
                />
              </TouchableOpacity>

              {yearlyExpanded && (
                <>
                  <View style={[s.tableRow, s.tableHeaderRow]}>
                    <Text style={[s.tableCell, s.tableHeaderText, s.cellYear]}>YR</Text>
                    <Text style={[s.tableCell, s.tableHeaderText]}>START</Text>
                    <Text style={[s.tableCell, s.tableHeaderText]}>INTEREST</Text>
                    <Text style={[s.tableCell, s.tableHeaderText]}>END</Text>
                  </View>
                  {yearlyRows.map((row) => (
                    <View key={row.year} style={s.tableRow}>
                      <Text style={[s.tableCell, s.cellYear, s.yearNum]}>{row.year}</Text>
                      <Text style={[s.tableCell, s.dimText]}>{fmt(row.startBal, symbol)}</Text>
                      <Text style={[s.tableCell, s.greenText]}>+{fmt(Math.max(0, row.interest), symbol)}</Text>
                      <Text style={[s.tableCell, s.boldText]}>{fmt(row.endBal, symbol)}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#FFF', letterSpacing: 3 },

  scroll: { paddingHorizontal: 16 },

  card: {
    backgroundColor: '#151515',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
  },
  cardHeaderRow: { padding: 18, paddingBottom: 14 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#BBB', letterSpacing: 0.5 },

  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#555',
    letterSpacing: 1.2,
    marginBottom: 8,
    paddingHorizontal: 18,
  },
  input: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#FFF',
    marginBottom: 8,
    marginHorizontal: 18,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  subHint: {
    fontSize: 11,
    color: '#444',
    marginHorizontal: 18,
    marginBottom: 4,
  },
  hint: {
    fontSize: 11,
    color: '#444',
    marginHorizontal: 18,
    marginTop: 0,
    marginBottom: 16,
  },

  // Configure collapsible
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
  },
  configLabel: { fontSize: 12, color: '#3A3A3A', fontWeight: '500' },
  configRight: { flexDirection: 'row', alignItems: 'center' },
  configSummary: { fontSize: 11, color: '#3A3A3A' },
  configBody: { paddingTop: 12 },

  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    gap: 6,
    marginBottom: 4,
  },
  monthBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  monthBtnActive: { backgroundColor: '#00C896', borderColor: '#00C896' },
  monthBtnText: { fontSize: 12, color: '#666', fontWeight: '500' },
  monthBtnTextActive: { color: '#000', fontWeight: '700' },

  // Projection cards
  projRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  projCard: {
    flex: 1,
    backgroundColor: '#151515',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
  },
  projLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 1,
    marginBottom: 8,
  },
  projValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  projGain: { fontSize: 11, color: '#00C896', fontWeight: '500' },

  // Yearly breakdown
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
  },
  tableHeaderRow: {
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
    backgroundColor: '#111',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
  },
  tableCell: { flex: 1, fontSize: 12, color: '#888', textAlign: 'right' },
  tableHeaderText: { fontSize: 9, fontWeight: '700', color: '#444', letterSpacing: 0.8 },
  cellYear: { flex: 0.4, textAlign: 'left' },
  yearNum: { fontSize: 13, fontWeight: '600', color: '#666' },
  dimText: { color: '#666' },
  greenText: { color: '#00C896', fontWeight: '500' },
  boldText: { color: '#EEE', fontWeight: '600' },
});
