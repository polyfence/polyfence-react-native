import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  Activity,
  Trash2,
  ArrowDown,
  ArrowUp,
  Clock,
  AlertCircle,
} from 'lucide-react-native';
import { Colors, Fonts, Spacing } from '../theme';
import type { AppGeofenceEvent } from '../types';
import Section from './Section';

interface EventLogProps {
  events: AppGeofenceEvent[];
  onClear: () => void;
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor(
    (today.getTime() - eventDay.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

interface GroupedEvents {
  label: string;
  events: AppGeofenceEvent[];
}

function groupByDate(events: AppGeofenceEvent[]): GroupedEvents[] {
  const groups = new Map<string, AppGeofenceEvent[]>();

  for (const event of events) {
    const key = event.timestamp.toDateString();
    const existing = groups.get(key);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(key, [event]);
    }
  }

  return Array.from(groups.entries()).map(([, groupEvents]) => ({
    label: formatDateLabel(groupEvents[0]!.timestamp),
    events: groupEvents,
  }));
}

interface IndicatorSpec {
  style: { backgroundColor: string; borderWidth?: number; borderColor?: string };
  icon: React.ReactElement;
  label: string;
}

function indicatorFor(type: AppGeofenceEvent['type']): IndicatorSpec {
  switch (type) {
    case 'enter':
      return {
        style: { backgroundColor: Colors.success },
        icon: <ArrowDown size={12} color={Colors.white} />,
        label: 'ENTER',
      };
    case 'dwell':
      // Amber filled circle with clock icon.
      return {
        style: { backgroundColor: Colors.warning },
        icon: <Clock size={12} color={Colors.white} />,
        label: 'DWELL',
      };
    case 'error':
      return {
        style: { backgroundColor: Colors.destructive },
        icon: <AlertCircle size={12} color={Colors.white} />,
        label: 'ERROR',
      };
    case 'exit':
    default:
      return {
        style: {
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: Colors.destructive,
        },
        icon: <ArrowUp size={12} color={Colors.destructive} />,
        label: 'EXIT',
      };
  }
}

function EventItem({ event }: { event: AppGeofenceEvent }) {
  const { style, icon, label } = indicatorFor(event.type);

  return (
    <View style={styles.eventItem}>
      <View style={[styles.indicator, style]}>{icon}</View>

      <Text style={styles.eventTime}>{formatTime(event.timestamp)}</Text>
      <Text style={styles.bullet}>{'\u2022'}</Text>
      <Text style={styles.eventType}>{label}</Text>
      <Text style={styles.bullet}>{'\u2022'}</Text>
      <Text style={styles.eventZone} numberOfLines={1}>
        {event.zoneName}
      </Text>
    </View>
  );
}

export default function EventLog({ events, onClear }: EventLogProps) {
  const grouped = useMemo(() => groupByDate(events), [events]);

  const clearButton = events.length > 0 ? (
    <TouchableOpacity onPress={onClear} style={styles.clearButton}>
      <Trash2 size={16} color={Colors.mutedForeground} />
    </TouchableOpacity>
  ) : null;

  return (
    <Section
      title="Events"
      icon={<Activity size={20} color={Colors.mutedForeground} />}
      count={events.length}
      headerRight={clearButton}
    >
      {events.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No events recorded yet. Start tracking to see geofence entries and exits.
          </Text>
        </View>
      ) : (
        grouped.map((group) => (
          <View key={group.label} style={styles.dateGroup}>
            <Text style={styles.dateLabel}>{group.label}</Text>
            {group.events.map((event) => (
              <EventItem key={event.id} event={event} />
            ))}
          </View>
        ))
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  // Narrower horizontal padding than section headings so the row sits
  // slightly indented.
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  indicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTime: {
    // Brand font (Space Grotesk) with tabular figures. Family is explicit
    // — Android can fall back to a system tabular font when fontVariant
    // is set without a fontFamily, which produces an off-brand monospace.
    fontSize: 14,
    fontWeight: '400',
    fontFamily: Fonts.regular,
    color: Colors.mutedForeground,
    fontVariant: ['tabular-nums'],
  },
  bullet: {
    color: Colors.textTertiary,
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  eventType: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: Fonts.regular,
    color: Colors.foreground,
  },
  eventZone: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: Fonts.medium,
    color: Colors.foreground,
    flex: 1,
  },
  dateGroup: {
    marginBottom: Spacing.lg,
  },
  // Hugs the left edge of the expanded body with a small horizontal inset.
  dateLabel: {
    fontSize: 14,
    fontFamily: Fonts.semibold,
    color: Colors.foreground,
    marginHorizontal: 4,
    marginBottom: Spacing.sm,
  },
  // 24dp tap target so the icon doesn't inflate the header past 44dp.
  clearButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl3,
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.mutedForeground,
    textAlign: 'center',
  },
});
