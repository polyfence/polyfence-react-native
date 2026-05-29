import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../theme';

interface CountBadgeProps {
  count: number;
  max?: number;
}

// Absolutely-positioned red count badge for header icon buttons. Used by
// BellButton (errors) and LogExportButton (logs). For the inline gray
// pill rendered inside Section headers, see Section.tsx's local `badge`
// style.
export default function CountBadge({ count, max = 99 }: CountBadgeProps) {
  if (count <= 0) return null;
  const display = count > max ? `${max}+` : String(count);
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    backgroundColor: Colors.destructive,
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
});
