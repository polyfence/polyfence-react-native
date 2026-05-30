import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { ChevronUp, ChevronDown } from 'lucide-react-native';
import { Colors, Fonts, Radius, Spacing } from '../theme';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  count?: number;
  defaultExpanded?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

export default function Section({
  title,
  icon,
  count,
  defaultExpanded = true,
  headerRight,
  children,
}: SectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.header, expanded && styles.headerExpanded]}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          {icon}
          <Text style={styles.title}>{title}</Text>
          {count != null && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{count}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          {headerRight}
          {expanded ? (
            <ChevronUp size={20} color={Colors.mutedForeground} />
          ) : (
            <ChevronDown size={20} color={Colors.mutedForeground} />
          )}
        </View>
      </TouchableOpacity>
      {expanded && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  // Section headers target ~56dp visible height. Android's text engine
  // (Skia + libtextlayout) renders the same Space Grotesk TTF with a
  // slightly taller line box than iOS CoreText, so we tighten to 52/14
  // on Android to land at the same perceived size as iOS at 56/16.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    minHeight: Platform.select({ android: 52, ios: 56 }),
    paddingVertical: Platform.select({ android: 14, ios: Spacing.lg }),
  },
  headerExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  // Space Grotesk renders with a taller line box on Android (Skia) than
  // on iOS (CoreText) for the same TTF + fontSize. We pin lineHeight per
  // platform so the rendered title height matches across both.
  title: {
    fontSize: 17,
    fontWeight: '500',
    fontFamily: Fonts.medium,
    color: Colors.foreground,
    lineHeight: Platform.select({ android: 20, ios: 22 }),
  },
  // Inline gray pill count badge: gray-100 bg, gray-600 text, radius 6.
  badge: {
    backgroundColor: Colors.secondary,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '400',
    fontFamily: Fonts.regular,
    color: Colors.mutedForeground,
  },
  // Expanded body uses a tighter vertical padding than the default
  // all-around so list rows breathe without overinflating the card.
  content: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
