import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import type { AppGeofenceEvent } from '../types';

interface ErrorBannerProps {
  errors: AppGeofenceEvent[];
  onDismiss: (id: string) => void;
  onClearAll?: () => void;
  onClose?: () => void;
}

const MAX_VISIBLE = 2;

export default function ErrorBanner({
  errors,
  onDismiss,
  onClearAll,
  onClose,
}: ErrorBannerProps) {
  if (errors.length === 0) return null;

  const visible = errors.slice(0, MAX_VISIBLE);
  const remaining = errors.length - MAX_VISIBLE;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.countLabel}>
          {errors.length} Error{errors.length !== 1 ? 's' : ''}
        </Text>
        <View style={styles.headerActions}>
          {onClearAll && (
            <TouchableOpacity onPress={onClearAll} style={styles.clearAllBtn}>
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          )}
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={16} color={Colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Up to 2 red error cards */}
      {visible.map((error) => (
        <View key={error.id} style={styles.errorCard}>
          <AlertTriangle size={16} color={Colors.white} />
          <View style={styles.errorContent}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorMessage} numberOfLines={2}>
              {error.message ?? 'Unknown error'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => onDismiss(error.id)}
          >
            <X size={14} color={Colors.white} />
          </TouchableOpacity>
        </View>
      ))}
      {remaining > 0 && (
        <Text style={styles.moreText}>
          +{remaining} more error{remaining !== 1 ? 's' : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countLabel: {
    fontSize: 12,
    fontFamily: Fonts.semibold,
    color: Colors.destructive,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  clearAllBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: Fonts.medium,
    color: Colors.destructive,
  },
  closeBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.destructive,
    borderRadius: Radius.lg,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 12,
    fontFamily: Fonts.semibold,
    color: Colors.white,
  },
  errorMessage: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.white,
    marginTop: 2,
  },
  dismissButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: Fonts.medium,
    color: Colors.destructive,
    textAlign: 'center',
    paddingTop: 2,
  },
});
