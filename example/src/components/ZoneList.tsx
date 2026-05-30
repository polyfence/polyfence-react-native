import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MapPin, Circle, Octagon, RefreshCcw } from 'lucide-react-native';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import { formatDistance } from '../utils/distance';
import type { AppZone } from '../types';
import Section from './Section';

interface ZoneListProps {
  zones: AppZone[];
  isLoading: boolean;
  onRefresh: () => void;
}

function ZoneItem({ zone, isLast }: { zone: AppZone; isLast: boolean }) {
  const isCircle = zone.type === 'circle';
  const iconColor = isCircle ? Colors.circleZoneIcon : Colors.polygonZoneIcon;
  const iconBg = isCircle ? Colors.circleZoneBg : Colors.polygonZoneBg;
  const distanceText = formatDistance(zone.distance);

  let statusPill: { text: string; bg: string; fg: string } | null = null;
  if (zone.distance != null) {
    if (zone.distance <= 50) {
      statusPill = {
        text: 'Inside',
        bg: Colors.primary,
        // White foreground — same treatment as the active GPS profile tile.
        fg: Colors.white,
      };
    } else if (zone.distance < 500) {
      statusPill = {
        text: 'Near',
        bg: Colors.secondary,
        fg: Colors.secondaryForeground,
      };
    }
  }

  // Polygon zones render as an octagon (8 sides), not a hexagon.
  const IconComponent = isCircle ? Circle : Octagon;

  return (
    <View style={[styles.zoneItem, !isLast && styles.zoneItemBorder]}>
      <View style={[styles.zoneIcon, { backgroundColor: iconBg }]}>
        <IconComponent size={20} color={iconColor} />
      </View>
      <View style={styles.zoneInfo}>
        <Text style={styles.zoneName} numberOfLines={1}>
          {zone.name}
        </Text>
        <View style={styles.zoneDetailRow}>
          <Text style={styles.zoneDetail}>
            {isCircle ? 'Circle' : 'Polygon'}
          </Text>
          {zone.distance != null && (
            <>
              <Text style={styles.zoneDetailDot}> {'\u2022'} </Text>
              <Text style={styles.zoneDetail}>{distanceText} away</Text>
            </>
          )}
        </View>
      </View>
      {statusPill && (
        <View style={[styles.statusPill, { backgroundColor: statusPill.bg }]}>
          <Text style={[styles.statusPillText, { color: statusPill.fg }]}>
            {statusPill.text}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ZoneList({ zones, isLoading, onRefresh }: ZoneListProps) {
  const refreshButton = (
    <TouchableOpacity
      onPress={onRefresh}
      disabled={isLoading}
      style={styles.refreshButton}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={Colors.mutedForeground} />
      ) : (
        <RefreshCcw size={16} color={Colors.mutedForeground} />
      )}
    </TouchableOpacity>
  );

  return (
    <Section
      title="Zones"
      icon={<MapPin size={20} color={Colors.mutedForeground} />}
      count={zones.length}
      headerRight={refreshButton}
    >
      {zones.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No zones loaded</Text>
          <Text style={styles.emptyHint}>Tap refresh to load zones from plugin</Text>
        </View>
      ) : (
        zones.map((zone, index) => (
          <ZoneItem
            key={zone.id}
            zone={zone}
            isLast={index === zones.length - 1}
          />
        ))
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  zoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  // Intra-list divider uses the lighter `borderMuted` so it reads as a
  // subdivision; the outer card keeps the heavier `border`.
  zoneItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderMuted,
  },
  zoneIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneInfo: {
    flex: 1,
  },
  zoneName: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: Fonts.medium,
    color: Colors.foreground,
  },
  zoneDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  zoneDetail: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.mutedForeground,
  },
  zoneDetailDot: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.mutedForeground,
  },
  statusPill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  // Regular weight — lighter than the default medium so the pill reads
  // as a tag rather than a header.
  statusPillText: {
    fontSize: 12,
    fontWeight: '400',
    fontFamily: Fonts.regular,
  },
  // 24dp tap target so the refresh icon doesn't inflate the header row
  // past the 44dp min-height.
  refreshButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl3,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.mutedForeground,
  },
  emptyHint: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.mutedForeground,
    marginTop: 4,
  },
});
