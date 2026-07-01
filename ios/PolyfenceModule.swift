import React
import UIKit
import CoreLocation
import PolyfenceCore

@objc(Polyfence)
class PolyfenceModule: RCTEventEmitter, PolyfenceCoreDelegate {

    private static let prefsName = "polyfence_state"
    private static let keyTrackingEnabled = "tracking_enabled"

    // Process-wide singletons so the tracker + persistence outlive any
    // single PolyfenceModule instance.
    //
    // RCTEventEmitter modules can be deallocated and re-created across an
    // RN bridge reload or — more importantly here — when iOS suspends the
    // app and later wakes it (significant-location change, background
    // fetch) before the JS bridge boots. If the LocationTracker is owned
    // solely by the bridge module, that wake-up arrives at a delegate
    // that's already nil; CLLocationManager has nothing to forward to and
    // the location is dropped. Events for the next zone the user crosses
    // get lost.
    //
    // Holding the tracker statically here keeps CLLocationManager + its
    // delegate alive for the lifetime of the app process. When a new
    // PolyfenceModule materialises (new bridge), `initialize()` reuses
    // the existing tracker and just re-wires `coreDelegate` to the new
    // bridge. iOS Flutter doesn't hit this because its FlutterAppDelegate
    // retains the plugin instance across Dart isolate restarts.
    private static var sharedLocationTracker: LocationTracker?
    private static var sharedZonePersistence: ZonePersistence?

    private var locationTracker: LocationTracker?
    private var zonePersistence: ZonePersistence?

    override func supportedEvents() -> [String] {
        return ["onLocation", "onGeofenceEvent", "onError", "onPerformance"]
    }

    override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    // RCTEventEmitter gates `sendEventWithName:body:` on
    // `(_observationDisabled || _listenerCount > 0) && _callableJSModules`.
    // Under RN 0.76+ Bridgeless / New Arch the JS-side listener handshake is
    // unreliable (react-native#41394): `_listenerCount` stays 0 and every
    // event is silently dropped with "Sending '…' with no listeners".
    //
    // The Android bridge already sidesteps this by emitting directly via
    // RCTDeviceEventEmitter.emit (PolyfenceModule.kt:597-608). We do the
    // same here. `callableJSModules.invokeModule(...)` is the exact call
    // RCTEventEmitter itself uses internally (RCTEventEmitter.m:65) and
    // works in both bridge and bridgeless runtimes.
    private func emit(_ eventName: String, body: [String: Any]) {
        callableJSModules?.invokeModule(
            "RCTDeviceEventEmitter",
            method: "emit",
            withArgs: [eventName, body]
        )
    }

    // No-ops. NativeEventEmitter on the JS side calls these via codegen;
    // without `@objc override` declarations + RCT_EXTERN_METHOD re-exports
    // in PolyfenceModule.m, the New Arch codegen warns the host app at
    // runtime. We don't need the inherited bookkeeping (we bypass the
    // listener-count gate entirely via `emit` above), so these are stubs
    // that exist only to satisfy the codegen handshake.
    @objc override func addListener(_ eventName: String!) {
        // no-op
    }

    @objc override func removeListeners(_ count: Double) {
        // no-op
    }

