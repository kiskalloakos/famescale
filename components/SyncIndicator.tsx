import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { subscribeSync } from '../lib/sync';

export default function SyncIndicator() {
  const [status, setStatus] = useState<'ok' | 'failed'>('ok');

  useEffect(() => subscribeSync((s) => setStatus(s)), []);

  if (status === 'ok') return null;

  return (
    <View style={s.host} pointerEvents="none">
      <View style={s.pill}>
        <Ionicons name="cloud-offline-outline" size={12} color="#FF6B6B" />
        <Text style={s.text}>Saved locally — sync failed</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1F0D0D',
    borderColor: '#3A1818',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: { fontSize: 11, color: '#FF6B6B', fontWeight: '600' },
});
