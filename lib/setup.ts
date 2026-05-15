import { supabase, userId } from './supabase';
import { load, peek, save } from './storage';
import { reportable } from './sync';

export interface SetupData {
  completed: boolean;
  showInvestments: boolean;
  showSavings: boolean;
  showRevenue: boolean;
  showDebts: boolean;
  showNetWorth: boolean;
  includeDebtsInNetWorth: boolean;
}

const NS = 'setup';

async function fromRemote(): Promise<SetupData | null> {
  const uid = await userId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('user_settings')
    .select('investment_tab_name, show_investments, show_savings, show_revenue, show_debts, show_net_worth, net_worth_include_debts, setup_completed')
    .eq('user_id', uid)
    .maybeSingle();
  if (error || !data) return null;

  // Backward-compat: if new columns aren't populated yet, derive from the
  // legacy `investment_tab_name` field (single tab named one or the other).
  const legacyName = data.investment_tab_name as 'Investments' | 'Savings' | null;
  const showInvestments = data.show_investments ?? (legacyName !== 'Savings');
  const showSavings = data.show_savings ?? (legacyName === 'Savings');

  return {
    completed: data.setup_completed,
    showInvestments,
    showSavings,
    showRevenue: data.show_revenue,
    showDebts: data.show_debts ?? false,
    showNetWorth: data.show_net_worth ?? false,
    includeDebtsInNetWorth: data.net_worth_include_debts ?? true,
  };
}

async function toRemote(d: SetupData): Promise<void> {
  const uid = await userId();
  if (!uid) return;
  await reportable(
    supabase
      .from('user_settings')
      .upsert(
        {
          user_id: uid,
          show_investments: d.showInvestments,
          show_savings: d.showSavings,
          show_revenue: d.showRevenue,
          show_debts: d.showDebts,
          show_net_worth: d.showNetWorth,
          net_worth_include_debts: d.includeDebtsInNetWorth,
          setup_completed: d.completed,
        },
        { onConflict: 'user_id' },
      ),
  );
}

export function peekSetup(): SetupData | null {
  return peek<SetupData | null>(NS, null);
}

export async function getSetup(): Promise<SetupData | null> {
  return load<SetupData | null>(NS, null);
}

export async function refreshSetup(): Promise<SetupData | null> {
  const remote = await fromRemote();
  if (remote) await save(NS, remote);
  return remote ?? (await getSetup());
}

export async function saveSetup(data: SetupData): Promise<void> {
  await save(NS, data);
  await toRemote(data);
  listeners.forEach((fn) => fn(data));
}

// Lightweight subscriber so components (e.g. the tab bar) re-render the moment
// Settings toggles `showRevenue`, without a manual reload.
type Listener = (data: SetupData) => void;
const listeners = new Set<Listener>();

export function subscribeSetup(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
