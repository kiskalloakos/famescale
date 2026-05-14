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
  currentMonthKey,
} from '../../lib/dashboard';
import { showToast } from '../../lib/toast';
import { useDragReorder } from '../../lib/useDragReorder';
import DraggableRow from '../../components/DraggableRow';
import SortableScroll from '../../components/SortableScroll';
import { NestableDraggableFlatList, RenderItemParams } from 'react-native-draggable-flatlist';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthName(key: string): string {
  const m = parseInt(key.split('-')[1], 10) - 1;
  return MONTH_NAMES[m] ?? key;
}

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

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [currency, setCurrency] = useState('RON');
  const [costsExpanded, setCostsExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [accountModal, setAccountModal] = useState<{ visible: boolean; editing: Account | null }>({
    visible: false,
    editing: null,
  });
  const [costModal, setCostModal] = useState<{ visible: boolean; editing: Cost | null }>({
    visible: false,
    editing: null,
  });
  const [accountPicker, setAccountPicker] = useState<{ visible: boolean; cost: Cost | null }>({
    visible: false,
    cost: null,
  });
  const [moneyModal, setMoneyModal] = useState<{ visible: boolean; mode: 'add' | 'remove' }>({
    visible: false,
    mode: 'add',
  });
  const [moneyAmount, setMoneyAmount] = useState('');

  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDueDay, setFormDueDay] = useState('1');

  const closeMoneyModal = useCallback(() => {
    setMoneyModal((prev) => ({ ...prev, visible: false }));
  }, []);

  // ── Auto-reset paid costs that were paid in a previous month ──────────────
  const applyDashboard = useCallback(async (d: ReturnType<typeof getDashboard> extends Promise<infer T> ? T : never) => {
    const month = currentMonthKey();
    const reset: Cost[] = [];
    const next: Cost[] = d.costs.map((c) => {
      if (c.paid && c.paidMonth && c.paidMonth !== month) {
        const cleared: Cost = { ...c, paid: false, paidFromAccountId: null, paidMonth: null };
        reset.push(cleared);
        return cleared;
      }
      return c;
    });
    setAccounts(d.accounts);
    setCosts(next);
    if (reset.length > 0) {
      // Persist resets to Supabase (no refund — payment already happened)
      for (const c of reset) {
        await persistCost(c);
      }
      showToast(
        `Reset ${reset.length} ${reset.length === 1 ? 'cost' : 'costs'} for ${monthName(month)} — last month's payments stayed deducted.`,
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getDashboard().then((d) => {
        if (!cancelled) applyDashboard(d);
      });
      refreshDashboard().then((d) => {
        if (!cancelled) applyDashboard(d);
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
    }, [applyDashboard]),
  );

  // ── Math ──────────────────────────────────────────────────────────────────
  const totalLiquid = accounts.reduce((s, a) => s + parseAmt(a.amount), 0);
  const unpaidCosts = costs.reduce((s, c) => (c.paid ? s : s + parseAmt(c.amount)), 0);
  const afterPayments = totalLiquid - unpaidCosts;
  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency + ' ';

  // ── Accounts ──────────────────────────────────────────────────────────────
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

  // ── Drag-to-reorder ───────────────────────────────────────────────────────
  const reorderAccounts = useCallback(async (next: Account[]) => {
    const repositioned = next.map((a, i) => ({ ...a, position: i }));
    setAccounts((prev) => {
      // Persist any row whose position actually changed
      for (const a of repositioned) {
        const orig = prev.find((p) => p.id === a.id);
        if (orig && orig.position !== a.position) persistAccount(a);
      }
      return repositioned;
    });
  }, []);

  const reorderCosts = useCallback(async (next: Cost[]) => {
    const repositioned = next.map((c, i) => ({ ...c, position: i }));
    setCosts((prev) => {
      for (const c of repositioned) {
        const orig = prev.find((p) => p.id === c.id);
        if (orig && orig.position !== c.position) persistCost(c);
      }
      return repositioned;
    });
  }, []);

  const accountDrag = useDragReorder(accounts, reorderAccounts);
  const costDrag = useDragReorder(costs, reorderCosts);

  // ── Native renderers for NestableDraggableFlatList ────────────────────────
  const renderAccountItem = useCallback(
    ({ item: account, drag, isActive }: RenderItemParams<Account>) => (
      <View style={[s.row, isActive && s.rowDragging]}>
        {editMode && accounts.length > 1 && (
          <TouchableOpacity
            onLongPress={drag}
            delayLongPress={120}
            style={s.dragHandle}
          >
            <Ionicons name="reorder-three-outline" size={18} color="#444" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={s.rowBody}
          onPress={editMode ? () => openEditAccount(account) : undefined}
          activeOpacity={editMode ? 0.2 : 1}
        >
          <Text style={s.rowLabel}>{account.name}</Text>
          <View style={s.rowRight}>
            <Text style={s.rowValue}>{fmt(parseAmt(account.amount), symbol)}</Text>
            {editMode && (
              <Ionicons name="pencil-outline" size={13} color="#444" style={{ marginLeft: 8 }} />
            )}
          </View>
        </TouchableOpacity>
      </View>
    ),
    [accounts.length, symbol, editMode],
  );

  const renderCostItem = useCallback(
    ({ item: cost, drag, isActive }: RenderItemParams<Cost>) => {
      const paidFromAccount = cost.paidFromAccountId
        ? accounts.find((a) => a.id === cost.paidFromAccountId)
        : null;
      return (
        <View style={[s.costRow, isActive && s.rowDragging]}>
          {editMode && costs.length > 1 && (
            <TouchableOpacity onLongPress={drag} delayLongPress={120} style={s.dragHandle}>
              <Ionicons name="reorder-three-outline" size={18} color="#444" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => tapTickbox(cost)} style={s.checkbox}>
            <Ionicons
              name={cost.paid ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={cost.paid ? '#00C896' : '#3A3A3A'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.costBody}
            onPress={editMode ? () => openEditCost(cost) : undefined}
            activeOpacity={editMode ? 0.2 : 1}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, cost.paid && s.strikethrough]}>{cost.name}</Text>
              <Text style={s.costMeta}>
                {cost.paid && paidFromAccount
                  ? `paid from ${paidFromAccount.name}`
                  : cost.paid
                    ? 'paid'
                    : `due ${ordinal(cost.dueDay)}`}
              </Text>
            </View>
            <Text style={s.rowValue}>{fmt(parseAmt(cost.amount), symbol)}</Text>
            {editMode && (
              <Ionicons name="pencil-outline" size={13} color="#444" style={{ marginLeft: 8 }} />
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [accounts, costs.length, symbol, editMode],
  );

  const deleteAccount = async (account: Account) => {
    setAccountModal({ visible: false, editing: null });
    setAccounts((prev) => prev.filter((a) => a.id !== account.id));
    await removeAccount(account.id);
    showToast(`Deleted ${account.name}`, {
      label: 'Undo',
      onPress: async () => {
        setAccounts((prev) => [...prev, account]);
        await persistAccount(account);
      },
    });
  };

  // ── Costs ─────────────────────────────────────────────────────────────────
  const openAddCost = () => {
    setFormName('');
    setFormAmount('');
    setFormDueDay(String(new Date().getDate()));
    setCostModal({ visible: true, editing: null });
  };

  const openEditCost = (cost: Cost) => {
    setFormName(cost.name);
    setFormAmount(cost.amount);
    setFormDueDay(String(cost.dueDay));
    setCostModal({ visible: true, editing: cost });
  };

  const saveCost = async () => {
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
    setCosts(editing ? costs.map((c) => (c.id === editing.id ? cost : c)) : [...costs, cost]);
    setCostModal({ visible: false, editing: null });
    await persistCost(cost);
  };

  const deleteCost = async (cost: Cost) => {
    setCostModal({ visible: false, editing: null });
    setCosts((prev) => prev.filter((c) => c.id !== cost.id));
    await removeCost(cost.id);
    showToast(`Deleted ${cost.name}`, {
      label: 'Undo',
      onPress: async () => {
        setCosts((prev) => [...prev, cost]);
        await persistCost(cost);
      },
    });
  };

  // ── Add / Remove money flow ───────────────────────────────────────────────
  const openMoneyFlow = (mode: 'add' | 'remove') => {
    if (accounts.length === 0) {
      Alert.alert('No accounts', 'Add a cash account first.');
      return;
    }
    setMoneyAmount('');
    setMoneyModal({ visible: true, mode });
  };

  const commitMoney = async (account: Account) => {
    const amount = parseAmt(moneyAmount);
    if (amount <= 0) return;
    const delta = moneyModal.mode === 'add' ? amount : -amount;
    const updated: Account = {
      ...account,
      amount: String(parseAmt(account.amount) + delta),
    };
    setAccounts(accounts.map((a) => (a.id === account.id ? updated : a)));
    setMoneyModal({ visible: false, mode: moneyModal.mode });
    await persistAccount(updated);
  };

  // ── Pay / unpay flow ──────────────────────────────────────────────────────
  const tapTickbox = (cost: Cost) => {
    if (cost.paid) {
      // Untick — refund the amount to the account it was paid from (if it still exists)
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
      }
      const updated: Cost = { ...cost, paid: false, paidFromAccountId: null, paidMonth: null };
      setCosts(costs.map((c) => (c.id === cost.id ? updated : c)));
      persistCost(updated);
      return;
    }
    // Not paid yet — ask which account to pay with
    if (accounts.length === 0) {
      Alert.alert('No accounts', 'Add a cash account first so you can pay this cost.');
      return;
    }
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
    await Promise.all([persistAccount(updatedAccount), persistCost(updatedCost)]);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>DASHBOARD</Text>
        <View style={s.headerActions}>
          <TouchableOpacity
            style={[s.headerEditBtn, editMode && s.headerEditBtnActive]}
            onPress={() => setEditMode((e) => !e)}
          >
            <Ionicons
              name="pencil-outline"
              size={15}
              color={editMode ? '#00C896' : '#777'}
            />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerRemoveBtn} onPress={() => openMoneyFlow('remove')}>
            <Ionicons name="remove" size={20} color="#FF6B6B" />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerAddBtn} onPress={() => openMoneyFlow('add')}>
            <Ionicons name="add" size={20} color="#00C896" />
          </TouchableOpacity>
        </View>
      </View>

      <SortableScroll contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.heroCard}>
          <Text style={s.heroLabel}>AFTER MONTHLY PAYMENTS</Text>
          <Text style={s.heroAmount}>{fmt(afterPayments, symbol)}</Text>
          <View style={s.heroDivider} />
          <View style={s.heroRow}>
            <Text style={s.heroSubLabel}>Current liquidity</Text>
            <Text style={s.heroSubValue}>{fmt(totalLiquid, symbol)}</Text>
          </View>
        </View>

        {/* Accounts */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Cash Accounts</Text>
          </View>

          {accounts.length === 0 ? (
            <TouchableOpacity style={s.empty} onPress={openAddAccount}>
              <Ionicons name="wallet-outline" size={26} color="#333" />
              <Text style={s.emptyText}>Add your first account</Text>
            </TouchableOpacity>
          ) : (
            <>
              {Platform.OS === 'web' ? (
                accounts.map((account) => {
                  const d = accountDrag(account.id);
                  return (
                    <DraggableRow
                      key={account.id}
                      handlers={{ ...d, draggable: d.draggable && editMode && accounts.length > 1 }}
                      style={[
                        s.row,
                        d.isDragging && s.rowDragging,
                        d.isHovered && s.rowDropTarget,
                      ]}
                    >
                      {editMode && accounts.length > 1 && (
                        <View style={s.dragHandle}>
                          <Ionicons name="reorder-three-outline" size={18} color="#444" />
                        </View>
                      )}
                      <TouchableOpacity
                        style={s.rowBody}
                        onPress={editMode ? () => openEditAccount(account) : undefined}
                        activeOpacity={editMode ? 0.2 : 1}
                      >
                        <Text style={s.rowLabel}>{account.name}</Text>
                        <View style={s.rowRight}>
                          <Text style={s.rowValue}>{fmt(parseAmt(account.amount), symbol)}</Text>
                          {editMode && (
                            <Ionicons name="pencil-outline" size={13} color="#444" style={{ marginLeft: 8 }} />
                          )}
                        </View>
                      </TouchableOpacity>
                    </DraggableRow>
                  );
                })
              ) : (
                <NestableDraggableFlatList
                  data={accounts}
                  keyExtractor={(a) => a.id}
                  renderItem={renderAccountItem}
                  onDragEnd={({ data }) => reorderAccounts(data)}
                  activationDistance={5}
                />
              )}
              <TouchableOpacity style={s.addCostRow} onPress={openAddAccount}>
                <Ionicons name="add-circle-outline" size={16} color="#00C896" />
                <Text style={s.addCostText}>Add Account</Text>
              </TouchableOpacity>
            </>
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
              <Text style={s.cardSubtitle}>
                {fmt(unpaidCosts, symbol)} unpaid · {fmt(costs.reduce((s, c) => s + parseAmt(c.amount), 0), symbol)} total
              </Text>
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
              ) : Platform.OS === 'web' ? (
                costs.map((cost) => {
                  const paidFromAccount = cost.paidFromAccountId
                    ? accounts.find((a) => a.id === cost.paidFromAccountId)
                    : null;
                  const d = costDrag(cost.id);
                  return (
                    <DraggableRow
                      key={cost.id}
                      handlers={{ ...d, draggable: d.draggable && editMode && costs.length > 1 }}
                      style={[
                        s.costRow,
                        d.isDragging && s.rowDragging,
                        d.isHovered && s.rowDropTarget,
                      ]}
                    >
                      {editMode && costs.length > 1 && Platform.OS === 'web' && (
                        <View style={s.dragHandle}>
                          <Ionicons name="reorder-three-outline" size={18} color="#444" />
                        </View>
                      )}
                      <TouchableOpacity onPress={() => tapTickbox(cost)} style={s.checkbox}>
                        <Ionicons
                          name={cost.paid ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={cost.paid ? '#00C896' : '#3A3A3A'}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.costBody}
                        onPress={editMode ? () => openEditCost(cost) : undefined}
                        activeOpacity={editMode ? 0.2 : 1}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[s.rowLabel, cost.paid && s.strikethrough]}>{cost.name}</Text>
                          <Text style={s.costMeta}>
                            {cost.paid && paidFromAccount
                              ? `paid from ${paidFromAccount.name}`
                              : cost.paid
                                ? 'paid'
                                : `due ${ordinal(cost.dueDay)}`}
                          </Text>
                        </View>
                        <Text style={s.rowValue}>{fmt(parseAmt(cost.amount), symbol)}</Text>
                        {editMode && (
                          <Ionicons name="pencil-outline" size={13} color="#444" style={{ marginLeft: 8 }} />
                        )}
                      </TouchableOpacity>
                    </DraggableRow>
                  );
                })
              ) : (
                <NestableDraggableFlatList
                  data={costs}
                  keyExtractor={(c) => c.id}
                  renderItem={renderCostItem}
                  onDragEnd={({ data }) => reorderCosts(data)}
                  activationDistance={5}
                />
              )}
              <TouchableOpacity style={s.addCostRow} onPress={openAddCost}>
                <Ionicons name="add-circle-outline" size={16} color="#00C896" />
                <Text style={s.addCostText}>Add Cost</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </SortableScroll>

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
              {accountModal.editing && (
                <TouchableOpacity
                  style={s.deleteLink}
                  onPress={() => deleteAccount(accountModal.editing!)}
                >
                  <Ionicons name="trash-outline" size={14} color="#FF6B6B" />
                  <Text style={s.deleteLinkText}>Delete account</Text>
                </TouchableOpacity>
              )}
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
                <TouchableOpacity style={s.btnSave} onPress={saveCost}>
                  <Text style={s.btnSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
              {costModal.editing && (
                <TouchableOpacity
                  style={s.deleteLink}
                  onPress={() => deleteCost(costModal.editing!)}
                >
                  <Ionicons name="trash-outline" size={14} color="#FF6B6B" />
                  <Text style={s.deleteLinkText}>Delete cost</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add / remove money sheet */}
      <Modal visible={moneyModal.visible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.overlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={closeMoneyModal}
            />
            <View style={s.sheet}>
              <View style={s.dragHandleBar} />
              <View style={s.sheetHeaderRow}>
                <Text style={[s.sheetTitle, { marginBottom: 0 }]}>
                  {moneyModal.mode === 'add' ? 'Add money' : 'Remove money'}
                </Text>
                <TouchableOpacity style={s.closeIconBtn} onPress={closeMoneyModal}>
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
              <Text style={s.inputLabel}>Amount ({currency})</Text>
              <TextInput
                style={s.input}
                value={moneyAmount}
                onChangeText={setMoneyAmount}
                placeholder="0.00"
                placeholderTextColor="#444"
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={s.pickerSub}>
                {parseAmt(moneyAmount) > 0
                  ? moneyModal.mode === 'add'
                    ? 'Tap an account to add this to it.'
                    : 'Tap an account to remove from.'
                  : 'Enter an amount, then pick an account.'}
              </Text>
              <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
                {accounts.map((account, i) => {
                  const amount = parseAmt(moneyAmount);
                  const delta = moneyModal.mode === 'add' ? amount : -amount;
                  const newBalance = parseAmt(account.amount) + delta;
                  const goesNegative = newBalance < 0;
                  const disabled = amount <= 0;
                  const isAdd = moneyModal.mode === 'add';
                  return (
                    <TouchableOpacity
                      key={account.id}
                      style={[
                        s.pickerRow,
                        i > 0 && { borderTopWidth: 1, borderTopColor: '#222' },
                        disabled && { opacity: 0.4 },
                      ]}
                      onPress={() => commitMoney(account)}
                      disabled={disabled}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.pickerName}>{account.name}</Text>
                        <Text style={[s.pickerBalance, goesNegative && s.pickerNegative]}>
                          {fmt(parseAmt(account.amount), symbol)} → {fmt(newBalance, symbol)}
                        </Text>
                      </View>
                      <Ionicons
                        name={isAdd ? 'add-circle-outline' : 'remove-circle-outline'}
                        size={18}
                        color={isAdd ? '#00C896' : '#FF6B6B'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Account picker — "what did you pay with?" */}
      <Modal visible={accountPicker.visible} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>What did you pay with?</Text>
            {accountPicker.cost && (
              <Text style={s.pickerSub}>
                Paying {fmt(parseAmt(accountPicker.cost.amount), symbol)} for{' '}
                <Text style={{ color: '#FFF', fontWeight: '600' }}>{accountPicker.cost.name}</Text>
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#FFF', letterSpacing: 3 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0D1F1A',
    borderWidth: 1,
    borderColor: '#1F3A30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00C896',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRemoveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1F0D0D',
    borderWidth: 1,
    borderColor: '#3A1818',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEditBtnActive: {
    backgroundColor: '#0D1F1A',
    borderColor: '#1F3A30',
    shadowColor: '#00C896',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
  },
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
  heroDivider: { height: 1, backgroundColor: '#1E1E1E', marginVertical: 18 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroSubLabel: { fontSize: 13, color: '#555', fontWeight: '500' },
  heroSubValue: { fontSize: 17, fontWeight: '700', color: '#AAA', fontVariant: ['tabular-nums'] },

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
  cardSubtitle: { fontSize: 12, color: '#555', marginTop: 3, fontWeight: '500', fontVariant: ['tabular-nums'] },
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
    paddingLeft: 8,
    paddingRight: 18,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 18,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
    gap: 8,
  },
  costBody: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  dragHandle: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore — web-only cursor hint
    cursor: 'grab',
  },
  rowDragging: { opacity: 0.35 },
  rowDropTarget: { borderTopWidth: 2, borderTopColor: '#00C896' },
  rowLabel: { flex: 1, fontSize: 15, color: '#EEE', fontWeight: '500' },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 14, color: '#888', fontWeight: '500', fontVariant: ['tabular-nums'] },
  costMeta: { fontSize: 11, color: '#555', marginTop: 2, fontWeight: '500' },
  checkbox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  strikethrough: { color: '#444', textDecorationLine: 'line-through' },
  empty: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
  },
  emptyText: { fontSize: 13, color: '#3A3A3A', fontWeight: '500' },
  addCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
  },
  addCostText: { fontSize: 14, color: '#00C896', fontWeight: '500' },

  // Sheets
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 44,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#2C2C2C',
    maxHeight: '85%',
  },
  dragHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
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
    shadowColor: '#00C896',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 6,
  },
  btnSaveText: { fontSize: 15, color: '#000', fontWeight: '700' },

  // Delete link inside edit modals
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 8,
  },
  deleteLinkText: { fontSize: 13, color: '#FF6B6B', fontWeight: '500' },

  // Picker
  pickerSub: { fontSize: 13, color: '#666', marginBottom: 18, lineHeight: 18, fontWeight: '500' },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  pickerName: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  pickerBalance: { fontSize: 12, color: '#555', marginTop: 3, fontWeight: '500', fontVariant: ['tabular-nums'] },
  pickerNegative: { color: '#FF6B6B' },
});
