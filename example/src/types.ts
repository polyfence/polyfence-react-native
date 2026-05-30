export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type TrackingStatus = 'active' | 'inactive' | 'error';

export type GpsProfile = 'max' | 'balanced' | 'battery' | 'smart';

export const GPS_PROFILES: Record<GpsProfile, {
  label: string;
  description: string;
  interval: string;
  icon: string;
  accuracyProfile: import('polyfence-react-native').AccuracyProfile;
}> = {
  max: {
    label: 'Max',
    description: 'Highest accuracy, requests every 5s',
    interval: '5s',
    icon: 'zap',
    accuracyProfile: 'maxAccuracy',
  },
  balanced: {
    label: 'Balanced',
    description: 'Balanced accuracy, requests every 10s',
    interval: '10s',
    icon: 'activity',
    accuracyProfile: 'balanced',
  },
  battery: {
    label: 'Battery',
    description: 'Lower accuracy, requests every 30s',
    interval: '30s',
    icon: 'battery',
    accuracyProfile: 'batteryOptimal',
  },
  smart: {
    label: 'Smart',
    description: 'Adaptive accuracy, varies by movement',
    interval: '~10s',
    icon: 'target',
    accuracyProfile: 'adaptive',
  },
};

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface AppZone {
  id: string;
  name: string;
  type: 'circle' | 'polygon';
  center?: LatLng;
  radius?: number;
  polygon?: LatLng[];
  distance?: number;
  isInside?: boolean;
}

export interface AppGeofenceEvent {
  id: string;
  timestamp: Date;
  type: 'enter' | 'exit' | 'dwell' | 'error';
  zoneName: string;
  zoneId: string;
  message?: string;
}
