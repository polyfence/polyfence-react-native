import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Settings, Zap, Activity, Battery, Target } from 'lucide-react-native';
import { Colors, Fonts, Radius, Shadows, Spacing } from '../theme';
import type { GpsProfile } from '../types';
import { GPS_PROFILES } from '../types';

interface GpsProfileCardProps {
  currentProfile: GpsProfile;
  onProfileChange: (profile: GpsProfile) => void;
}

const PROFILE_ICONS: Record<GpsProfile, React.ComponentType<any>> = {
  max: Zap,
  balanced: Activity,
  battery: Battery,
  smart: Target,
};

const PROFILE_ORDER: GpsProfile[] = ['max', 'balanced', 'battery', 'smart'];

export default function GpsProfileCard({
  currentProfile,
  onProfileChange,
}: GpsProfileCardProps) {
  const info = GPS_PROFILES[currentProfile];

  return (
    <View style={styles.container}>
      {/* Header Row */}
      <View style={styles.header}>
        <Settings size={20} color={Colors.mutedForeground} />
        <Text style={styles.headerTitle}>GPS Profile</Text>
      </View>

      {/* Description */}
      <Text style={styles.description}>{info.description}</Text>

      {/* Profile Grid */}
      <View style={styles.profileGrid}>
        {PROFILE_ORDER.map((profile) => {
          const isActive = profile === currentProfile;
          const IconComponent = PROFILE_ICONS[profile];
          return (
            <TouchableOpacity
              key={profile}
              style={[
                styles.profileButton,
                isActive && styles.profileButtonActive,
              ]}
              onPress={() => onProfileChange(profile)}
              activeOpacity={0.7}
            >
              <IconComponent
                size={20}
                color={isActive ? Colors.white : Colors.foreground}
              />
              <Text
                style={[
                  styles.profileLabel,
                  isActive && styles.profileLabelActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                allowFontScaling={false}
              >
                {GPS_PROFILES[profile].label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  // Tighter gap (8dp) between header and description than between
  // description and button grid (16dp).
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: Fonts.medium,
    color: Colors.foreground,
  },
  description: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.mutedForeground,
    marginBottom: Spacing.lg,
  },
  // Four equal-width tiles with an 8dp gutter between them.
  profileGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  // Horizontal padding tightened from 12 → 8 so "Balanced" (8 chars)
  // fits without truncation on narrow devices (Samsung ~360dp width).
  // Vertical stays at 12 for a consistent tile height.
  profileButton: {
    flex: 1,
    backgroundColor: Colors.secondary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  profileButtonActive: {
    backgroundColor: Colors.primary,
    ...Shadows.card,
  },
  profileLabel: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: Fonts.medium,
    color: Colors.foreground,
    textAlign: 'center',
  },
  // Active tile uses white text — overrides the darker DARK_ON_CYAN
  // brand default for stronger emphasis in-app.
  profileLabelActive: {
    color: Colors.white,
  },
});
