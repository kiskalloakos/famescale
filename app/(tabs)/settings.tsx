import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SetupData, getSetup, refreshSetup } from '../../lib/setup';
import {
  PageKey,
  getCurrencySettings,
  refreshCurrencySettings,
  saveGlobalCurrency,
  saveOverrideCurrency,
} from '../../lib/currency';
import { remove as removeStored } from '../../lib/storage';
import { supabase } from '../../lib/supabase';

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

export default function Settings() {
  const [currency, setCurrency] = useState('RON');
  const [overrides, setOverrides] = useState<Partial<Record<PageKey, string>>>({});
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [currencyModal, setCurrencyModal] = useState(false);
  const [perPageModal, setPerPageModal] = useState(false);
  const [pagePicker, setPagePicker] = useState<{ visible: boolean; page: PageKey | null }>({
    visible: false,
    page: null,
  });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getCurrencySettings().then((s) => {
        if (cancelled) return;
        setCurrency(s.global);
        setOverrides(s.overrides);
      });
      getSetup().then((v) => {
        if (!cancelled && v) setSetup(v);
      });
      supabase.auth.getUser().then(({ data }) => {
        if (!cancelled) setEmail(data.user?.email ?? null);
      });
      refreshCurrencySettings().then((s) => {
        if (cancelled) return;
        setCurrency(s.global);
        setOverrides(s.overrides);
      });
      refreshSetup().then((v) => {
        if (!cancelled && v) setSetup(v);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Sign-out failed', error.message);
    }
    // On success, RootLayout's auth listener routes to AuthScreen.
  };

  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;

  const changeCurrency = async (code: string) => {
    setCurrency(code);
    await saveGlobalCurrency(code);
    setCurrencyModal(false);
  };

  const changeOverride = async (page: PageKey, code: string | null) => {
    if (code === null) {
      const next = { ...overrides };
      delete next[page];
      setOverrides(next);
    } else {
      setOverrides({ ...overrides, [page]: code });
    }
    await saveOverrideCurrency(page, code);
    setPagePicker({ visible: false, page: null });
  };

  // ── Dev actions ─────────────────────────────────────────────────────────
  const resetOnboarding = () => {
    Alert.alert('Reset Onboarding', 'Clears your setup preferences and restarts onboarding on reload.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await removeStored('setup');
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
          <Text style={s.profileName}>{email ?? 'Your Profile'}</Text>
          <Text style={s.profileSub}>joo · personal finance</Text>
          <TouchableOpacity style={s.signOutBtn} onPress={signOut}>
            <Ionicons name="log-out-outline" size={14} color="#FF6B6B" />
            <Text style={s.signOutText}>Sign Out</Text>
          </TouchableOpacity>
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
          <TouchableOpacity style={[s.row, s.subtleRow]} onPress={() => setPerPageModal(true)}>
            <View style={s.rowIcon} />
            <Text style={s.subtleLabel}>Customize per page</Text>
            {Object.keys(overrides).length > 0 && (
              <Text style={s.overrideBadge}>
                {Object.keys(overrides).length} override{Object.keys(overrides).length === 1 ? '' : 's'}
              </Text>
            )}
            <Ionicons name="chevron-forward" size={13} color="#2A2A2A" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>

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

      {/* Per-page currency modal */}
      <Modal visible={perPageModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Currency per page</Text>
            <Text style={s.sheetSub}>
              Pick a different currency for any page. Default is the global currency.
            </Text>

            {(() => {
              const pages: { key: PageKey; label: string }[] = [
                { key: 'dashboard', label: 'Dashboard' },
                { key: 'investments', label: setup?.investmentTabName ?? 'Investments' },
              ];
              if (setup?.showRevenue !== false) {
                pages.push({ key: 'revenue', label: 'Revenue' });
              }
              return pages.map((p, i) => {
                const override = overrides[p.key];
                const effective = override ?? currency;
                const symbolFor = CURRENCIES.find((c) => c.code === effective)?.symbol ?? effective;
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[s.pageRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#222' }]}
                    onPress={() => setPagePicker({ visible: true, page: p.key })}
                  >
                    <Text style={s.pageRowLabel}>{p.label}</Text>
                    <View style={s.pageRowRight}>
                      <Text style={[s.pageRowValue, override ? s.pageRowOverride : null]}>
                        {symbolFor} {effective}
                      </Text>
                      <Text style={s.pageRowHint}>
                        {override ? 'override' : 'global'}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color="#333" />
                    </View>
                  </TouchableOpacity>
                );
              });
            })()}

            <TouchableOpacity style={[s.closeBtn, { marginTop: 16 }]} onPress={() => setPerPageModal(false)}>
              <Text style={s.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Page-specific currency picker (with "Use global" option) */}
      <Modal visible={pagePicker.visible} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>
              {pagePicker.page
                ? `Currency · ${
                    pagePicker.page === 'investments'
                      ? setup?.investmentTabName ?? 'Investments'
                      : pagePicker.page.charAt(0).toUpperCase() + pagePicker.page.slice(1)
                  }`
                : 'Currency'}
            </Text>

            {/* Use global option */}
            <TouchableOpacity
              style={[s.currencyRow, !pagePicker.page || !overrides[pagePicker.page] ? s.currencyRowActive : null]}
              onPress={() => pagePicker.page && changeOverride(pagePicker.page, null)}
            >
              <Ionicons name="globe-outline" size={20} color="#888" style={{ width: 28, textAlign: 'center' }} />
              <View style={{ flex: 1 }}>
                <Text style={s.currencyCode}>Use global</Text>
                <Text style={s.currencyName}>Currently {currency}</Text>
              </View>
              {pagePicker.page && !overrides[pagePicker.page] && (
                <Ionicons name="checkmark-circle" size={20} color="#00C896" />
              )}
            </TouchableOpacity>

            <View style={s.divider} />

            {CURRENCIES.map((c) => {
              const isSelected = pagePicker.page && overrides[pagePicker.page] === c.code;
              return (
                <TouchableOpacity
                  key={c.code}
                  style={[s.currencyRow, isSelected && s.currencyRowActive]}
                  onPress={() => pagePicker.page && changeOverride(pagePicker.page, c.code)}
                >
                  <Text style={s.currencySymbol}>{c.symbol}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.currencyCode}>{c.code}</Text>
                    <Text style={s.currencyName}>{c.name}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color="#00C896" />}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[s.closeBtn, { marginTop: 12 }]}
              onPress={() => setPagePicker({ visible: false, page: null })}
            >
              <Text style={s.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  profileName: { fontSize: 16, fontWeight: '600', color: '#FFF', marginBottom: 4 },
  profileSub: { fontSize: 12, color: '#444', marginBottom: 16 },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3A1818',
    backgroundColor: '#1F0D0D',
  },
  signOutText: { fontSize: 12, color: '#FF6B6B', fontWeight: '600' },

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

  // Subtle "Customize per page" row inside the currency card
  subtleRow: {
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
    paddingVertical: 11,
  },
  subtleLabel: { flex: 1, fontSize: 12, color: '#555', fontWeight: '400' },
  overrideBadge: {
    fontSize: 10,
    color: '#00C896',
    fontWeight: '600',
    backgroundColor: '#0D1F1A',
    borderWidth: 1,
    borderColor: '#1A3A2F',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    letterSpacing: 0.3,
  },

  // Per-page picker rows
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  pageRowLabel: { flex: 1, fontSize: 15, color: '#EEE', fontWeight: '500' },
  pageRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageRowValue: { fontSize: 14, color: '#888', fontWeight: '500' },
  pageRowOverride: { color: '#00C896' },
  pageRowHint: { fontSize: 10, color: '#444', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: '#222', marginVertical: 8 },

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
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 10 },
  sheetSub: { fontSize: 13, color: '#555', marginBottom: 18, lineHeight: 18 },
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
