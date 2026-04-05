import React, {useEffect, useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import {Polyfence} from 'polyfence-react-native';
import type {
  GeofenceEvent,
  PolyfenceLocation,
  PolyfenceError,
  AccuracyProfile,
  Subscription,
  ZoneState,
} from 'polyfence-react-native';
import {styles, colors, spacing} from './styles';
import {demoZones} from './demoZones';

interface EventLog {
  id: string;
  timestamp: number;
  type: string;
  zoneName: string;
}

interface ErrorLog {
  id: string;
  message: string;
  type: string;
}

const ACCURACY_PROFILES: AccuracyProfile[] = [
  'maxAccuracy',
  'balanced',
  'batteryOptimal',
  'adaptive',
];

const PROFILE_LABELS: Record<AccuracyProfile, string> = {
  maxAccuracy: 'Max',
  balanced: 'Balanced',
  batteryOptimal: 'Optimal',
  adaptive: 'Adaptive',
};

export default function App(): React.ReactElement {
  const [isTracking, setIsTracking] = useState(false);
  const [zoneCount, setZoneCount] = useState(0);
  const [currentProfile, setCurrentProfile] = useState<AccuracyProfile>(
    'balanced',
  );
  const [eventLog, setEventLog] = useState<EventLog[]>([]);
  const [errorLog, setErrorLog] = useState<ErrorLog[]>([]);
  const [zoneStates, setZoneStates] = useState<ZoneState[]>([]);
  const [lastLocation, setLastLocation] = useState<PolyfenceLocation | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  const subscriptionsRef = useRef<Subscription[]>([]);

  const cleanup = useCallback(() => {
    subscriptionsRef.current.forEach(sub => sub.remove());
    subscriptionsRef.current = [];
  }, []);

  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);

      await Polyfence.instance.initialize({
        accuracyProfile: 'balanced',
        updateStrategy: 'intelligent',
        dwellDetectionEnabled: true,
        falseEventProtectionEnabled: true,
      });

      setZoneCount(demoZones.length);

      for (const zone of demoZones) {
        try {
          await Polyfence.instance.addZone(zone);
        } catch (e) {
          addError(`Failed to add zone ${zone.name}: ${e}`);
        }
      }

      const sub1 = Polyfence.instance.onGeofenceEvent(
        (event: GeofenceEvent) => {
          const log: EventLog = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            type: event.type.toUpperCase(),
            zoneName: event.zoneName,
          };
          setEventLog(prev => [log, ...prev].slice(0, 50));
        },
      );

      const sub2 = Polyfence.instance.onLocationUpdate(
        (location: PolyfenceLocation) => {
          setLastLocation(location);
        },
      );

      const sub3 = Polyfence.instance.onError((error: PolyfenceError) => {
        addError(`${error.type}: ${error.message}`);
      });

      subscriptionsRef.current.push(sub1, sub2, sub3);
    } catch (e) {
      addError(`Initialization failed: ${e}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addError = useCallback((message: string) => {
    setErrorLog(prev => [
      {
        id: Date.now().toString(),
        message,
        type: 'error',
      },
      ...prev,
    ].slice(0, 10));
  }, []);

  useEffect(() => {
    initialize();

    return () => {
      cleanup();
    };
  }, [initialize, cleanup]);

  const toggleTracking = useCallback(async () => {
    try {
      if (isTracking) {
        await Polyfence.instance.stopTracking();
        setIsTracking(false);
      } else {
        await Polyfence.instance.startTracking();
        setIsTracking(true);
      }
    } catch (e) {
      addError(`Toggle tracking failed: ${e}`);
    }
  }, [isTracking, addError]);

  const setProfile = useCallback(
    async (profile: AccuracyProfile) => {
      try {
        await Polyfence.instance.setAccuracyProfile(profile);
        setCurrentProfile(profile);
      } catch (e) {
        addError(`Failed to set profile: ${e}`);
      }
    },
    [addError],
  );

  const loadZoneStates = useCallback(async () => {
    try {
      const states = await Polyfence.instance.getZoneStates();
      setZoneStates(states);
    } catch (e) {
      addError(`Failed to load zone states: ${e}`);
    }
  }, [addError]);

  const clearEvents = useCallback(() => {
    setEventLog([]);
  }, []);

  const clearErrors = useCallback(() => {
    setErrorLog([]);
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.container, {justifyContent: 'center'}]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Polyfence</Text>
        <Text style={styles.headerSubtitle}>React Native Example</Text>
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {errorLog.length > 0 && errorLog[0] && (
          <View style={[styles.card, {backgroundColor: colors.destructive}]}>
            <View style={styles.row}>
              <Text
                style={[
                  styles.value,
                  {color: '#FFFFFF', fontWeight: '700', flex: 1},
                ]}>
                {errorLog[0].message}
              </Text>
              <TouchableOpacity onPress={clearErrors}>
                <Text style={{color: '#FFFFFF', fontWeight: '600'}}>
                  Dismiss
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View>
                <Text style={styles.label}>Tracking</Text>
                <Text style={styles.value}>
                  {isTracking ? 'Active' : 'Inactive'}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  isTracking ? styles.successBadge : styles.badgeInactive,
                ]}>
                <Text style={styles.badgeText}>
                  {isTracking ? 'ON' : 'OFF'}
                </Text>
              </View>
            </View>

            <View style={styles.row}>
              <View>
                <Text style={styles.label}>Zones</Text>
                <Text style={styles.value}>{zoneCount}</Text>
              </View>
              <View style={[styles.badge, {backgroundColor: colors.accent}]}>
                <Text style={styles.badgeText}>{Object.keys(zoneStates).length}</Text>
              </View>
            </View>

            <View style={styles.row}>
              <View>
                <Text style={styles.label}>GPS Profile</Text>
                <Text style={styles.value}>
                  {PROFILE_LABELS[currentProfile]}
                </Text>
              </View>
            </View>

            {lastLocation && (
              <>
                <View style={styles.row}>
                  <View>
                    <Text style={styles.label}>Latitude</Text>
                    <Text style={styles.value}>
                      {lastLocation.latitude.toFixed(4)}
                    </Text>
                  </View>
                </View>
                <View style={styles.row}>
                  <View>
                    <Text style={styles.label}>Longitude</Text>
                    <Text style={styles.value}>
                      {lastLocation.longitude.toFixed(4)}
                    </Text>
                  </View>
                </View>
                <View style={styles.row}>
                  <View>
                    <Text style={styles.label}>Accuracy</Text>
                    <Text style={styles.value}>
                      {(lastLocation.accuracy ?? 0).toFixed(1)}m
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tracking Control</Text>
          <TouchableOpacity
            style={[
              styles.button,
              isTracking
                ? {backgroundColor: colors.destructive}
                : {backgroundColor: colors.success},
            ]}
            onPress={toggleTracking}>
            <Text style={styles.buttonPrimaryText}>
              {isTracking ? 'Stop Tracking' : 'Start Tracking'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GPS Profile</Text>
          <View>
            {ACCURACY_PROFILES.map(profile => (
              <TouchableOpacity
                key={profile}
                style={[
                  styles.button,
                  styles.touchable,
                  currentProfile === profile
                    ? styles.buttonPrimary
                    : styles.buttonSecondary,
                ]}
                onPress={() => setProfile(profile)}>
                <Text
                  style={
                    currentProfile === profile
                      ? styles.buttonPrimaryText
                      : styles.buttonSecondaryText
                  }>
                  {PROFILE_LABELS[profile]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.sectionTitle}>Zones</Text>
            <TouchableOpacity onPress={loadZoneStates}>
              <Text style={{color: colors.accent, fontWeight: '600'}}>
                Refresh
              </Text>
            </TouchableOpacity>
          </View>
          {Object.keys(zoneStates).length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.value}>No zones loaded</Text>
            </View>
          ) : (
            <FlatList
              scrollEnabled={false}
              data={Object.entries(zoneStates)}
              keyExtractor={([zoneId]) => zoneId}
              renderItem={({item: [zoneId, isInside]}) => (
                <View style={styles.card}>
                  <Text style={styles.value}>{zoneId}</Text>
                  <View style={[styles.row, {marginBottom: 0, marginTop: spacing.md}]}>
                    <Text style={styles.label}>
                      Status: {isInside ? 'Inside' : 'Outside'}
                    </Text>
                    <View
                      style={[
                        styles.badge,
                        isInside
                          ? styles.successBadge
                          : styles.badgeInactive,
                      ]}>
                      <Text style={styles.badgeText}>
                        {isInside ? 'IN' : 'OUT'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            />
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.sectionTitle}>Events</Text>
            <TouchableOpacity onPress={clearEvents}>
              <Text style={{color: colors.accent, fontWeight: '600'}}>
                Clear
              </Text>
            </TouchableOpacity>
          </View>
          {eventLog.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.value}>No events recorded</Text>
            </View>
          ) : (
            <FlatList
              scrollEnabled={false}
              data={eventLog}
              keyExtractor={item => item.id}
              renderItem={({item}) => {
                const date = new Date(item.timestamp);
                const time = date.toLocaleTimeString();
                return (
                  <View style={styles.card}>
                    <View style={styles.row}>
                      <View style={styles.flexGrow}>
                        <Text style={styles.label}>{item.zoneName}</Text>
                        <Text style={styles.value}>{item.type}</Text>
                      </View>
                      <Text style={styles.small}>{time}</Text>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
