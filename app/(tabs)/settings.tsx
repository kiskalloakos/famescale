import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { CURRENCY_KEY } from '../../constants/storage';
import { SETUP_KEY, SetupData } from '../../components/OnboardingFlow';
import {
  RevenueState,
  RevenueEntry,
  getRevenue,
  saveRevenue,
  sortEntries,
} from '../../lib/revenue';

const CURRENCIES = [
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
];

function reloadPage() {
  if (Platform.OS === 'web') (window as any).location.reload();
}

function fmt(value: number, symbol: string): string {
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function Settings() {
  const [currency, setCurrency] = useState('RON');
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [revenue, setRevenueState] = useState<RevenueState | null>(null);

  const [currencyModal, setCurrencyModal] = useState(false);
  const [entryModal, setEntryModal] = useState<{ visible: boolean; editing: RevenueEntry | null }>({
    visible: false,
    editing: null,
  });
  const [formLabel, setFormLabel] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrent, setFormCurrent] = useState(false);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(CURRENCY_KEY).then((val) => {
        if (val) setCurrency(val);
      });
      AsyncStorage.getItem(SETUP_KEY).then((val) => {
        if (val) setSetup(JSON.parse(val));
      });
      getRevenue().then(setRevenueState);
    }, []),
  );

  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;

  const changeCurrency = async (code: string) => {
    setCurrency(code);
    await AsyncStorage.setItem(CURRENCY_KEY, code);
    setCurrencyModal(false);
  };

  // ── Revenue entry CRUD ──────────────────────────────────────────────────
  const openAddEntry = () => {
    setFormLabel('');
    setFormAmount('');
    setFormCurrent(false);
    setEntryModal({ visible: true, editing: null });
  };

  const openEditEntry = (entry: RevenueEntry) => {
    setFormLabel(entry.label);
    setFormAmount(String(entry.amount));
    setFormCurrent(revenue?.currentYearLabel === entry.label);
    setEntryModal({ visible: true, editing: entry });
  };

  const saveEntry = async () => {
    if (!revenue || !formLabel.trim()) return;
    const label = formLabel.trim();
    const amount = parseFloat(formAmount) || 0;
    const wasEditing = entryModal.editing;
    const oldLabel = wasEditing?.label;

    let entries: RevenueEntry[];
    if (wasEditing) {
      entries = revenue.entries.map((e) => {
        if (e.label !== oldLabel) return e;
        // Preserve monthly breakdown if the amount is unchanged (just a rename).
        // Otherwise this is a lump-sum override — drop the monthly data.
        if (e.amount === amount && e.months) return { ...e, label };
        return { label, amount };
      });
    } else {
      if (revenue.entries.some((e) => e.label === label)) {
        Alert.alert('Year already exists', `An entry for "${label}" already exists. Tap it to edit.`);
        return;
      }
      entries = [...revenue.entries, { label, amount }];
    }

    let currentYearLabel = revenue.currentYearLabel;
    if (formCurrent) currentYearLabel = label;
    else if (wasEditing && oldLabel === currentYearLabel && oldLabel !== label) {
      // user renamed the current entry → follow the rename
      currentYearLabel = label;
    }

    const updated: RevenueState = { currentYearLabel, entries };
    setRevenueState(updated);
    await saveRevenue(updated);
    setEntryModal({ visible: false, editing: null });
  };

  const deleteEntry = (entry: RevenueEntry) => {
    if (!revenue) return;
    if (revenue.entries.length === 1) {
      Alert.alert('Cannot delete', 'You need at least one revenue entry.');
      return;
    }
    Alert.alert('Delete entry', `Remove revenue for "${entry.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const entries = revenue.entries.filter((e) => e.label !== entry.label);
          let currentYearLabel = revenue.currentYearLabel;
          if (entry.label === currentYearLabel) {
            // pick the latest remaining as new current
            currentYearLabel = sortEntries(entries)[0]?.label ?? String(new Date().getFullYear());
          }
          const updated: RevenueState = { currentYearLabel, entries };
          setRevenueState(updated);
          await saveRevenue(updated);
        },
      },
    ]);
  };

  // ── Dev actions ─────────────────────────────────────────────────────────
  const resetOnboarding = () => {
    Alert.alert('Reset Onboarding', 'Clears your setup preferences and restarts onboarding on reload.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(SETUP_KEY);
          reloadPage();
        },
      },
    ]);
  };

  const clearAllData = () => {
    Alert.alert('Clear All Data', 'Deletes everything — accounts, costs, investments, revenue, and settings. Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear Everything',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.clear();
          reloadPage();
        },
      },
    ]);
  };

  const selectedCurrency = CURRENCIES.find((c) => c.code === currency);
  const sortedRevenue = revenue ? sortEntries(revenue.entries) : [];

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>SETTINGS</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Profile */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Ionicons name="person" size={32} color="#00C896" />
          </View>
          <Text style={s.profileName}>Your Profile</Text>
          <Text style={s.profileSub}>joo · personal finance</Text>
        </View>

        {/* Preferences */}
        <Text style={s.sectionLabel}>PREFERENCES</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.row} onPress={() => setCurrencyModal(true)}>
            <View style={s.rowIcon}>
              <Ionicons name="cash-outline" size={16} color="#555" />
            </View>
            <Text style={s.rowLabel}>Currency</Text>
            <View style={s.rowRight}>
              <Text style={s.rowValue}>{selectedCurrency?.symbol}  {selectedCurrency?.code}</Text>
              <Ionicons name="chevron-forward" size={14} color="#333" style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Revenue History — only when revenue tracking is on */}
        {setup?.showRevenue && revenue && (
          <>
            <Text style={s.sectionLabel}>REVENUE HISTORY</Text>
            <View style={s.card}>
              {sortedRevenue.map((entry, i) => {
                const isCurrent = entry.label === revenue.currentYearLabel;
                return (
                  <TouchableOpacity
                    key={entry.label}
                    style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: '#1C1C1C' }]}
                    onPress={() => openEditEntry(entry)}
                    onLongPress={() => deleteEntry(entry)}
                  >
                    <View style={s.rowIcon}>
                      <Ionicons
                        name={isCurrent ? 'radio-button-on' : 'calendar-outline'}
                        size={16}
                        color={isCurrent ? '#00C896' : '#555'}
                      />
                    </View>
                    <Text style={[s.rowLabel, isCurrent && { color: '#00C896', fontWeight: '600' }]}>
                      {entry.label}
                      {isCurrent && <Text style={s.currentTag}>  · current</Text>}
                    </Text>
                    <Text style={s.rowValue}>{fmt(entry.amount, symbol + ' ')}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[s.row, s.addRow]}
                onPress={openAddEntry}
              >
                <View style={s.rowIcon}>
                  <Ionicons name="add-circle-outline" size={16} color="#00C896" />
                </View>
                <Text style={[s.rowLabel, { color: '#00C896' }]}>Add Year</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* About */}
        <Text style={s.sectionLabel}>ABOUT</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowIcon}>
              <Ionicons name="information-circle-outline" size={16} color="#555" />
            </View>
            <Text style={s.rowLabel}>Version</Text>
            <Text style={s.rowValue}>1.0.0</Text>
          </View>
          <View style={[s.row, { borderTopWidth: 1, borderTopColor: '#1C1C1C' }]}>
            <View style={s.rowIcon}>
              <Ionicons name="code-slash-outline" size={16} color="#555" />
            </View>
            <Text style={s.rowLabel}>Built with</Text>
            <Text style={s.rowValue}>Expo · React Native</Text>
          </View>
        </View>

        {/* Dev Tools */}
        <Text style={s.sectionLabel}>DEVELOPER TOOLS</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.row} onPress={resetOnboarding}>
            <View style={s.rowIcon}>
              <Ionicons name="refresh-outline" size={16} color="#F59E0B" />
            </View>
            <Text style={[s.rowLabel, s.warnText]}>Reset Onboarding</Text>
            <Ionicons name="chevron-forward" size={14} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.row, { borderTopWidth: 1, borderTopColor: '#1C1C1C' }]}
            onPress={clearAllData}
          >
            <View style={s.rowIcon}>
              <Ionicons name="trash-outline" size={16} color="#FF4C4C" />
            </View>
            <Text style={[s.rowLabel, s.dangerText]}>Clear All Data</Text>
            <Ionicons name="chevron-forward" size={14} color="#333" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Currency modal */}
      <Modal visible={currencyModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Select Currency</Text>
            {CURRENCIES.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={[s.currencyRow, currency === c.code && s.currencyRowActive]}
                onPress={() => changeCurrency(c.code)}
              >
                <Text style={s.currencySymbol}>{c.symbol}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.currencyCode}>{c.code}</Text>
                  <Text style={s.currencyName}>{c.name}</Text>
                </View>
                {currency === c.code && <Ionicons name="checkmark-circle" size={20} color="#00C896" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.closeBtn} onPress={() => setCurrencyModal(false)}>
              <Text style={s.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Revenue entry modal */}
      <Modal visible={entryModal.visible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.overlay}>
            <View style={s.sheet}>
              <Text style={s.sheetTitle}>
                {entryModal.editing ? 'Edit Revenue Entry' : 'Add Revenue Year'}
              </Text>
              <Text style={s.inputLabel}>Year or period</Text>
              <TextInput
                style={s.input}
                value={formLabel}
                onChangeText={setFormLabel}
                placeholder="e.g. 2025 or 2020-2022"
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

  profileCard: {
    backgroundColor: '#151515',
    borderRadius: 20,
    padding: 28,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0D1F1A',
    borderWidth: 2,
    borderColor: '#00C896',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  profileName: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 4 },
  profileSub: { fontSize: 12, color: '#444' },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#444',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginLeft: 4,
  },

  card: {
    backgroundColor: '#151515',
    borderRadius: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  addRow: { borderTopWidth: 1, borderTopColor: '#1C1C1C' },
  rowIcon: { width: 24, alignItems: 'center' },
  rowLabel: { flex: 1, fontSize: 14, color: '#CCC', fontWeight: '400' },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 13, color: '#555' },
  currentTag: { fontSize: 11, color: '#3A6A5A', fontWeight: '400' },
  warnText: { color: '#F59E0B' },
  dangerText: { color: '#FF4C4C' },

  // Sheets
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 44,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#2C2C2C',
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 20 },
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

  // Currency picker
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  currencyRowActive: { backgroundColor: '#222' },
  currencySymbol: { fontSize: 18, color: '#FFF', width: 28, textAlign: 'center' },
  currencyCode: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  currencyName: { fontSize: 12, color: '#555', marginTop: 1 },
  closeBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#222',
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 15, color: '#666', fontWeight: '500' },
});
