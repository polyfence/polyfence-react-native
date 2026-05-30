import React, { useState, useCallback, useEffect } from 'react';
import { TouchableOpacity, Share, StyleSheet } from 'react-native';
import { Share2 } from 'lucide-react-native';
import { LogBuffer } from '../services/LogBuffer';
import { Colors, Spacing } from '../theme';
import CountBadge from './CountBadge';

const BADGE_REFRESH_MS = 5_000;

export default function LogExportButton() {
  const [logCount, setLogCount] = useState(LogBuffer.count);

  // Periodically refresh the badge count
  useEffect(() => {
    const interval = setInterval(() => {
      setLogCount(LogBuffer.count);
    }, BADGE_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const text = LogBuffer.buildExportText();
      if (text.trim().length === 0) return;

      await Share.share({
        message: text,
        title: `Polyfence Logs - ${LogBuffer.deviceName}`,
      });
    } catch {
      // User cancelled or share sheet failed
    }
  }, []);

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleExport}
      activeOpacity={0.7}
    >
      <Share2 size={20} color={Colors.foreground} />
      <CountBadge count={logCount} max={999} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
});
