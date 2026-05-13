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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrencyForPage, refreshCurrencyForPage } from '../../lib/currency';
import {
  RevenueState,
  RevenueEntry,
  getRevenue,
  refreshRevenue,
  saveRevenue,
  sortEntries,
  allTimeTotal,
  previousEntry,
  activeMonthCount,
} from '../../lib/revenue';
import { newId } from '../../lib/dashboard';
import { showToast } from '../../lib/toast';

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

  // Past-year entry modal (add/edit a year)
  const [entryModal, setEntryModal] = useState<{ visible: boolean; editing: RevenueEntry | null }>({
    visible: false,
    editing: null,
  });
  const [formLabel, setFormLabel] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrent, setFormCurrent] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getRevenue().then((v) => {
        if (!cancelled) setState(v);
      });
      refreshRevenue().then((v) => {
        if (!cancelled) setState(v);
      });
      getCurrencyForPage('revenue').then((c) => {
        if (!cancelled) setCurrency(c);
      });
      refreshCurrencyForPage('revenue').then((c) => {
        if (!cancelled) setCurrency(c);
      });
      return () => {
        cancelled = true;
      };
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

  // ── Past-year CRUD ───────────────────────────────────────────────────────
  const openAddEntry = () => {
    setFormLabel('');
    setFormAmount('');
    setFormCurrent(false);
    setEntryModal({ visible: true, editing: null });
  };

  const openEditEntry = (entry: RevenueEntry) => {
    setFormLabel(entry.label);
    setFormAmount(String(entry.amount));
    setFormCurrent(state.currentYearLabel === entry.label);
    setEntryModal({ visible: true, editing: entry });
  };

  const saveEntry = async () => {
    if (!formLabel.trim()) return;
    const label = formLabel.trim();
    const amount = parseFloat(formAmount) || 0;
    const wasEditing = entryModal.editing;
    const oldLabel = wasEditing?.label;

    let entries: RevenueEntry[];
    if (wasEditing) {
      entries = state.entries.map((e) => {
        if (e.label !== oldLabel) return e;
        // Preserve months only if amount is unchanged (rename); else lump-sum override.
        if (e.amount === amount && e.months) return { ...e, label };
        return { ...e, label, amount, months: undefined };
      });
    } else {
      if (state.entries.some((e) => e.label === label)) {
        Alert.alert('Year already exists', `An entry for "${label}" already exists. Tap it to edit.`);
        return;
      }
      entries = [...state.entries, { id: newId(), label, amount }];
    }

    let currentYearLabel = state.currentYearLabel;
    if (formCurrent) currentYearLabel = label;
    else if (wasEditing && oldLabel === currentYearLabel && oldLabel !== label) {
      currentYearLabel = label;
    }

    const updated: RevenueState = { currentYearLabel, entries };
    setState(updated);
    await saveRevenue(updated);
    setEntryModal({ visible: false, editing: null });
  };

  const deleteEntry = async (entry: RevenueEntry) => {
    if (state.entries.length === 1) {
      Alert.alert('Cannot delete', 'You need at least one revenue entry.');
      return;
    }
    setEntryModal({ visible: false, editing: null });
    const before = state;
    const entries = state.entries.filter((e) => e.id !== entry.id);
    let currentYearLabel = state.currentYearLabel;
    if (entry.label === currentYearLabel) {
      currentYearLabel = sortEntries(entries)[0]?.label ?? String(new Date().getFullYear());
    }
    const updated: RevenueState = { currentYearLabel, entries };
    setState(updated);
    await saveRevenue(updated);
    showToast(`Deleted ${entry.label}`, {
      label: 'Undo',
      onPress: async () => {
        setState(before);
        await saveRevenue(before);
      },
    });
  };

  const sortedEntries = sortEntries(state.entries);

  // New-year reminder: current label's year is behind the calendar year.
  const calYear = new Date().getFullYear();
  const labelYear = parseInt(state.currentYearLabel, 10);
  const showNewYearBanner =
    !isNaN(labelYear) &&
    labelYear < calYear &&
    !state.entries.some((e) => e.label === String(calYear)) &&
    !bannerDismissed;

  const addNewYearEntry = async () => {
    const label = String(calYear);
    const entry: RevenueEntry = { id: newId(), label, amount: 0 };
    const updated: RevenueState = {
      currentYearLabel: label,
      entries: [...state.entries, entry],
    };
    setState(updated);
    await saveRevenue(updated);
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>REVENUE</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* New-year reminder banner */}
        {showNewYearBanner && (
          <View style={s.banner}>
            <Ionicons name="alarm-outline" size={18} color="#00C896" />
            <View style={{ flex: 1 }}>
              <Text style={s.bannerTitle}>It's {calYear}</Text>
              <Text style={s.bannerSub}>
                Don't forget to reset — add a new year to track this year's revenue.
              </Text>
            </View>
            <TouchableOpacity style={s.bannerBtn} onPress={addNewYearEntry}>
              <Text style={s.bannerBtnText}>Add {calYear}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.bannerClose} onPress={() => setBannerDismissed(true)}>
              <Ionicons name="close" size={14} color="#555" />
            </TouchableOpacity>
          </View>
        )}

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

        {/* Revenue History */}
        <View style={s.historyCard}>
          <View style={s.historyHeader}>
            <Text style={s.historyTitle}>Revenue History</Text>
            <TouchableOpacity style={s.historyAddBtn} onPress={openAddEntry}>
              <Ionicons name="add" size={16} color="#00C896" />
            </TouchableOpacity>
          </View>
          {sortedEntries.map((entry, i) => {
            const isCurrent = entry.label === state.currentYearLabel;
            return (
              <TouchableOpacity
                key={entry.id}
                style={[s.historyRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#1C1C1C' }]}
                onPress={() => openEditEntry(entry)}
              >
                <View style={s.historyDot}>
                  <Ionicons
                    name={isCurrent ? 'radio-button-on' : 'ellipse-outline'}
                    size={14}
                    color={isCurrent ? '#00C896' : '#333'}
                  />
                </View>
                <Text style={[s.historyLabel, isCurrent && s.historyLabelActive]}>
                  {entry.label}
                  {isCurrent && <Text style={s.historyCurrentTag}>  · current</Text>}
                </Text>
                <Text style={s.historyAmount}>{fmt(entry.amount, symbol)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

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

      {/* Past-year entry modal (add or edit a year) */}
      <Modal visible={entryModal.visible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={s.overlay}>
            <View style={s.sheet}>
              <Text style={s.sheetTitle}>
                {entryModal.editing ? 'Edit Revenue Year' : 'Add Revenue Year'}
              </Text>
              <Text style={s.inputLabel}>Year or period</Text>
              <TextInput
                style={s.input}
                value={formLabel}
                onChangeText={setFormLabel}
                placeholder="e.g. 2024 or 2020-2022"
                placeholderTextColor="#444"
                autoFocus
              />
              <Text style={s.inputLabel}>Total revenue ({currency})</Text>
              <TextInput
                style={s.input}
                value={formAmount}
                onChangeText={setFormAmount}
                placeholder="0"
                placeholderTextColor="#444"
                keyboardType="decimal-pad"
              />

              <TouchableOpacity
                style={s.toggleRow}
                onPress={() => setFormCurrent(!formCurrent)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={formCurrent ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={formCurrent ? '#00C896' : '#3A3A3A'}
                />
                <Text style={s.toggleText}>Set as current year</Text>
              </TouchableOpacity>

              <View style={s.sheetActions}>
                <TouchableOpacity
                  style={s.btnCancel}
                  onPress={() => setEntryModal({ visible: false, editing: null })}
                >
                  <Text style={s.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnSave} onPress={saveEntry}>
                  <Text style={s.btnSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
              {entryModal.editing && state.entries.length > 1 && (
                <TouchableOpacity
                  style={s.deleteLink}
                  onPress={() => deleteEntry(entryModal.editing!)}
                >
                  <Ionicons name="trash-outline" size={14} color="#FF6B6B" />
                  <Text style={s.deleteLinkText}>Delete year</Text>
                </TouchableOpacity>
              )}
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

  // New-year reminder banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0F1A17',
    borderColor: '#1F3A30',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  bannerTitle: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  bannerSub: { fontSize: 11, color: '#555', marginTop: 2, lineHeight: 14 },
  bannerBtn: {
    backgroundColor: '#00C896',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  bannerBtnText: { fontSize: 12, fontWeight: '700', color: '#000' },
  bannerClose: { padding: 4 },

  // Revenue history card
  historyCard: {
    backgroundColor: '#151515',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 16,
    overflow: 'hidden',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  historyTitle: { fontSize: 13, fontWeight: '600', color: '#BBB', letterSpacing: 0.5 },
  historyAddBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 10,
  },
  historyDot: { width: 18, alignItems: 'center' },
  historyLabel: { flex: 1, fontSize: 14, color: '#CCC', fontWeight: '500' },
  historyLabelActive: { color: '#00C896', fontWeight: '600' },
  historyCurrentTag: { fontSize: 11, color: '#3A6A5A', fontWeight: '400' },
  historyAmount: { fontSize: 14, color: '#888' },

  // Entry modal extras
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#222',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFF',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  toggleText: { fontSize: 14, color: '#CCC' },

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

  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 8,
  },
  deleteLinkText: { fontSize: 13, color: '#FF6B6B', fontWeight: '500' },
});
