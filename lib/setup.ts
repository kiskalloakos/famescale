import { supabase } from './supabase';
import { load, save } from './storage';

export interface SetupData {
  completed: boolean;
  investmentTabName: 'Investments' | 'Savings';
  showRevenue: boolean;
}

const NS = 'setup';

async function userId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function fromRemote(): Promise<SetupData | null> {
  const uid = await userId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('user_settings')
    .select('investment_tab_name, show_revenue, setup_completed')
    .eq('user_id', uid)
    .maybeSingle();
  if (error || !data) return null;
  return {
    completed: data.setup_completed,
    investmentTabName: data.investment_tab_name as 'Investments' | 'Savings',
    showRevenue: data.show_revenue,
  };
}

async function toRemote(d: SetupData): Promise<void> {
  const uid = await userId();
  if (!uid) return;
  await supabase
    .from('user_settings')
    .upsert(
      {
        user_id: uid,
        investment_tab_name: d.investmentTabName,
        show_revenue: d.showRevenue,
        setup_completed: d.completed,
      },
      { onConflict: 'user_id' },
    );
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
}
