import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapLibreGL, { type CameraRef } from '@maplibre/maplibre-react-native';
import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '../theme';
import type { PolyfenceState } from '../hooks/usePolyfence';

// OpenStreetMap raster tiles — free, no API key
const OSM_STYLE = JSON.stringify({
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '\u00A9 OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
});

interface MapScreenProps {
  state: PolyfenceState;
}

const DEFAULT_CENTER: [number, number] = [151.2093, -33.8688]; // Sydney fallback [lng, lat]
const DEFAULT_ZOOM = 13;

export default function MapScreen({ state }: MapScreenProps) {
  const cameraRef = useRef<CameraRef>(null);
  const hasAnimated = useRef(false);

  // Animate to user location on first fix
  useEffect(() => {
    if (state.location && !hasAnimated.current && cameraRef.current) {
      hasAnimated.current = true;
      cameraRef.current.setCamera({
        centerCoordinate: [state.location.longitude, state.location.latitude],
        zoomLevel: 15,
        animationDuration: 500,
      });
    }
  }, [state.location]);

  const center: [number, number] = state.location
    ? [state.location.longitude, state.location.latitude]
    : DEFAULT_CENTER;

  return (
    <View style={styles.root}>
      <MapLibreGL.MapView
        style={styles.map}
        mapStyle={OSM_STYLE}
        // Force attribution to bottom-right on both platforms (Android's
        // MapLibre default is bottom-left). Logo hidden so only the "i"
        // attribution button shows.
        attributionEnabled={true}
        attributionPosition={{ bottom: 8, right: 8 }}
        logoEnabled={false}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: center,
            zoomLevel: DEFAULT_ZOOM,
          }}
        />

        {/* User location */}
        <MapLibreGL.UserLocation visible={true} />
      </MapLibreGL.MapView>

      {/* Status overlay */}
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>
          {state.zones.length} zone{state.zones.length !== 1 ? 's' : ''} ·{' '}
          {state.isTracking ? 'Tracking' : 'Stopped'}
          {state.accuracy != null ? ` · ±${Math.round(state.accuracy)}m` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    ...Shadows.overlay,
  },
  overlayText: {
    ...Typography.labelMd,
    color: Colors.foreground,
    fontWeight: '500',
    fontFamily: Fonts.medium,
  },
});
