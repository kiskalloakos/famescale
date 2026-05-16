import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

/**
 * Curated emoji picker. We don't ship a full unicode keyboard — a short,
 * context-appropriate set is enough for tagging goals / assets and avoids
 * the old "type an emoji into a textbox" UX.
 *
 * Pass `options` for the context (see GOAL_EMOJIS / ASSET_EMOJIS below).
 * `value` is the currently-selected emoji ('' = none). Tapping the selected
 * chip again clears it, so an item can still have no icon.
 */
export const GOAL_EMOJIS = ['🎯', '💰', '🛡️', '🏠', '🚗', '✈️', '🎓', '💍', '🏖️', '📈'];
export const ASSET_EMOJIS = ['🏠', '🚗', '💎', '⌚', '💰', '🖼️', '🪙', '🛥️', '🏡', '📦'];

export default function EmojiPicker({
  value,
  onChange,
  options,
  label = 'Icon',
}: {
  value: string;
  onChange: (emoji: string) => void;
  options: string[];
  label?: string;
}) {
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <View style={s.grid}>
        {options.map((e) => {
          const selected = value === e;
          return (
            <Pressable
              key={e}
              onPress={() => onChange(selected ? '' : e)}
              style={[s.chip, selected && s.chipSelected]}
            >
              <Text style={s.emoji}>{e}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 20 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#2C2C2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: '#00C896',
    backgroundColor: 'rgba(0,200,150,0.12)',
  },
  emoji: { fontSize: 22 },
});
