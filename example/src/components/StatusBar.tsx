import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Clipboard,
  TouchableOpacity,
} from 'react-native';
import { Copy } from 'lucide-react-native';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import type { LatLng, GpsProfile } from '../types';
import { GPS_PROFILES } from '../types';

interface StatusBarProps {
  isTracking: boolean;
  location: LatLng | null;
  accuracy: number | null;
  speed: number;
  activity: string;
  gpsProfile: GpsProfile;
  locationStatus: string;
}

function formatActivity(activity: string): string {
  switch (activity.toLowerCase()) {
    case 'still':
      return '\u{1F9CD} Still';
    case 'walking':
      return '\u{1F6B6} Walking';
    case 'running':
      return '\u{1F3C3} Running';
    case 'cycling':
      return '\u{1F6B4} Cycling';
    case 'driving':
      return '\u{1F697} Driving';
    default:
      return '\u{2753} Unknown';
  }
}

function PulsingDot({ active }: { active: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (active) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.7,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    } else {
      opacity.setValue(1);
    }
  }, [active, opacity]);

  return (
    <Animated.View
      style={[
        styles.dot,
        { opacity, backgroundColor: active ? Colors.success : Colors.textTertiary },
      ]}
    />
  );
}

function MetricTile({ value, label }: { value: string; label: string }) {
  const isEmpty = value === '\u2014';
  return (
    <View style={styles.metricTile}>
      <Text
        style={[styles.metricValue, isEmpty && styles.metricValueEmpty]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function StatusBar({
  isTracking,
  location,
  accuracy,
  speed,
  activity,
  gpsProfile,
  locationStatus,
}: StatusBarProps) {
  const copyCoordinates = () => {
    if (location) {
      const text = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
      Clipboard.setString(text);
    }
  };

  const profileInfo = GPS_PROFILES[gpsProfile];

  return (
    <View style={styles.container}>
      {/* Tracking status */}
      <View style={styles.statusRow}>
        <PulsingDot active={isTracking} />
        <Text style={styles.statusText}>
          {isTracking ? 'Tracking Active' : 'Tracking Stopped'}
        </Text>
      </View>
      <View style={styles.gapAfterStatus} />

      {/* Coordinates — label on top, coords flush-left below.
          Only the copy icon is tappable. */}
      <View style={styles.coordsRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.coordsLabel}>Current Position</Text>
          <Text style={styles.coordsValue}>
            {location
              ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
              : locationStatus}
          </Text>
        </View>
        {location && (
          <TouchableOpacity
            onPress={copyCoordinates}
            activeOpacity={0.6}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            style={styles.copyButton}
          >
            <Copy size={16} color={Colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.gapAfterCoords} />

      {/* Metrics grid */}
      <View style={styles.metricsRow}>
        <MetricTile
          value={isTracking && accuracy != null ? `\u00B1${Math.round(accuracy)}m` : '\u2014'}
          label="Accuracy"
        />
        <MetricTile
          value={isTracking ? `${speed.toFixed(1)} km/h` : '\u2014'}
          label="Speed"
        />
      </View>
      <View style={styles.gapBetweenMetrics} />
      <View style={styles.metricsRow}>
        <MetricTile
          value={isTracking ? formatActivity(activity) : '\u2014'}
          label="Activity"
        />
        <MetricTile
          value={isTracking ? profileInfo.interval : '\u2014'}
          label="Updates"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Status card surface (white #FFFFFF, contrast against the off-white
  // #FAFBFC dashboard background), padding 16, vertical gaps set
  // explicitly per section (12 / 16 / 12).
  container: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  // 12dp after the tracking status row.
  gapAfterStatus: { height: Spacing.md },
  // 16dp between coords block and the metric grid.
  gapAfterCoords: { height: Spacing.lg },
  // 12dp between the two metric rows.
  gapBetweenMetrics: { height: Spacing.md },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: Fonts.medium,
    color: Colors.foreground,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copyButton: {
    padding: 4,
  },
  coordsLabel: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.mutedForeground,
  },
  coordsValue: {
    // Brand font (Space Grotesk) with tabular figures locks digit widths
    // so coords don't jitter as values update — same effect as a true
    // monospace font but keeps the brand single-font cohesion. Family is
    // explicit (not relying on the App.tsx render monkey-patch default)
    // because `fontVariant: ['tabular-nums']` on Android can fall back to
    // a system tabular font when no explicit family is set.
    fontSize: 14,
    color: Colors.foreground,
    fontFamily: Fonts.regular,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  // Each cell left-aligns its value and label (no center alignment).
  metricTile: {
    flex: 1,
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
  },
  metricValue: {
    fontSize: 20,
    fontFamily: Fonts.semibold,
    color: Colors.foreground,
    // Locks digit widths so metric values (e.g. "±5m", "12.3 km/h") don't
    // jitter horizontally between rerenders.
    fontVariant: ['tabular-nums'],
  },
  metricValueEmpty: {
    color: Colors.mutedForeground,
  },
  metricLabel: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.mutedForeground,
    // 4dp between metric value and its label.
    marginTop: Spacing.xs,
  },
});
