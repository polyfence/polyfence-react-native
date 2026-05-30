import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, Map } from 'lucide-react-native';
import { Colors, Fonts, Shadows } from './theme';
import { usePolyfence } from './hooks/usePolyfence';
import { LogBuffer } from './services/LogBuffer';
import DashboardScreen from './screens/DashboardScreen';
import MapScreen from './screens/MapScreen';
import LogExportButton from './components/LogExportButton';
import BellButton from './components/BellButton';

// Note: we previously monkey-patched Text.render to inject Space Grotesk as
// the default fontFamily. That approach is unreliable in Hermes release
// bundles (the patch silently drops in some configurations). Every Text
// style in the codebase now sets `fontFamily` explicitly via `Fonts.*` so
// brand typography is guaranteed without runtime tricks.

const Tab = createBottomTabNavigator();

function TrackingDot({ isTracking }: { isTracking: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isTracking) {
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
  }, [isTracking, opacity]);

  return (
    <Animated.View
      style={[
        styles.trackingDot,
        {
          opacity,
          backgroundColor: Colors.white,
        },
      ]}
    />
  );
}

function CustomTabBar({
  state,
  navigation,
  isTracking,
  onTrackingPress,
}: BottomTabBarProps & { isTracking: boolean; onTrackingPress: () => void }) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <View style={[styles.tabBarOuter, { paddingBottom: bottomPadding }]}>
      {/* Tab row with center button inline */}
      <View style={styles.tabRow}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const color = isFocused ? Colors.primary : Colors.mutedForeground;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <React.Fragment key={route.key}>
              {/* Center tracking button between tabs */}
              {index === 1 && (
                <View style={styles.centerButtonContainer}>
                  <TouchableOpacity
                    style={[
                      styles.trackingButton,
                      isTracking ? styles.trackingButtonStop : styles.trackingButtonStart,
                    ]}
                    onPress={onTrackingPress}
                    activeOpacity={0.8}
                  >
                    <TrackingDot isTracking={isTracking} />
                    <Text style={styles.trackingButtonText}>
                      {isTracking ? 'Stop' : 'Start'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={styles.tabItem}
                onPress={onPress}
                activeOpacity={0.7}
              >
                {route.name === 'Dashboard' ? (
                  <LayoutDashboard size={20} color={color} />
                ) : (
                  <Map size={20} color={color} />
                )}
                <Text style={[styles.tabLabel, { color }]}>
                  {route.name}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

// Two-line brand title rendered as the app-bar title on every tab.
// Shared between Dashboard + Map screens via the headerTitle prop.
function renderHeaderTitle() {
  return (
    <View>
      <Text style={styles.headerTitle}>Polyfence</Text>
      <Text style={styles.headerSubtitle}>React Native Example App</Text>
    </View>
  );
}

function AppContent() {
  const [polyfenceState, actions] = usePolyfence();
  // Error banner visibility lives at the app root so the header bell and
  // the dashboard banner share the same toggle.
  const [errorsVisible, setErrorsVisible] = useState(true);

  useEffect(() => {
    LogBuffer.initialize();
    return () => {
      LogBuffer.dispose();
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
        },
        headerTitleStyle: {
          fontSize: 20,
          fontFamily: Fonts.semibold,
          color: Colors.foreground,
        },
      }}
      tabBar={(props) => (
        <CustomTabBar
          {...props}
          isTracking={polyfenceState.isTracking}
          onTrackingPress={actions.toggleTracking}
        />
      )}
    >
      <Tab.Screen
        name="Dashboard"
        options={{
          // Two-line title (brand + subtitle) — shared with the Map tab so
          // the app bar is identical across both.
          headerTitle: renderHeaderTitle,
          headerTitleAlign: 'left',
          // Share (log export) + bell (error banner toggle) live in the
          // app bar. Bell badge only renders when error count > 0;
          // tapping always toggles regardless of count.
          headerRight: () => (
            <View style={styles.headerRightGroup}>
              <LogExportButton />
              <BellButton
                errorCount={polyfenceState.errors.length}
                onToggle={() => setErrorsVisible((v) => !v)}
              />
            </View>
          ),
        }}
      >
        {() => (
          <DashboardScreen
            state={polyfenceState}
            actions={actions}
            errorsVisible={errorsVisible}
            onDismissBanner={() => setErrorsVisible(false)}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Map"
        options={{
          // Same 2-line title as the Dashboard tab so both tabs share one
          // identical app bar.
          headerTitle: renderHeaderTitle,
          headerTitleAlign: 'left',
        }}
      >
        {() => <MapScreen state={polyfenceState} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppContent />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.semibold,
    color: Colors.foreground,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.mutedForeground,
    marginTop: 2,
    // Breathing room under the subtitle so the AppBar bottom edge isn't
    // hugging the text.
    marginBottom: 4,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabBarOuter: {
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    gap: 3,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: Fonts.medium,
  },
  // Circular FAB centered between the two tabs with a small white dot
  // above the Stop/Start label. marginTop -40 lifts the 96dp button fully
  // above the 56dp tab row (40 + 56 = 96, exact fit) so it never pokes
  // into the Android gesture strip / SafeArea bottom padding the way -24 did.
  centerButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -40,
    paddingHorizontal: 4,
  },
  trackingButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    ...Shadows.fab,
  },
  trackingButtonStart: {
    backgroundColor: Colors.primary,
  },
  trackingButtonStop: {
    backgroundColor: Colors.destructive,
  },
  trackingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 6,
  },
  trackingButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: Fonts.semibold,
  },
});
