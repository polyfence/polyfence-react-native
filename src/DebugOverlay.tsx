import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Polyfence } from './Polyfence';
import type { HealthScoreEvent, PolyfenceDebugInfo, Subscription } from './types';

/**
 * Debug overlay showing real-time Polyfence health and performance metrics.
 *
 * Only renders in __DEV__ builds. In production builds, renders null.
 * Drag to reposition. Tap to toggle collapsed/expanded.
 *
 * ```tsx
 * // In your app's root component:
 * <View style={{ flex: 1 }}>
 *   <MyApp />
 *   <PolyfenceDebugOverlay />
 * </View>
 * ```
 */
export function PolyfenceDebugOverlay({
  initialX = 16,
  initialY = 80,
}: {
  initialX?: number;
  initialY?: number;
} = {}) {
  if (!__DEV__) return null;

  const [healthScore, setHealthScore] = useState<HealthScoreEvent | null>(null);
  const [debugInfo, setDebugInfo] = useState<PolyfenceDebugInfo | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: () => {
        pan.extractOffset();
      },
    }),
  ).current;

  const fetchDebugInfo = useCallback(async () => {
    try {
      const info = await Polyfence.instance.debugInfo();
      setDebugInfo(info);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    let sub: Subscription | undefined;
    try {
      sub = Polyfence.instance.onHealthScore((event) => {
        setHealthScore(event);
      });
    } catch {
      // Instance may not be initialized yet
    }

    fetchDebugInfo();
    const interval = setInterval(fetchDebugInfo, 10000);

    return () => {
      sub?.remove();
      clearInterval(interval);
    };
  }, [fetchDebugInfo]);

  const score = healthScore?.score ?? 0;
  const scoreColor = score >= 90 ? '#4CAF50' : score >= 70 ? '#8BC34A' : score >= 50 ? '#FF9800' : '#F44336';

  if (collapsed) {
    return (
      <Animated.View
        style={[styles.container, { transform: pan.getTranslateTransform() }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity onPress={() => setCollapsed(false)} style={styles.collapsedContent}>
          <View style={[styles.scoreCircleSmall, { borderColor: scoreColor }]}>
            <Text style={[styles.scoreTextSmall, { color: scoreColor }]}>{score}</Text>
          </View>
          <Text style={styles.collapsedLabel}>PF {score}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[styles.container, styles.expanded, { transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity onPress={() => setCollapsed(true)} activeOpacity={0.9}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
            <Text style={[styles.scoreText, { color: scoreColor }]}>{score}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Health: {score}/100</Text>
            {healthScore?.topIssue ? (
              <Text style={[styles.issue, { color: scoreColor }]} numberOfLines={2}>
                {healthScore.topIssue}
              </Text>
            ) : null}
          </View>
        </View>

        {debugInfo ? (
          <>
            <View style={styles.divider} />
            <MetricRow label="Tracking" value={debugInfo.isTracking ? 'Active' : 'Stopped'} />
            <MetricRow label="Zones" value={String(debugInfo.activeZones)} />
            <MetricRow label="Events" value={String(debugInfo.totalEventsGenerated)} />
            <MetricRow label="Profile" value={debugInfo.currentAccuracyProfile} />
            <MetricRow label="Interval" value={`${debugInfo.currentIntervalMs}ms`} />
          </>
        ) : null}
        <Text style={styles.hint}>Tap to minimize</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 9999,
  },
  expanded: {
    width: 220,
    padding: 12,
  },
  collapsedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  issue: {
    fontSize: 10,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  metricLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
  },
  scoreCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  scoreCircleSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scoreTextSmall: {
    fontSize: 10,
    fontWeight: '700',
  },
  collapsedLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  hint: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 4,
  },
});
