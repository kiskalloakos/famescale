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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrencyForPage, refreshCurrencyForPage } from '../../lib/currency';
import {
  Account,
  Cost,
  getDashboard,
  refreshDashboard,
  saveAccount as persistAccount,
  deleteAccount as removeAccount,
  saveCost as persistCost,
  deleteCost as removeCost,
  newId,
} from '../../lib/dashboard';

const CURRENCIES = [
  { code: 'RON', symbol: 'lei ' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'HUF', symbol: 'Ft ' },
  { code: 'CHF', symbol: 'Fr ' },
];

function fmt(value: number, symbol: string): string {
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseAmt(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [currency, setCurrency] = useState('RON');
  const [costsExpanded, setCostsExpanded] = useState(false);

  const [accountModal, setAccountModal] = useState<{ visible: boolean; editing: Account | null }>({
    visible: false,
    editing: null,
  });
  const [costModal, setCostModal] = useState<{ visible: boolean; editing: Cost | null }>({
    visible: false,
    editing: null,
  });

  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // Cache first (instant), then remote refresh.
      getDashboard().then((d) => {
        if (cancelled) return;
        setAccounts(d.accounts);
        setCosts(d.costs);
      });
      refreshDashboard().then((d) => {
        if (cancelled) return;
        setAccounts(d.accounts);
        setCosts(d.costs);
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

  const totalLiquid = accounts.reduce((s, a) => s + parseAmt(a.amount), 0);
  const totalCosts = costs.reduce((s, c) => s + parseAmt(c.amount), 0);
  const remaining = totalLiquid - totalCosts;
  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency + ' ';

  // --- Accounts ---
  const openAddAccount = () => {
    setFormName('');
    setFormAmount('');
    setAccountModal({ visible: true, editing: null });
  };

  const openEditAccount = (account: Account) => {
    setFormName(account.name);
    setFormAmount(account.amount);
    setAccountModal({ visible: true, editing: account });
  };

  const saveAccount = async () => {
    if (!formName.trim()) return;
    const editing = accountModal.editing;
    const account: Account = editing
      ? { ...editing, name: formName.trim(), amount: formAmount }
      : {
          id: newId(),
          name: formName.trim(),
          amount: formAmount,
          position: accounts.length,
        };
    setAccounts(
      editing ? accounts.map((a) => (a.id === editing.id ? account : a)) : [...accounts, account],
    );
    setAccountModal({ visible: false, editing: null });
    await persistAccount(account);
  };

  const deleteAccount = (id: string) => {
    Alert.alert('Delete Account', 'Remove this account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setAccounts(accounts.filter((a) => a.id !== id));
          await removeAccount(id);
        },
      },
    ]);
  };

  // --- Costs ---
  const openAddCost = () => {
    setFormName('');
    setFormAmount('');
    setCostModal({ visible: true, editing: null });
  };

  const openEditCost = (cost: Cost) => {
    setFormName(cost.name);
    setFormAmount(cost.amount);
    setCostModal({ visible: true, editing: cost });
  };

  const saveCost = async () => {
    if (!formName.trim()) return;
    const editing = costModal.editing;
    const cost: Cost = editing
      ? { ...editing, name: formName.trim(), amount: formAmount }
      : {
          id: newId(),
          name: formName.trim(),
          amount: formAmount,
          paid: false,
          position: costs.length,
        };
    setCosts(
      editing ? costs.map((c) => (c.id === editing.id ? cost : c)) : [...costs, cost],
    );
    setCostModal({ visible: false, editing: null });
    await persistCost(cost);
  };

  const togglePaid = async (id: string) => {
    const target = costs.find((c) => c.id === id);
    if (!target) return;
    const updated: Cost = { ...target, paid: !target.paid };
    setCosts(costs.map((c) => (c.id === id ? updated : c)));
    await persistCost(updated);
  };

  const deleteCost = (id: string) => {
    Alert.alert('Delete Cost', 'Remove this cost?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setCosts(costs.filter((c) => c.id !== id));
          await removeCost(id);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>DASHBOARD</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero card */}
        <View style={s.heroCard}>
          <Text style={s.heroLabel}>TOTAL LIQUID CASH</Text>
          <Text style={s.heroAmount}>{fmt(totalLiquid, symbol)}</Text>
          <View style={s.heroDivider} />
          <View style={s.heroRow}>
            <Text style={s.heroSubLabel}>After monthly costs</Text>
            <Text style={[s.heroSubValue, remaining < 0 && s.negative]}>
              {fmt(remaining, symbol)}
            </Text>
          </View>
        </View>

        {/* Accounts */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Cash Accounts</Text>
            <TouchableOpacity style={s.iconBtn} onPress={openAddAccount}>
              <Ionicons name="add" size={18} color="#00C896" />
            </TouchableOpacity>
          </View>

          {accounts.length === 0 ? (
            <TouchableOpacity style={s.empty} onPress={openAddAccount}>
              <Ionicons name="wallet-outline" size={26} color="#333" />
              <Text style={s.emptyText}>Add your first account</Text>
            </TouchableOpacity>
          ) : (
            accounts.map((account) => (
              <TouchableOpacity
                key={account.id}
                style={s.row}
                onPress={() => openEditAccount(account)}
                onLongPress={() => deleteAccount(account.id)}
              >
                <Text style={s.rowLabel}>{account.name}</Text>
                <View style={s.rowRight}>
                  <Text style={s.rowValue}>{fmt(parseAmt(account.amount), symbol)}</Text>
                  <Ionicons name="pencil-outline" size={13} color="#444" style={{ marginLeft: 8 }} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Monthly Costs */}
        <View style={s.card}>
          <TouchableOpacity
            style={s.cardHeader}
            onPress={() => setCostsExpanded(!costsExpanded)}
            activeOpacity={0.7}
          >
            <View>
              <Text style={s.cardTitle}>Monthly Costs</Text>
              <Text style={s.cardSubtitle}>{fmt(totalCosts, symbol)}</Text>
            </View>
            <Ionicons
              name={costsExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#555"
            />
          </TouchableOpacity>

          {costsExpanded && (
            <>
              {costs.length === 0 ? (
                <TouchableOpacity style={s.empty} onPress={openAddCost}>
                  <Ionicons name="receipt-outline" size={26} color="#333" />
                  <Text style={s.emptyText}>Add a monthly cost</Text>
                </TouchableOpacity>
              ) : (
                costs.map((cost) => (
                  <TouchableOpacity
                    key={cost.id}
                    style={s.row}
                    onPress={() => openEditCost(cost)}
                    onLongPress={() => deleteCost(cost.id)}
                  >
                    <TouchableOpacity onPress={() => togglePaid(cost.id)} style={s.checkbox}>
                      <Ionicons
                        name={cost.paid ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={cost.paid ? '#00C896' : '#3A3A3A'}
                      />
                    </TouchableOpacity>
                    <Text style={[s.rowLabel, cost.paid && s.strikethrough]}>{cost.name}</Text>
                    <Text style={s.rowValue}>{fmt(parseAmt(cost.amount), symbol)}</Text>
                  </TouchableOpacity>
                ))
              )}
              <TouchableOpacity style={s.addCostRow} onPress={openAddCost}>
                <Ionicons name="add-circle-outline" size={16} color="#00C896" />
                <Text style={s.addCostText}>Add Cost</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Account Modal */}
      <Modal visible={accountModal.visible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.overlay}>
            <View style={s.sheet}>
              <Text style={s.sheetTitle}>
                {accountModal.editing ? 'Edit Account' : 'Add Account'}
              </Text>
              <Text style={s.inputLabel}>Account Name</Text>
              <TextInput
                style={s.input}
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. Revolut"
                placeholderTextColor="#444"
                autoFocus
              />
              <Text style={s.inputLabel}>Amount ({currency})</Text>
              <TextInput
                style={s.input}
                value={formAmount}
                onChangeText={setFormAmount}
                placeholder="0.00"
                placeholderTextColor="#444"
                keyboardType="decimal-pad"
              />
              <View style={s.sheetActions}>
                <TouchableOpacity
                  style={s.btnCancel}
                  onPress={() => setAccountModal({ visible: false, editing: null })}
                >
                  <Text style={s.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnSave} onPress={saveAccount}>
                  <Text style={s.btnSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Cost Modal */}
      <Modal visible={costModal.visible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
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
              <Text style={s.inputLabel}>Monthly Amount ({currency})</Text>
              <TextInput
                style={s.input}
                value={formAmount}
                onChangeText={setFormAmount}
                placeholder="0.00"
                placeholderTextColor="#444"
                keyboardType="decimal-pad"
              />
              <View style={s.sheetActions}>
                <TouchableOpacity
                  style={s.btnCancel}
                  onPress={() => setCostModal({ visible: false, editing: null })}
                >
                  <Text style={s.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnSave} onPress={saveCost}>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
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
  heroAmount: { fontSize: 38, fontWeight: '700', color: '#FFF', letterSpacing: -1 },
  heroDivider: { height: 1, backgroundColor: '#1E1E1E', marginVertical: 18 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroSubLabel: { fontSize: 13, color: '#555' },
  heroSubValue: { fontSize: 17, fontWeight: '600', color: '#00C896' },
  negative: { color: '#FF4C4C' },
  card: {
    backgroundColor: '#151515',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#BBB', letterSpacing: 0.5 },
  cardSubtitle: { fontSize: 12, color: '#555', marginTop: 3 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
  },
  rowLabel: { flex: 1, fontSize: 15, color: '#EEE', fontWeight: '400' },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 14, color: '#888' },
  checkbox: { marginRight: 12 },
  strikethrough: { color: '#444', textDecorationLine: 'line-through' },
  empty: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
  },
  emptyText: { fontSize: 13, color: '#3A3A3A' },
  addCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
  },
  addCostText: { fontSize: 14, color: '#00C896', fontWeight: '500' },
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
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 24 },
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
