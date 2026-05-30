import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { Colors, Spacing } from '../theme';
import CountBadge from './CountBadge';

interface BellButtonProps {
  errorCount: number;
  onToggle: () => void;
}

/**
 * Header notification bell.
 * - icon stays muted gray at all times
 * - red count badge appears only when errorCount > 0
 * - tap always toggles the dashboard error banner, even at zero errors
 */
export default function BellButton({ errorCount, onToggle }: BellButtonProps) {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityLabel={
        errorCount === 0
          ? 'No errors'
          : `${errorCount} error${errorCount !== 1 ? 's' : ''}`
      }
    >
      <Bell size={20} color={Colors.mutedForeground} />
      <CountBadge count={errorCount} max={99} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
});
