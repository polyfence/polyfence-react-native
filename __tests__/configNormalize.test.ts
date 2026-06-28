import {
  normalizeConfigEnums,
  snakeUpperToLowerCamel,
} from '../src/configNormalize';

describe('snakeUpperToLowerCamel', () => {
  it.each([
    // Real enum values emitted by polyfence-core on both platforms (BUG-007)
    ['BALANCED', 'balanced'],
    ['MAX_ACCURACY', 'maxAccuracy'],
    ['BATTERY_OPTIMAL', 'batteryOptimal'],
    ['ADAPTIVE', 'adaptive'],
    ['CONTINUOUS', 'continuous'],
    ['PROXIMITY_BASED', 'proximityBased'],
    ['MOVEMENT_BASED', 'movementBased'],
    ['INTELLIGENT', 'intelligent'],
  ])('converts %s -> %s', (input, expected) => {
    expect(snakeUpperToLowerCamel(input)).toBe(expected);
  });

  it('is idempotent on already-lowerCamelCase input', () => {
    expect(snakeUpperToLowerCamel('balanced')).toBe('balanced');
    expect(snakeUpperToLowerCamel('maxAccuracy')).toBe('maxAccuracy');
  });

  it('returns empty string unchanged', () => {
    expect(snakeUpperToLowerCamel('')).toBe('');
  });

  it('collapses repeated and trailing underscores without producing empty parts', () => {
    expect(snakeUpperToLowerCamel('MAX__ACCURACY')).toBe('maxAccuracy');
    expect(snakeUpperToLowerCamel('MAX_ACCURACY_')).toBe('maxAccuracy');
    expect(snakeUpperToLowerCamel('_MAX_ACCURACY')).toBe('maxAccuracy');
  });
});

describe('normalizeConfigEnums', () => {
  it('lowercases known enum keys to the TS contract', () => {
    const native = {
      accuracyProfile: 'BALANCED',
      updateStrategy: 'PROXIMITY_BASED',
      enableDebugLogging: false,
    };
    const result = normalizeConfigEnums(native);
    expect(result.accuracyProfile).toBe('balanced');
    expect(result.updateStrategy).toBe('proximityBased');
    expect(result.enableDebugLogging).toBe(false);
  });

  it('passes nested settings objects through unchanged (they contain numeric/boolean fields, not enums)', () => {
    const nested = {
      activeRadiusMeters: 5000,
      refreshDistanceMeters: 1000,
      enabled: true,
    };
    const native = {
      accuracyProfile: 'MAX_ACCURACY',
      clusterSettings: nested,
    };
    const result = normalizeConfigEnums(native);
    expect(result.clusterSettings).toBe(nested);
    expect(result.accuracyProfile).toBe('maxAccuracy');
  });

  it('does not mutate the input object', () => {
    const native = { accuracyProfile: 'BALANCED' };
    const result = normalizeConfigEnums(native);
    expect(native.accuracyProfile).toBe('BALANCED');
    expect(result.accuracyProfile).toBe('balanced');
    expect(result).not.toBe(native);
  });

  it('leaves non-enum string keys alone even if they look UPPERCASE', () => {
    const native = {
      accuracyProfile: 'BALANCED',
      // Hypothetical future field with an uppercase string that is NOT an enum
      someUnrelatedField: 'KEEP_AS_IS',
    };
    const result = normalizeConfigEnums(native);
    expect(result.accuracyProfile).toBe('balanced');
    expect(result.someUnrelatedField).toBe('KEEP_AS_IS');
  });

  it('handles already-normalized iOS-or-future-platform output idempotently', () => {
    const native = {
      accuracyProfile: 'balanced',
      updateStrategy: 'proximityBased',
    };
    const result = normalizeConfigEnums(native);
    expect(result.accuracyProfile).toBe('balanced');
    expect(result.updateStrategy).toBe('proximityBased');
  });

  it('ignores enum keys whose values are not strings', () => {
    const native = {
      accuracyProfile: null,
      updateStrategy: undefined,
    } as unknown as Record<string, unknown>;
    const result = normalizeConfigEnums(native);
    expect(result.accuracyProfile).toBeNull();
    expect(result.updateStrategy).toBeUndefined();
  });
});