    @objc(initialize:resolver:rejecter:)
    func initialize(config: NSDictionary?, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            if let configDict = config?["config"] as? [String: Any],
               let version = configDict["pluginVersion"] as? String {
                PolyfenceDebugCollector.shared.setPluginVersion(version)
            }

            // Reuse the process-wide tracker if it exists (the previous
            // bridge instance was deallocated but CLLocationManager and
            // its delegate are alive on the static). Just re-wire the
            // delegate to the current bridge instance and we're back in
            // business — including a wired event path for whatever
            // location updates iOS buffered while the bridge was down.
            if let existingTracker = Self.sharedLocationTracker,
               let existingPersistence = Self.sharedZonePersistence {
                zonePersistence = existingPersistence
                locationTracker = existingTracker
                existingTracker.coreDelegate = self
            } else {
                let newPersistence = ZonePersistence()
                let newTracker = LocationTracker()
                newTracker.coreDelegate = self
                newTracker.setBridgePlatform("react-native")
                Self.sharedZonePersistence = newPersistence
                Self.sharedLocationTracker = newTracker
                zonePersistence = newPersistence
                locationTracker = newTracker
            }

            if let configDict = config?["config"] as? [String: Any],
               let disableAlerts = configDict["disableAlertNotifications"] as? Bool {
                locationTracker?.setAlertNotificationsEnabled(!disableAlerts)
            }

            resolve(nil)
        } catch {
            NSLog("PolyfenceModule: Initialize failed: %@", error.localizedDescription)
            reject("INITIALIZATION_FAILED", error.localizedDescription, error)
        }
    }

    @objc(startTracking:rejecter:)
    func startTracking(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            guard let tracker = locationTracker else {
                throw NSError(domain: "PolyfenceModule", code: 1, userInfo: [NSLocalizedDescriptionKey: "Location tracker not initialized"])
            }
            tracker.startTracking()
            setTrackingEnabled(true)
            sendStatus(trackingEnabled: true)
            resolve(nil)
        } catch {
            NSLog("PolyfenceModule: Start tracking failed: %@", error.localizedDescription)
            reject("START_TRACKING_FAILED", error.localizedDescription, error)
        }
    }

    @objc(stopTracking:rejecter:)
    func stopTracking(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            guard let tracker = locationTracker else {
                throw NSError(domain: "PolyfenceModule", code: 2, userInfo: [NSLocalizedDescriptionKey: "Location tracker not initialized"])
            }
            tracker.stopTracking()
            setTrackingEnabled(false)
            sendStatus(trackingEnabled: false)
            resolve(nil)
        } catch {
            NSLog("PolyfenceModule: Stop tracking failed: %@", error.localizedDescription)
            reject("STOP_TRACKING_FAILED", error.localizedDescription, error)
        }
    }

    @objc(addZone:resolver:rejecter:)
    func addZone(zoneData: NSDictionary?, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            guard let zoneDict = zoneData as? [String: Any],
                  let zoneId = zoneDict["id"] as? String,
                  let zoneName = zoneDict["name"] as? String else {
                throw NSError(domain: "PolyfenceModule", code: 3, userInfo: [NSLocalizedDescriptionKey: "Invalid zone data"])
            }

            guard let tracker = locationTracker else {
                throw NSError(domain: "PolyfenceModule", code: 4, userInfo: [NSLocalizedDescriptionKey: "Location tracker not initialized"])
            }

            tracker.addZone(zoneId: zoneId, zoneName: zoneName, zoneData: zoneDict)
            sendStatus(trackingEnabled: nil)
            resolve(nil)
        } catch {
            NSLog("PolyfenceModule: Add zone failed: %@", error.localizedDescription)
            reject("ADD_ZONE_FAILED", error.localizedDescription, error)
        }
    }

    @objc(removeZone:resolver:rejecter:)
    func removeZone(zoneId: String?, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            guard let zoneId = zoneId, !zoneId.isEmpty else {
                throw NSError(domain: "PolyfenceModule", code: 5, userInfo: [NSLocalizedDescriptionKey: "Zone ID is required"])
            }

            guard let tracker = locationTracker else {
                throw NSError(domain: "PolyfenceModule", code: 6, userInfo: [NSLocalizedDescriptionKey: "Location tracker not initialized"])
            }

            tracker.removeZone(zoneId: zoneId)
            sendStatus(trackingEnabled: nil)
            resolve(nil)
        } catch {
            NSLog("PolyfenceModule: Remove zone failed: %@", error.localizedDescription)
            reject("REMOVE_ZONE_FAILED", error.localizedDescription, error)
        }
    }

    @objc(removeAllZones:rejecter:)
    func removeAllZones(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            guard let tracker = locationTracker else {
                throw NSError(domain: "PolyfenceModule", code: 7, userInfo: [NSLocalizedDescriptionKey: "Location tracker not initialized"])
            }

            tracker.clearAllZones()
            sendStatus(trackingEnabled: nil)
            resolve(nil)
        } catch {
            NSLog("PolyfenceModule: Clear zones failed: %@", error.localizedDescription)
            reject("CLEAR_ZONES_FAILED", error.localizedDescription, error)
        }
    }

    @objc(getZoneStates:rejecter:)
    func getZoneStates(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            guard let tracker = locationTracker else {
                throw NSError(domain: "PolyfenceModule", code: 8, userInfo: [NSLocalizedDescriptionKey: "Location tracker not initialized"])
            }

            let states = tracker.getCurrentZoneStates()
            let saved = zonePersistence?.loadAllZones() ?? [:]
            var result: [[String: Any]] = []
            for (zoneId, isInside) in states {
                let zoneName = saved[zoneId]?.1 ?? zoneId
                result.append([
                    "zoneId": zoneId,
                    "zoneName": zoneName,
                    "isInside": isInside,
                ])
            }

            resolve(result)
        } catch {
            NSLog("PolyfenceModule: Get zone states failed: %@", error.localizedDescription)
            reject("ZONE_STATES_FAILED", error.localizedDescription, error)
        }
    }

    @objc(getDebugInfo:rejecter:)
    func getDebugInfo(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            let debugInfo = PolyfenceDebugCollector.shared.collectDebugInfo()
            resolve(debugInfo)
        } catch {
            NSLog("PolyfenceModule: Get debug info failed: %@", error.localizedDescription)
            reject("DEBUG_INFO_FAILED", error.localizedDescription, error)
        }
    }

    @objc(getSessionTelemetry:rejecter:)
    func getSessionTelemetry(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            guard let tracker = locationTracker else {
                throw NSError(domain: "PolyfenceModule", code: 9, userInfo: [NSLocalizedDescriptionKey: "Location tracker not initialized"])
            }

            var telemetry = tracker.getSessionTelemetryData()
            telemetry["deviceCategory"] = Self.getDeviceCategory()
            telemetry["osVersionMajor"] = ProcessInfo.processInfo.operatingSystemVersion.majorVersion
            telemetry["chargingDuringSession"] = UIDevice.current.batteryState == .charging || UIDevice.current.batteryState == .full
            // Stamp the host app's bundle id so telemetry is attributed. core leaves
            // appIdentifier nil; the Flutter SDK resolves this itself. Without this,
            // every React Native session lands as app_identifier 'unknown'.
            if let bundleId = Bundle.main.bundleIdentifier {
                telemetry["app_identifier"] = bundleId
            }
            resolve(telemetry)
        } catch {
            NSLog("PolyfenceModule: Get session telemetry failed: %@", error.localizedDescription)
            reject("TELEMETRY_FAILED", error.localizedDescription, error)
        }
    }

    @objc(setTrackingSchedule:resolver:rejecter:)
    func setTrackingSchedule(schedule: NSDictionary?, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            guard let scheduleDict = schedule as? [String: Any] else {
                throw NSError(domain: "PolyfenceModule", code: 10, userInfo: [NSLocalizedDescriptionKey: "Schedule is required"])
            }

            guard let tracker = locationTracker else {
                throw NSError(domain: "PolyfenceModule", code: 11, userInfo: [NSLocalizedDescriptionKey: "Location tracker not initialized"])
            }

            tracker.setScheduleConfig(scheduleDict)

            resolve(nil)
        } catch {
            NSLog("PolyfenceModule: Set tracking schedule failed: %@", error.localizedDescription)
            reject("SCHEDULE_FAILED", error.localizedDescription, error)
        }
    }

    @objc(clearTrackingSchedule:rejecter:)
    func clearTrackingSchedule(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            guard let tracker = locationTracker else {
                throw NSError(domain: "PolyfenceModule", code: 12, userInfo: [NSLocalizedDescriptionKey: "Location tracker not initialized"])
            }

            tracker.clearScheduleConfig()
            resolve(nil)
        } catch {
            NSLog("PolyfenceModule: Clear tracking schedule failed: %@", error.localizedDescription)
            reject("CLEAR_SCHEDULE_FAILED", error.localizedDescription, error)
        }
    }

    @objc(requestPermissions:resolver:rejecter:)
    func requestPermissions(options: NSDictionary?, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            guard let tracker = locationTracker else {
                throw NSError(domain: "PolyfenceModule", code: 13, userInfo: [NSLocalizedDescriptionKey: "Location tracker not initialized"])
            }

            let always = (options?["always"] as? Bool) ?? false
            tracker.requestPermissions(always: always)

            // Check authorization status immediately after requesting.
            // Note: the system dialog is async, so status at call time may still be .notDetermined
            // if the user hasn't responded. Return false for not-yet-determined state.
            let authorizationStatus = CLLocationManager.authorizationStatus()
            let granted = (authorizationStatus == .authorizedAlways || authorizationStatus == .authorizedWhenInUse)
            resolve(granted)
        } catch {
            NSLog("PolyfenceModule: Request permissions failed: %@", error.localizedDescription)
            reject("PERMISSION_FAILED", error.localizedDescription, error)
        }
    }

    @objc(isLocationServiceEnabled:rejecter:)
    func isLocationServiceEnabled(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        resolve(CLLocationManager.locationServicesEnabled())
    }

    @objc(getConfiguration:rejecter:)
    func getConfiguration(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            guard let tracker = locationTracker else {
                throw NSError(domain: "PolyfenceModule", code: 14, userInfo: [NSLocalizedDescriptionKey: "Location tracker not initialized"])
            }

            let smartConfig = tracker.getCurrentSmartConfiguration()
            let configMap = SmartGpsConfigFactory.toMap(smartConfig)
            resolve(configMap)
        } catch {
            NSLog("PolyfenceModule: Get configuration failed: %@", error.localizedDescription)
            reject("CONFIG_FAILED", error.localizedDescription, error)
        }
    }

    @objc(updateConfiguration:resolver:rejecter:)
    func updateConfiguration(configMap: NSDictionary?, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            guard let configDict = configMap as? [String: Any] else {
                throw NSError(domain: "PolyfenceModule", code: 15, userInfo: [NSLocalizedDescriptionKey: "Invalid configuration data"])
            }

            guard let tracker = locationTracker else {
                throw NSError(domain: "PolyfenceModule", code: 16, userInfo: [NSLocalizedDescriptionKey: "Location tracker not initialized"])
            }

            // BUG-015: route through the merge-aware core method so
            // partial updates preserve unspecified fields instead of
            // resetting them to SmartGpsConfig data-class defaults.
            // Android's map handler already merges internally; this is
            // the iOS-side companion.
            tracker.updateSmartConfigurationFromMap(configDict)

            if let gpsAccuracyThreshold = configDict["gpsAccuracyThreshold"] as? Double {
                tracker.setGpsAccuracyThreshold(gpsAccuracyThreshold)
            }

            if let dwellSettings = configDict["dwellSettings"] as? [String: Any] {
                let dwellEnabled = dwellSettings["enabled"] as? Bool ?? true
                let dwellThresholdMs = dwellSettings["dwellThresholdMs"] as? Int ?? 300000
                tracker.setDwellConfig(enabled: dwellEnabled, thresholdMs: dwellThresholdMs)
            }

            if let clusterSettings = configDict["clusterSettings"] as? [String: Any] {
                let clusterEnabled = clusterSettings["enabled"] as? Bool ?? false
                let activeRadiusMeters = clusterSettings["activeRadiusMeters"] as? Double ?? 5000.0
                let refreshDistanceMeters = clusterSettings["refreshDistanceMeters"] as? Double ?? 1000.0
                tracker.setClusterConfig(enabled: clusterEnabled, activeRadiusMeters: activeRadiusMeters, refreshDistanceMeters: refreshDistanceMeters)
            }

            if let scheduleSettings = configDict["scheduleSettings"] as? [String: Any] {
                tracker.setScheduleConfig(scheduleSettings)
            }

            if let activitySettings = configDict["activitySettings"] as? [String: Any] {
                tracker.setActivityConfig(activitySettings)
            }

            resolve(nil)
        } catch {
            NSLog("PolyfenceModule: Update configuration failed: %@", error.localizedDescription)
            reject("CONFIG_FAILED", error.localizedDescription, error)
        }
    }

    @objc(resetConfiguration:rejecter:)
    func resetConfiguration(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            guard let tracker = locationTracker else {
                throw NSError(domain: "PolyfenceModule", code: 17, userInfo: [NSLocalizedDescriptionKey: "Location tracker not initialized"])
            }

            tracker.resetSmartConfiguration()
            resolve(nil)
        } catch {
            NSLog("PolyfenceModule: Reset configuration failed: %@", error.localizedDescription)
            reject("CONFIG_FAILED", error.localizedDescription, error)
        }
    }

    @objc(setAccuracyProfile:resolver:rejecter:)
    func setAccuracyProfile(profileName: String?, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            guard let profile = profileName else {
                throw NSError(domain: "PolyfenceModule", code: 18, userInfo: [NSLocalizedDescriptionKey: "Accuracy profile value required"])
            }

            guard let tracker = locationTracker else {
                throw NSError(domain: "PolyfenceModule", code: 19, userInfo: [NSLocalizedDescriptionKey: "Location tracker not initialized"])
            }

            let normalized = normalizeEnumValue(profile)
            let currentConfig = tracker.getCurrentSmartConfiguration()
            guard let targetProfile = SmartGpsConfig.AccuracyProfile.allCases.first(where: {
                normalizeEnumValue($0.rawValue) == normalized
            }) else {
                throw NSError(
                    domain: "PolyfenceModule",
                    code: 20,
                    userInfo: [NSLocalizedDescriptionKey: "Unknown accuracy profile: \"\(profile)\". Valid values: maxAccuracy, balanced, batteryOptimal, adaptive."]
                )
            }

            let updatedConfig = SmartGpsConfig(
                accuracyProfile: targetProfile,
                updateStrategy: currentConfig.updateStrategy,
                proximitySettings: currentConfig.proximitySettings,
                movementSettings: currentConfig.movementSettings,
                batterySettings: currentConfig.batterySettings,
                enableDebugLogging: currentConfig.enableDebugLogging
            )

            tracker.updateSmartConfiguration(updatedConfig)
            resolve(nil)
        } catch {
            NSLog("PolyfenceModule: Set accuracy profile failed: %@", error.localizedDescription)
            reject("CONFIG_FAILED", error.localizedDescription, error)
        }
    }

    @objc(getErrorHistory:resolver:rejecter:)
    func getErrorHistory(options: NSDictionary?, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        let limit = (options?["limit"] as? Int) ?? 50
        let timeRangeMs: Int64? = {
            if let n = options?["timeRangeMs"] as? NSNumber {
                return n.int64Value
            }
            return nil
        }()
        let errorTypes = options?["errorTypes"] as? [String]
        var history = PolyfenceDebugCollector.shared.getErrorHistory(timeRangeMs: timeRangeMs, errorTypes: errorTypes)
        if limit > 0, history.count > limit {
            history = Array(history.suffix(limit))
        }
        resolve(history)
    }

    @objc(batteryOptimizationStatus:rejecter:)
    func batteryOptimizationStatus(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        resolve(["isIgnoringOptimizations": true, "manufacturer": "Apple"])
    }

    @objc(requestBatteryOptimizationExemption:rejecter:)
    func requestBatteryOptimizationExemption(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        resolve(true)
    }

    @objc(dispose:rejecter:)
    func dispose(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        // Explicit dispose() from JS *does* tear the tracker down — user
        // is opting out. Clears the static so a later initialize() builds
        // a fresh tracker.
        locationTracker?.stopTracking()
        setTrackingEnabled(false)
        locationTracker?.coreDelegate = nil
        locationTracker = nil
        zonePersistence = nil
        Self.sharedLocationTracker = nil
        Self.sharedZonePersistence = nil
        resolve(nil)
    }

    // MARK: - Private Helper Methods

    private func setTrackingEnabled(_ enabled: Bool) {
        UserDefaults.standard.set(enabled, forKey: Self.keyTrackingEnabled)
    }

    private func normalizeEnumValue(_ value: String) -> String {
        let uppercased = value.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let filtered = uppercased.unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) }
        return String(String.UnicodeScalarView(filtered))
    }

    // MARK: - PolyfenceCoreDelegate Implementation

    func onGeofenceEvent(_ eventData: [String: Any]) {
        sendGeofenceEvent(eventData)
    }

    func onLocationUpdate(_ locationData: [String: Any]) {
        sendLocationEvent(locationData)
    }

    func onPerformanceEvent(_ performanceData: [String: Any]) {
        sendPerformanceEvent(performanceData)
    }

    func onError(_ errorData: [String: Any]) {
        sendErrorEvent(errorData)
    }

    func isTrackingEnabled() -> Bool {
        let defaults = UserDefaults.standard
        return defaults.bool(forKey: Self.keyTrackingEnabled)
    }

    // MARK: - Private Event Sending Methods
    //
    // All four event helpers route through the `emit` shim, which calls
    // `RCTDeviceEventEmitter.emit` directly. See the `emit` declaration
    // above for why we bypass RCTEventEmitter.sendEventWithName:body:.

    private func sendLocationEvent(_ locationData: [String: Any]) {
        emit("onLocation", body: locationData)
    }

    private func sendGeofenceEvent(_ eventData: [String: Any]) {
        emit("onGeofenceEvent", body: eventData)
    }

    private func sendErrorEvent(_ errorData: [String: Any]) {
        emit("onError", body: errorData)
    }

    private func sendPerformanceEvent(_ eventData: [String: Any]) {
        emit("onPerformance", body: eventData)
    }

    private func sendStatus(trackingEnabled: Bool?) {
        let zonesCount = (try? zonePersistence?.getZoneCount()) ?? 0
        // Query actual tracking state if not explicitly passed.
        // LocationTracker.isTracking() returns true if tracking is actively running.
        let tracking = trackingEnabled ?? (locationTracker?.isTracking() ?? false)
        let payload: [String: Any?] = [
            "type": "status",
            "trackingEnabled": tracking,
            "zonesCount": zonesCount,
            "profile": nil,
            "lastAccuracy": nil,
            "timestamp": Int64(Date().timeIntervalSince1970 * 1000)
        ]
        sendPerformanceEvent(payload as [String: Any])
    }

    // MARK: - Device Category Detection

    private static func getDeviceCategory() -> String {
        var systemInfo = utsname()
        uname(&systemInfo)
        let machine = withUnsafePointer(to: &systemInfo.machine) {
            $0.withMemoryRebound(to: CChar.self, capacity: 1) {
                String(validatingUTF8: $0) ?? "unknown"
            }
        }

        if machine.hasPrefix("iPhone") {
            let parts = machine.replacingOccurrences(of: "iPhone", with: "").split(separator: ",")
            if let first = parts.first {
                let modelNum = Int(first) ?? 0
                return categorizeIPhoneModel(modelNum)
            }
        } else if machine.hasPrefix("iPad") {
            return "ipad"
        }
        return "ios_other"
    }

    private static func categorizeIPhoneModel(_ modelNumber: Int) -> String {
        switch modelNumber {
        case 15, 16:
            return "iphone_15"
        case 14, 13:
            return "iphone_14_13"
        case 12, 11:
            return "iphone_12_11"
        default:
            return "iphone_older"
        }
    }
}
