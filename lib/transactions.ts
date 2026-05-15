import { supabase, userId } from './supabase';
import { reportable } from './sync';

export type TxDirection = 'in' | 'out';
export type TxKind = 'manual' | 'cost' | 'refund';

export interface Transaction {
  id: string;
  accountId: string | null;
  amount: number;
  direction: TxDirection;
  kind: TxKind;
  referenceId: string | null;
  note: string | null;
  createdAt: string; // ISO
}

export async function logTransaction(args: {
  accountId: string;
  amount: number;
  direction: TxDirection;
  kind?: TxKind;
  referenceId?: string | null;
  note?: string | null;
}): Promise<void> {
  if (args.amount <= 0) return;
  const uid = await userId();
  if (!uid) return;
  await reportable(
    supabase.from('transactions').insert({
      user_id: uid,
      account_id: args.accountId,
      amount: args.amount,
      direction: args.direction,
      kind: args.kind ?? 'manual',
      reference_id: args.referenceId ?? null,
      note: args.note ?? null,
    }),
  );
}

export async function getTransactions(limit = 500): Promise<Transaction[]> {
  const uid = await userId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('transactions')
    .select('id, account_id, amount, direction, kind, reference_id, note, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    amount: Number(r.amount),
    direction: r.direction as TxDirection,
    kind: r.kind as TxKind,
    referenceId: r.reference_id,
    note: r.note,
    createdAt: r.created_at,
  }));
}
