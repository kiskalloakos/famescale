import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CURRENCIES } from '../../lib/currencies';
import {
  getCurrencyForPage,
  peekCurrencyForPage,
  refreshCurrencyForPage,
} from '../../lib/currency';
import { surface } from '../../lib/surface';
import {
  Account,
  Cost,
  getDashboard,
  peekDashboard,
  refreshDashboard,
  saveCost as persistCost,
  deleteCost as removeCost,
  saveAccount as persistAccount,
  newId,
  currentMonthKey,
} from '../../lib/dashboard';
import { logTransaction } from '../../lib/transactions';
import { showToast } from '../../lib/toast';
import { feedback } from '../../lib/feedback';
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
  const [accounts, setAccounts] = useState<Account[]>(() => peekDashboard().accounts);
  const [trackW, setTrackW] = useState(0);
  const [currency, setCurrency] = useState(() => peekCurrencyForPage('dashboard'));

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getDashboard().then((d) => {
        if (!cancelled) {
          setCosts(d.costs);
          setAccounts(d.accounts);
        }
      });
      refreshDashboard().then((d) => {
        if (!cancelled) {
          setCosts(d.costs);
          setAccounts(d.accounts);
        }
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

  // ── Add / edit / delete ───────────────────────────────────────────────────
  const [costModal, setCostModal] = useState<{ visible: boolean; editing: Cost | null }>({
    visible: false,
    editing: null,
  });
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDueDay, setFormDueDay] = useState('1');

  const openAdd = () => {
    setFormName('');
    setFormAmount('');
    setFormDueDay(String(new Date().getDate()));
    feedback.tap();
    setCostModal({ visible: true, editing: null });
  };

  const openEdit = (cost: Cost) => {
    setFormName(cost.name);
    setFormAmount(cost.amount);
    setFormDueDay(String(cost.dueDay ?? 1));
    feedback.tap();
    setCostModal({ visible: true, editing: cost });
  };

  const saveForm = async () => {
    if (!formName.trim()) return;
    const editing = costModal.editing;
    const dueDay = Math.min(31, Math.max(1, parseInt(formDueDay) || 1));
    const cost: Cost = editing
      ? { ...editing, name: formName.trim(), amount: formAmount, dueDay }
      : {
          id: newId(),
          name: formName.trim(),
          amount: formAmount,
          paid: false,
          position: costs.length,
          dueDay,
          paidFromAccountId: null,
          paidMonth: null,
        };
    setCosts(
      editing ? costs.map((c) => (c.id === editing.id ? cost : c)) : [...costs, cost],
    );
    setCostModal({ visible: false, editing: null });
    feedback.success();
    await persistCost(cost);
  };

  const removeForm = async (cost: Cost) => {
    setCostModal({ visible: false, editing: null });
    setCosts((prev) => prev.filter((c) => c.id !== cost.id));
    feedback.destroy();
    await removeCost(cost.id);
    showToast(`Deleted ${cost.name}`, {
      label: 'Undo',
      onPress: async () => {
        setCosts((prev) => [...prev, cost]);
        await persistCost(cost);
      },
    });
  };

  // ── Pay / unpay ───────────────────────────────────────────────────────────
  const [accountPicker, setAccountPicker] = useState<{ visible: boolean; cost: Cost | null }>({
    visible: false,
    cost: null,
  });

  const tapTickbox = (cost: Cost) => {
    if (cost.paid) {
      // Untick — refund to the account it was paid from (if it still exists).
      const refundTo = cost.paidFromAccountId
        ? accounts.find((a) => a.id === cost.paidFromAccountId)
        : null;
      if (refundTo) {
        const updatedAccount: Account = {
          ...refundTo,
          amount: String(parseAmt(refundTo.amount) + parseAmt(cost.amount)),
        };
        setAccounts(accounts.map((a) => (a.id === updatedAccount.id ? updatedAccount : a)));
        persistAccount(updatedAccount);
        logTransaction({
          accountId: refundTo.id,
          amount: parseAmt(cost.amount),
          direction: 'in',
          kind: 'refund',
          referenceId: cost.id,
          note: cost.name,
        });
      }
      const updated: Cost = { ...cost, paid: false, paidFromAccountId: null, paidMonth: null };
      setCosts(costs.map((c) => (c.id === cost.id ? updated : c)));
      persistCost(updated);
      feedback.select();
      return;
    }
    if (accounts.length === 0) {
      Alert.alert('No accounts', 'Add a cash account first so you can pay this cost.');
      return;
    }
    feedback.tap();
    setAccountPicker({ visible: true, cost });
  };

  const payFromAccount = async (account: Account) => {
    const cost = accountPicker.cost;
    if (!cost) return;
    const updatedAccount: Account = {
      ...account,
      amount: String(parseAmt(account.amount) - parseAmt(cost.amount)),
    };
    const updatedCost: Cost = {
      ...cost,
      paid: true,
      paidFromAccountId: account.id,
      paidMonth: currentMonthKey(),
    };
    setAccounts(accounts.map((a) => (a.id === account.id ? updatedAccount : a)));
    setCosts(costs.map((c) => (c.id === cost.id ? updatedCost : c)));
    setAccountPicker({ visible: false, cost: null });
    feedback.success();
    await Promise.all([
      persistAccount(updatedAccount),
      persistCost(updatedCost),
      logTransaction({
        accountId: account.id,
        amount: parseAmt(cost.amount),
        direction: 'out',
        kind: 'cost',
        referenceId: cost.id,
        note: cost.name,
      }),
    ]);
  };

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
          <View
            style={s.barTrack}
            onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
          >
            <View style={[s.barClip, { width: `${pct * 100}%` }]}>
              <LinearGradient
                colors={['#FFA94D', '#00C896']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: trackW || '100%', height: 6 }}
              />
            </View>
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
            <TouchableOpacity style={s.addBtn} onPress={openAdd}>
              <Ionicons name="add" size={20} color="#00C896" style={glowGreen} />
            </TouchableOpacity>
          </View>

          {sorted.length === 0 ? (
            <TouchableOpacity style={s.empty} onPress={openAdd}>
              <Ionicons name="repeat-outline" size={26} color="#333" />
              <Text style={s.emptyText}>No recurring costs yet</Text>
              <Text style={s.emptyHint}>Tap to add your first recurring cost.</Text>
            </TouchableOpacity>
          ) : (
            sorted.map((c, i) => (
              <Pressable
                key={c.id}
                onPress={() => openEdit(c)}
                style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: '#1A1A1A' }]}
              >
                <Pressable
                  onPress={() => tapTickbox(c)}
                  hitSlop={8}
                  style={[s.statusDot, c.paid ? s.statusPaid : s.statusDue]}
                >
                  <Ionicons
                    name={c.paid ? 'checkmark' : 'time-outline'}
                    size={13}
                    color={c.paid ? '#00C896' : '#FFA94D'}
                  />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowName, c.paid && s.rowNamePaid]}>{c.name}</Text>
                  <Text style={s.rowDue}>Due {ordinal(c.dueDay ?? 1)}</Text>
                </View>
                <Text style={[s.rowAmount, c.paid && s.rowAmountPaid]}>
                  {fmt(parseAmt(c.amount), symbol)}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={costModal.visible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={s.overlay}>
            <View style={s.sheet}>
              <Text style={s.sheetTitle}>
                {costModal.editing ? 'Edit Cost' : 'Add Monthly Cost'}
              </Text>
              <Text style={s.inputLabel}>Name</Text>
              <TextInput
                style={s.input}
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. Netflix"
                placeholderTextColor="#444"
                autoFocus
              />
              <View style={s.row2col}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Amount ({currency})</Text>
                  <TextInput
                    style={s.input}
                    value={formAmount}
                    onChangeText={setFormAmount}
                    placeholder="0.00"
                    placeholderTextColor="#444"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ width: 110 }}>
                  <Text style={s.inputLabel}>Due day</Text>
                  <TextInput
                    style={s.input}
                    value={formDueDay}
                    onChangeText={setFormDueDay}
                    placeholder="15"
                    placeholderTextColor="#444"
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              </View>
              <View style={s.sheetActions}>
                <TouchableOpacity
                  style={s.btnCancel}
                  onPress={() => setCostModal({ visible: false, editing: null })}
                >
                  <Text style={s.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnSave} onPress={saveForm}>
                  <Text style={s.btnSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
              {costModal.editing && (
                <TouchableOpacity
                  style={s.deleteLink}
                  onPress={() => removeForm(costModal.editing!)}
                >
                  <Ionicons name="trash-outline" size={14} color="#FF6B6B" />
                  <Text style={s.deleteLinkText}>Delete cost</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={accountPicker.visible} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>What did you pay with?</Text>
            {accountPicker.cost && (
              <Text style={s.pickerSub}>
                Paying {fmt(parseAmt(accountPicker.cost.amount), symbol)} for{' '}
                <Text style={{ color: '#FFF', fontWeight: '600' }}>
                  {accountPicker.cost.name}
                </Text>
              </Text>
            )}
            <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
              {accounts.map((account, i) => {
                const newBalance = accountPicker.cost
                  ? parseAmt(account.amount) - parseAmt(accountPicker.cost.amount)
                  : parseAmt(account.amount);
                const goesNegative = newBalance < 0;
                return (
                  <TouchableOpacity
                    key={account.id}
                    style={[s.pickerRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#222' }]}
                    onPress={() => payFromAccount(account)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.pickerName}>{account.name}</Text>
                      <Text style={[s.pickerBalance, goesNegative && s.pickerNegative]}>
                        {fmt(parseAmt(account.amount), symbol)} → {fmt(newBalance, symbol)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#444" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={s.btnCancel}
              onPress={() => setAccountPicker({ visible: false, cost: null })}
            >
              <Text style={s.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scroll: { paddingHorizontal: 16, paddingTop: 6 },

  heroCard: { ...surface, borderRadius: 20, padding: 22, marginBottom: 14 },
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
  barClip: { height: 6, borderRadius: 3, overflow: 'hidden' },
  heroSub: { fontSize: 12, color: '#666', marginTop: 10 },

  card: { ...surface, borderRadius: 20, overflow: 'hidden' },
  cardHeader: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#BBB', letterSpacing: 0.5 },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#1F3A30',
  },

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

  // Add / edit cost sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 44,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#2C2C2C',
    maxHeight: '85%',
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', letterSpacing: -0.3, marginBottom: 16 },
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
    fontWeight: '500',
  },
  row2col: { flexDirection: 'row', gap: 12 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#222',
    alignItems: 'center',
    marginTop: 8,
  },
  btnCancelText: { fontSize: 15, color: '#666', fontWeight: '500' },
  btnSave: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#00C896',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#00C896',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
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

  pickerSub: { fontSize: 13, color: '#666', marginBottom: 18, lineHeight: 18, fontWeight: '500' },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  pickerName: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  pickerBalance: { fontSize: 12, color: '#555', marginTop: 3, fontWeight: '500', fontVariant: ['tabular-nums'] },
  pickerNegative: { color: '#FFA94D' },
});
