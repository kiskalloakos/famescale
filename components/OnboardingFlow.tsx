import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { saveSetup } from '../lib/setup';

// Re-exported for screens that still import { SetupData } from this file.
export type { SetupData } from '../lib/setup';

interface Props {
  onComplete: () => void;
}

type TabChoice = 'Investments' | 'Savings';

export default function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [tabChoice, setTabChoice] = useState<TabChoice>('Investments');

  const finish = async (showRevenue: boolean) => {
    await saveSetup({ completed: true, investmentTabName: tabChoice, showRevenue });
    onComplete();
  };

  // ── Welcome ────────────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.welcomeContent}>
          <Text style={s.appName}>joo</Text>
          <Text style={s.tagline}>your finances, simplified.</Text>
        </View>
        <View style={s.footer}>
          <TouchableOpacity style={s.primaryBtn} onPress={() => setStep(1)}>
            <Text style={s.primaryBtnText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 1: Investments vs Savings ─────────────────────────────────────────
  if (step === 1) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.topBar}>
          <TouchableOpacity style={s.backBtn} onPress={() => setStep(0)}>
            <Ionicons name="chevron-back" size={20} color="#555" />
          </TouchableOpacity>
          <Text style={s.stepDot}>1 / 2</Text>
        </View>

        <View style={s.content}>
          <Text style={s.question}>How would you like to{'\n'}track your growth?</Text>

          {(['Investments', 'Savings'] as TabChoice[]).map((choice) => {
            const active = tabChoice === choice;
            return (
              <TouchableOpacity
                key={choice}
                style={[s.choiceCard, active && s.choiceCardActive]}
                onPress={() => setTabChoice(choice)}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.choiceTitle, active && s.choiceTextActive]}>{choice}</Text>
                  <Text style={s.choiceDesc}>
                    {choice === 'Investments'
                      ? 'Track portfolio growth with compound returns'
                      : 'Track savings goals and accumulation'}
                  </Text>
                </View>
                {active && <Ionicons name="checkmark-circle" size={20} color="#00C896" />}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.footer}>
          <TouchableOpacity style={s.primaryBtn} onPress={() => setStep(2)}>
            <Text style={s.primaryBtnText}>Next</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 2: Revenue (optional) ─────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => setStep(1)}>
          <Ionicons name="chevron-back" size={20} color="#555" />
        </TouchableOpacity>
        <Text style={s.stepDot}>2 / 2</Text>
      </View>

      <View style={s.content}>
        <Text style={s.question}>Would you like to track{'\n'}your income too?</Text>
        <Text style={s.questionSub}>
          Adds a Revenue tab — optional, you can change this later.
        </Text>
      </View>

      <View style={s.footer}>
        <TouchableOpacity style={s.primaryBtn} onPress={() => finish(true)}>
          <Text style={s.primaryBtnText}>Yes, track my income</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.skipBtn} onPress={() => finish(false)}>
          <Text style={s.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },

  // Welcome
  welcomeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  appName: {
    fontSize: 64,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -2,
    marginBottom: 12,
  },
  tagline: { fontSize: 16, color: '#444', fontWeight: '400' },

  // Step header
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: { padding: 4 },
  stepDot: { fontSize: 12, color: '#333', fontWeight: '500' },

  // Content
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40 },
  question: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 36,
    marginBottom: 12,
  },
  questionSub: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 32,
  },

  // Choice cards
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    borderRadius: 14,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  choiceCardActive: { borderColor: '#00C896', backgroundColor: '#0D1F1A' },
  choiceTitle: { fontSize: 16, fontWeight: '600', color: '#888', marginBottom: 4 },
  choiceTextActive: { color: '#00C896' },
  choiceDesc: { fontSize: 13, color: '#3A3A3A', lineHeight: 18 },

  // Footer buttons
  footer: { paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  primaryBtn: {
    backgroundColor: '#00C896',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipBtnText: { fontSize: 14, color: '#333', fontWeight: '500' },
});
