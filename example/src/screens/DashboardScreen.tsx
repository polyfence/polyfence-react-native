import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';
import type { PolyfenceState, PolyfenceActions } from '../hooks/usePolyfence';
import StatusBar from '../components/StatusBar';
import GpsProfileCard from '../components/GpsProfileCard';
import ZoneList from '../components/ZoneList';
import EventLog from '../components/EventLog';
import ErrorBanner from '../components/ErrorBanner';

interface DashboardScreenProps {
  state: PolyfenceState;
  actions: PolyfenceActions;
  // Visibility is lifted to AppContent so the header bell can toggle it.
  errorsVisible: boolean;
  onDismissBanner: () => void;
}

export default function DashboardScreen({
  state,
  actions,
  errorsVisible,
  onDismissBanner,
}: DashboardScreenProps) {
  return (
    <View style={styles.root}>
      {/* Error banner */}
      {errorsVisible && state.errors.length > 0 && (
        <ErrorBanner
          errors={state.errors}
          onDismiss={actions.dismissError}
          onClearAll={() => {
            actions.clearErrors();
            onDismissBanner();
          }}
          onClose={onDismissBanner}
        />
      )}

      {/* Scrollable content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <StatusBar
          isTracking={state.isTracking}
          location={state.location}
          accuracy={state.accuracy}
          speed={state.speed}
          activity={state.activity}
          gpsProfile={state.gpsProfile}
          locationStatus={state.locationStatus}
        />

        <GpsProfileCard
          currentProfile={state.gpsProfile}
          onProfileChange={actions.setGpsProfile}
        />

        <ZoneList
          zones={state.zones}
          isLoading={state.isLoadingZones}
          onRefresh={actions.refreshZones}
        />

        <EventLog
          events={state.events}
          onClear={actions.clearEvents}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl3,
    gap: Spacing.lg,
  },
});
