import { supabase } from './supabase';
import { load, save } from './storage';

export interface InvestmentData {
  totalInvested: string;
  startMonth: string;
  startYear: string;
  annualReturn: string;
}

const NS = 'investments';

const DEFAULT: InvestmentData = {
  totalInvested: '',
  startMonth: String(new Date().getMonth() + 1),
  startYear: String(new Date().getFullYear()),
  annualReturn: '7',
};

async function userId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getInvestments(): Promise<InvestmentData> {
  return load<InvestmentData>(NS, DEFAULT);
}

export async function refreshInvestments(): Promise<InvestmentData> {
  const uid = await userId();
  if (!uid) return getInvestments();
  const { data, error } = await supabase
    .from('investment_setup')
    .select('total_invested, start_month, start_year, annual_return')
    .eq('user_id', uid)
    .maybeSingle();
  if (error || !data) return getInvestments();
  const result: InvestmentData = {
    totalInvested: data.total_invested ? String(data.total_invested) : '',
    startMonth: String(data.start_month),
    startYear: String(data.start_year),
    annualReturn: String(data.annual_return),
  };
  await save(NS, result);
  return result;
}

export async function saveInvestments(d: InvestmentData): Promise<void> {
  await save(NS, d);
  const uid = await userId();
  if (!uid) return;
  await supabase
    .from('investment_setup')
    .upsert(
      {
        user_id: uid,
        total_invested: parseFloat(d.totalInvested) || 0,
        start_month: parseInt(d.startMonth) || 1,
        start_year: parseInt(d.startYear) || new Date().getFullYear(),
        annual_return: parseFloat(d.annualReturn) || 7,
      },
      { onConflict: 'user_id' },
    );
}
