import React, { useCallback, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { getCurrencyForPage, refreshCurrencyForPage } from '../../lib/currency';
import { Debt, getDebts, refreshDebts, saveDebt, deleteDebt } from '../../lib/debts';
import { newId } from '../../lib/dashboard';
import { showToast } from '../../lib/toast';
import { useDragReorder } from '../../lib/useDragReorder';
import DraggableRow from '../../components/DraggableRow';
import SortableScroll from '../../components/SortableScroll';
import { NestableDraggableFlatList, RenderItemParams } from 'react-native-draggable-flatlist';

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

export default function Debts() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [currency, setCurrency] = useState('RON');

  const [modal, setModal] = useState<{ visible: boolean; editing: Debt | null }>({
    visible: false,
    editing: null,
  });
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getDebts().then((d) => {
        if (!cancelled) setDebts(d);
      });
      refreshDebts().then((d) => {
        if (!cancelled) setDebts(d);
      });
      getCurrencyForPage('debts').then((c) => {
        if (!cancelled) setCurrency(c);
      });
      refreshCurrencyForPage('debts').then((c) => {
        if (!cancelled) setCurrency(c);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency + ' ';
  const total = debts.reduce((s, d) => s + parseAmt(d.amount), 0);

  const openAdd = () => {
    setFormName('');
    setFormAmount('');
    setFormNotes('');
    setModal({ visible: true, editing: null });
  };

  const openEdit = (debt: Debt) => {
    setFormName(debt.name);
    setFormAmount(debt.amount);
    setFormNotes(debt.notes ?? '');
    setModal({ visible: true, editing: debt });
  };

  const saveForm = async () => {
    if (!formName.trim()) return;
    const editing = modal.editing;
    const debt: Debt = editing
      ? { ...editing, name: formName.trim(), amount: formAmount, notes: formNotes.trim() || null }
      : {
          id: newId(),
          name: formName.trim(),
          amount: formAmount,
          notes: formNotes.trim() || null,
          position: debts.length,
        };
    setDebts(editing ? debts.map((d) => (d.id === editing.id ? debt : d)) : [...debts, debt]);
    setModal({ visible: false, editing: null });
    await saveDebt(debt);
  };

  const reorderDebts = useCallback(async (next: Debt[]) => {
    const repositioned = next.map((d, i) => ({ ...d, position: i }));
    setDebts((prev) => {
      for (const d of repositioned) {
        const orig = prev.find((p) => p.id === d.id);
        if (orig && orig.position !== d.position) saveDebt(d);
      }
      return repositioned;
    });
  }, []);

  const debtDrag = useDragReorder(debts, reorderDebts);

  const renderDebtItem = useCallback(
    ({ item: debt, drag, isActive }: RenderItemParams<Debt>) => (
      <View style={[s.row, isActive && s.rowDragging]}>
        {debts.length > 1 && (
          <TouchableOpacity onLongPress={drag} delayLongPress={120} style={s.dragHandle}>
            <Ionicons name="reorder-three-outline" size={18} color="#444" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.rowBody} onPress={() => openEdit(debt)}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>{debt.name}</Text>
            {debt.notes ? <Text style={s.rowMeta}>{debt.notes}</Text> : null}
          </View>
          <Text style={s.rowValue}>{fmt(parseAmt(debt.amount), symbol)}</Text>
          <Ionicons name="pencil-outline" size={13} color="#444" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    ),
    [debts.length, symbol],
  );

  const removeFromModal = async () => {
    if (!modal.editing) return;
    const debt = modal.editing;
    setModal({ visible: false, editing: null });
    setDebts((prev) => prev.filter((d) => d.id !== debt.id));
    await deleteDebt(debt.id);
    showToast(`Deleted ${debt.name}`, {
      label: 'Undo',
      onPress: async () => {
        setDebts((prev) => [...prev, debt]);
        await saveDebt(debt);
      },
    });
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>DEBTS</Text>
      </View>

      <SortableScroll contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero — total owed */}
        <View style={s.heroCard}>
          <Text style={s.heroLabel}>TOTAL OWED</Text>
          <Text style={s.heroAmount}>{fmt(total, symbol)}</Text>
          {debts.length > 0 && (
            <>
              <View style={s.heroDivider} />
              <View style={s.heroRow}>
                <Text style={s.heroSubLabel}>Across {debts.length} {debts.length === 1 ? 'debt' : 'debts'}</Text>
              </View>
            </>
          )}
        </View>

        {/* Debts list */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Outstanding</Text>
          </View>

          {debts.length === 0 ? (
            <TouchableOpacity style={s.empty} onPress={openAdd}>
              <Ionicons name="document-text-outline" size={26} color="#333" />
              <Text style={s.emptyText}>Add your first debt</Text>
            </TouchableOpacity>
          ) : (
            <>
              {Platform.OS === 'web' ? (
                debts.map((debt) => {
                  const d = debtDrag(debt.id);
                  return (
                    <DraggableRow
                      key={debt.id}
                      handlers={{ ...d, draggable: d.draggable && debts.length > 1 }}
                      style={[s.row, d.isDragging && s.rowDragging, d.isHovered && s.rowDropTarget]}
                    >
                      {debts.length > 1 && (
                        <View style={s.dragHandle}>
                          <Ionicons name="reorder-three-outline" size={18} color="#444" />
                        </View>
                      )}
                      <TouchableOpacity style={s.rowBody} onPress={() => openEdit(debt)}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.rowLabel}>{debt.name}</Text>
                          {debt.notes ? <Text style={s.rowMeta}>{debt.notes}</Text> : null}
                        </View>
                        <Text style={s.rowValue}>{fmt(parseAmt(debt.amount), symbol)}</Text>
                        <Ionicons name="pencil-outline" size={13} color="#444" style={{ marginLeft: 8 }} />
                      </TouchableOpacity>
                    </DraggableRow>
                  );
                })
              ) : (
                <NestableDraggableFlatList
                  data={debts}
                  keyExtractor={(d) => d.id}
                  renderItem={renderDebtItem}
                  onDragEnd={({ data }) => reorderDebts(data)}
                  activationDistance={5}
                />
              )}
              <TouchableOpacity style={s.addRow} onPress={openAdd}>
                <Ionicons name="add-circle-outline" size={16} color="#00C896" />
                <Text style={s.addRowText}>Add Debt</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </SortableScroll>

      {/* Add / edit modal */}
      <Modal visible={modal.visible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.overlay}>
            <View style={s.sheet}>
              <Text style={s.sheetTitle}>{modal.editing ? 'Edit debt' : 'Add debt'}</Text>
              <Text style={s.inputLabel}>Who do you owe?</Text>
              <TextInput
                style={s.input}
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. Mom, Visa card, Mortgage"
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
              <Text style={s.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={s.input}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="e.g. due Dec 2026, 6% interest"
                placeholderTextColor="#444"
              />

              <View style={s.sheetActions}>
                <TouchableOpacity
                  style={s.btnCancel}
                  onPress={() => setModal({ visible: false, editing: null })}
                >
                  <Text style={s.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnSave} onPress={saveForm}>
                  <Text style={s.btnSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
              {modal.editing && (
                <TouchableOpacity style={s.deleteLink} onPress={removeFromModal}>
                  <Ionicons name="trash-outline" size={14} color="#FF6B6B" />
                  <Text style={s.deleteLinkText}>Delete debt</Text>
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  heroLabel: { fontSize: 10, fontWeight: '600', color: '#555', letterSpacing: 1.5, marginBottom: 10 },
  heroAmount: { fontSize: 38, fontWeight: '700', color: '#FF6B6B', letterSpacing: -1 },
  heroDivider: { height: 1, backgroundColor: '#1E1E1E', marginVertical: 18 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroSubLabel: { fontSize: 13, color: '#555' },

  card: {
    backgroundColor: '#151515',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
  },
  cardHeader: { padding: 18 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#BBB', letterSpacing: 0.5 },

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
  dragHandle: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore — web-only cursor hint
    cursor: 'grab',
  },
  rowDragging: { opacity: 0.35 },
  rowDropTarget: { borderTopWidth: 2, borderTopColor: '#00C896' },
  rowLabel: { fontSize: 15, color: '#EEE', fontWeight: '400' },
  rowMeta: { fontSize: 11, color: '#555', marginTop: 2 },
  rowValue: { fontSize: 14, color: '#FF6B6B', fontWeight: '500' },

  empty: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
  },
  emptyText: { fontSize: 13, color: '#3A3A3A' },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
  },
  addRowText: { fontSize: 14, color: '#00C896', fontWeight: '500' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#2C2C2C',
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 16 },
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
    marginBottom: 18,
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
