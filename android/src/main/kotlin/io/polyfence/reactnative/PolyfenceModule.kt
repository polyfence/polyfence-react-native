package io.polyfence.reactnative

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.SharedPreferences
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import io.polyfence.core.LocationTracker
import io.polyfence.core.PolyfenceCoreDelegate
import io.polyfence.core.PolyfenceErrorManager
import io.polyfence.core.PolyfenceDebugCollector
import io.polyfence.core.ZonePersistence
import io.polyfence.core.configuration.ActivitySettings
import io.polyfence.core.configuration.SmartGpsConfig
import io.polyfence.core.configuration.SmartGpsConfigFactory
import java.util.Locale

/**
 * React Native module for Polyfence geofencing bridge.
 * Implements PolyfenceCoreDelegate to receive events from LocationTracker.
 * Single responsibility: React ↔ LocationTracker communication.
 */
class PolyfenceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), PolyfenceCoreDelegate {

    companion object {
        private const val PREFS_NAME = "polyfence_state"
        private const val KEY_TRACKING_ENABLED = "tracking_enabled"
    }

    private val context: Context = reactContext

    override fun getName(): String = "Polyfence"

    @ReactMethod
    fun initialize(config: ReadableMap?, promise: Promise) {
        try {
            val configMap = config?.toHashMap() ?: mapOf()

            val version = (configMap["config"] as? Map<*, *>)?.get("pluginVersion") as? String
            if (version != null) {
                PolyfenceDebugCollector.setPluginVersion(version)
            }

            val disableAlerts = (configMap["config"] as? Map<*, *>)?.get("disableAlertNotifications") as? Boolean ?: false
            LocationTracker.setAlertNotificationsEnabled(!disableAlerts)

            LocationTracker.setPendingCoreDelegate(this)
            LocationTracker.setBridgePlatform("react-native")

            PolyfenceErrorManager.initialize { errorMap ->
                sendErrorEvent(errorMap)
            }

            // BUG-001 upgrade-path hygiene. The `tracking_enabled` SharedPref
            // persists across app launches and only flips false on explicit
            // stopTracking()/dispose(). A consumer who hit BUG-001 on an
            // earlier release left that flag stuck at true; without this
            // reset, the first addZone() in the new session still routes
            // through the Intent/service path before startTracking() is
            // ever called again. iOS doesn't have this persistence (the
            // tracker is process-scoped), so resetting here matches iOS.
            // startTracking() re-arms the flag immediately, so this is a
            // no-op for callers who follow the documented init → start
            // sequence.
            setTrackingEnabled(context, false)

            promise.resolve(null)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Initialization failed: ${e.message}")
            promise.reject("INITIALIZATION_FAILED", e.message)
        }
    }

    @ReactMethod
    fun startTracking(promise: Promise) {
        try {
            setTrackingEnabled(context, true)
            val intent = Intent(context, LocationTracker::class.java).apply {
                action = LocationTracker.ACTION_START_TRACKING
            }
            context.startForegroundService(intent)
            sendStatus(context)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to start tracking: ${e.message}")
            promise.reject("START_TRACKING_FAILED", e.message)
        }
    }

    @ReactMethod
    fun stopTracking(promise: Promise) {
        try {
            setTrackingEnabled(context, false)
            val intent = Intent(context, LocationTracker::class.java).apply {
                action = LocationTracker.ACTION_STOP_TRACKING
            }
            context.startService(intent)
            sendStatus(context)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to stop tracking: ${e.message}")
            promise.reject("STOP_TRACKING_FAILED", e.message)
        }
    }

    @ReactMethod
    fun addZone(zoneData: ReadableMap?, promise: Promise) {
        try {
            val zoneMap = zoneData?.toHashMap() ?: run {
                promise.reject("INVALID_ZONE", "Zone data is required")
                return
            }

            val zoneId = zoneMap["id"] as? String ?: run {
                promise.reject("INVALID_ZONE", "Zone ID is required")
                return
            }

            val zoneName = zoneMap["name"] as? String ?: "Unknown Zone"

            if (!isTrackingEnabled(context)) {
                try {
                    val persistence = ZonePersistence(context)
                    persistence.saveZone(zoneId, zoneName, zoneMap)
                } catch (e: Exception) {
                    Log.w("PolyfenceModule", "Failed to persist zone $zoneId: ${e.message}")
                }
                sendStatus(context)
                promise.resolve(null)
                return
            }

            val intent = Intent(context, LocationTracker::class.java).apply {
                action = LocationTracker.ACTION_ADD_ZONE
                putExtra("zoneId", zoneId)
                putExtra("zoneName", zoneName)
                putExtra("zoneData", HashMap(zoneMap))
            }
            context.startService(intent)
            sendStatus(context)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to add zone: ${e.message}")
            promise.reject("ADD_ZONE_FAILED", e.message)
        }
    }

    @ReactMethod
    fun removeZone(zoneId: String?, promise: Promise) {
        try {
            if (zoneId.isNullOrBlank()) {
                promise.reject("INVALID_ZONE_ID", "Zone ID is required")
                return
            }

            val intent = Intent(context, LocationTracker::class.java).apply {
                action = LocationTracker.ACTION_REMOVE_ZONE
                putExtra("zoneId", zoneId)
            }
            context.startService(intent)
            sendStatus(context)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to remove zone: ${e.message}")
            promise.reject("REMOVE_ZONE_FAILED", e.message)
        }
    }

    @ReactMethod
    fun removeAllZones(promise: Promise) {
        try {
            val intent = Intent(context, LocationTracker::class.java).apply {
                action = LocationTracker.ACTION_CLEAR_ZONES
            }
            context.startService(intent)
            sendStatus(context)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to clear all zones: ${e.message}")
            promise.reject("CLEAR_ZONES_FAILED", e.message)
        }
    }

    @ReactMethod
    fun getZoneStates(promise: Promise) {
        try {
            val states = LocationTracker.getCurrentZoneStates()
            val persistence = ZonePersistence(context)
            val saved = persistence.loadAllZones()
            val result = Arguments.createArray()
            for ((zoneId, isInside) in states) {
                val entry = Arguments.createMap()
                val zoneName = saved[zoneId]?.second ?: zoneId
                entry.putString("zoneId", zoneId)
                entry.putString("zoneName", zoneName)
                entry.putBoolean("isInside", isInside)
                result.pushMap(entry)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to get zone states: ${e.message}")
            promise.reject("ZONE_STATES_FAILED", e.message)
        }
    }

    @ReactMethod
    fun getDebugInfo(promise: Promise) {
        try {
            val debugInfo = PolyfenceDebugCollector.collectDebugInfo(context)
            promise.resolve(mapToWritableMap(debugInfo))
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to get debug info: ${e.message}")
            promise.reject("DEBUG_INFO_FAILED", e.message)
        }
    }

    @ReactMethod
    fun getSessionTelemetry(promise: Promise) {
        try {
            val telemetry = LocationTracker.getSessionTelemetry()
            val sessionData = mutableMapOf<String, Any>()
            for ((key, value) in telemetry) {
                if (value != null) sessionData[key] = value
            }
            sessionData["deviceCategory"] = getDeviceCategory()
            sessionData["osVersionMajor"] = Build.VERSION.SDK_INT
            // Stamp the host app's package id so telemetry is attributed. core leaves
            // appIdentifier null; the Flutter SDK resolves this itself (via PackageInfo).
            // Without this, every React Native session lands as app_identifier 'unknown'.
            sessionData["app_identifier"] = context.packageName
            promise.resolve(mapToWritableMap(sessionData))
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to get session telemetry: ${e.message}")
            promise.reject("TELEMETRY_FAILED", e.message)
        }
    }

    @ReactMethod
    fun setTrackingSchedule(schedule: ReadableMap?, promise: Promise) {
        try {
            if (schedule == null) {
                promise.reject("INVALID_SCHEDULE", "Schedule is required")
                return
            }

            val scheduleMap = schedule.toHashMap()
            val intent = Intent(context, LocationTracker::class.java).apply {
                action = LocationTracker.ACTION_UPDATE_CONFIG
                putExtra("schedule", HashMap(scheduleMap))
            }
            context.startService(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to set tracking schedule: ${e.message}")
            promise.reject("SCHEDULE_FAILED", e.message)
        }
    }

    @ReactMethod
    fun clearTrackingSchedule(promise: Promise) {
        try {
            val intent = Intent(context, LocationTracker::class.java).apply {
                action = LocationTracker.ACTION_UPDATE_CONFIG
                putExtra("clearSchedule", true)
            }
            context.startService(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to clear tracking schedule: ${e.message}")
            promise.reject("CLEAR_SCHEDULE_FAILED", e.message)
        }
    }

    @ReactMethod
    fun requestPermissions(options: ReadableMap?, promise: Promise) {
        try {
            // This method checks the current permission state (granted/denied/notDetermined).
            // It does NOT show a system permission dialog on Android — that requires ActivityCompat.requestPermissions
            // with Activity access and onRequestPermissionsResult handling, which is not feasible from NativeModule.
            // For production apps, use a library like react-native-permissions to trigger the system dialog,
            // then call this method to verify the result.
            val hasPerms = hasAllRequiredPerms(context)
            promise.resolve(hasPerms)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to check permissions: ${e.message}")
            promise.reject("PERMISSIONS_FAILED", e.message)
        }
    }

    @ReactMethod
    fun isLocationServiceEnabled(promise: Promise) {
        try {
            val enabled = try {
                val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
                locationManager?.let {
                    it.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                    it.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
                } ?: false
            } catch (e: Exception) {
                Log.e("PolyfenceModule", "Error checking location services: ${e.message}")
                false
            }
            promise.resolve(enabled)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to check location services: ${e.message}")
            promise.reject("LOCATION_SERVICE_CHECK_FAILED", e.message)
        }
    }

    @ReactMethod
    fun getConfiguration(promise: Promise) {
        try {
            val config = getConfigurationMap()
            promise.resolve(mapToWritableMap(config))
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to get configuration: ${e.message}")
            promise.reject("CONFIG_GET_FAILED", e.message)
        }
    }

    @ReactMethod
    fun updateConfiguration(configData: ReadableMap?, promise: Promise) {
        try {
            if (configData == null) {
                promise.reject("INVALID_CONFIG", "Configuration data is required")
                return
            }

            val configMap = configData.toHashMap()
            val smartConfig = SmartGpsConfigFactory.fromMap(configMap)
            LocationTracker.updateSmartConfiguration(smartConfig)
            updateConfigurationInternal(configMap)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to update configuration: ${e.message}")
            promise.reject("CONFIG_UPDATE_FAILED", e.message)
        }
    }

    @ReactMethod
    fun resetConfiguration(promise: Promise) {
        try {
            val defaultConfig = SmartGpsConfig()
            LocationTracker.updateSmartConfiguration(defaultConfig)
            val configMap = SmartGpsConfigFactory.toMap(defaultConfig)
            updateConfigurationInternal(configMap)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to reset configuration: ${e.message}")
            promise.reject("CONFIG_RESET_FAILED", e.message)
        }
    }

    @ReactMethod
    fun setAccuracyProfile(profileName: String?, promise: Promise) {
        try {
            if (profileName.isNullOrBlank()) {
                promise.reject("INVALID_PROFILE", "Accuracy profile is required")
                return
            }

            val normalized = profileName
                .trim()
                .uppercase(Locale.US)
                .replace(Regex("[^A-Z0-9]"), "")

            val targetProfile = SmartGpsConfig.AccuracyProfile.values().firstOrNull { profile ->
                profile.name.uppercase(Locale.US).replace("_", "") == normalized
            }
            if (targetProfile == null) {
                promise.reject(
                    "INVALID_PROFILE",
                    "Unknown accuracy profile: \"$profileName\". Valid values: maxAccuracy, balanced, batteryOptimal, adaptive."
                )
                return
            }

            val currentConfig = LocationTracker.getCurrentSmartConfiguration()
            val updatedConfig = currentConfig.copy(accuracyProfile = targetProfile)

            LocationTracker.updateSmartConfiguration(updatedConfig)
            val configMap = SmartGpsConfigFactory.toMap(updatedConfig)
            updateConfigurationInternal(configMap)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to set accuracy profile: ${e.message}")
            promise.reject("PROFILE_SET_FAILED", e.message)
        }
    }

    @ReactMethod
    fun batteryOptimizationStatus(promise: Promise) {
        try {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            val isOptimized = powerManager.isIgnoringBatteryOptimizations(context.packageName)

            val resultMap = Arguments.createMap().apply {
                putBoolean("isIgnoringOptimizations", isOptimized)
                putString("manufacturer", Build.MANUFACTURER)
            }

            if (!isOptimized) {
                PolyfenceErrorManager.reportBatteryError(
                    context,
                    "battery_optimization_required",
                    "Battery optimization is enabled and may affect background location tracking"
                )
            }

            promise.resolve(resultMap)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to check battery optimization: ${e.message}")
            PolyfenceErrorManager.reportError(
                "battery_check_failed",
                "Failed to check battery optimization status: ${e.message}",
                mapOf("platform" to "react-native", "error" to (e.message ?: "Unknown error"))
            )
            promise.reject("BATTERY_CHECK_FAILED", e.message)
        }
    }

    @ReactMethod
    fun requestBatteryOptimizationExemption(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }

            context.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to request battery optimization exemption: ${e.message}")
            promise.reject("BATTERY_REQUEST_FAILED", e.message)
        }
    }

    @ReactMethod
    fun getErrorHistory(options: ReadableMap?, promise: Promise) {
        try {
            val timeRangeMs = if (options != null && options.hasKey("timeRangeMs") && !options.isNull("timeRangeMs")) {
                options.getDouble("timeRangeMs").toLong()
            } else null
            val errorTypes = options?.getArray("errorTypes")?.toArrayList() as? List<String>
            var history = PolyfenceDebugCollector.getErrorHistory(timeRangeMs, errorTypes)
            val limit = if (options != null && options.hasKey("limit") && !options.isNull("limit")) {
                options.getInt("limit")
            } else null
            if (limit != null && limit > 0 && history.size > limit) {
                history = history.takeLast(limit)
            }
            val result = Arguments.createArray()
            for (entry in history) {
                result.pushMap(mapToWritableMap(entry))
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to get error history: ${e.message}")
            promise.reject("ERROR_HISTORY_FAILED", e.message)
        }
    }

    @ReactMethod
    fun dispose(promise: Promise) {
        try {
            val intent = Intent(context, LocationTracker::class.java).apply {
                action = LocationTracker.ACTION_STOP_TRACKING
            }
            context.startService(intent)
            setTrackingEnabled(context, false)
            LocationTracker.setPendingCoreDelegate(null)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to dispose: ${e.message}")
            promise.reject("DISPOSE_FAILED", e.message)
        }
    }

    override fun onGeofenceEvent(eventData: Map<String, Any>) {
        sendGeofenceEvent(eventData)
    }

    override fun onLocationUpdate(locationData: Map<String, Any>) {
        sendLocationEvent(locationData)
    }

    override fun onPerformanceEvent(performanceData: Map<String, Any>) {
        sendPerformanceEvent(performanceData)
    }

    override fun onError(errorData: Map<String, Any>) {
        sendErrorEvent(errorData)
    }

    private fun mapToWritableMap(data: Map<String, Any>): WritableMap {
        val map = Arguments.createMap()
        for ((key, value) in data) {
            when (value) {
                is String -> map.putString(key, value)
                is Int -> map.putInt(key, value)
                is Double -> map.putDouble(key, value)
                is Boolean -> map.putBoolean(key, value)
                is Long -> map.putDouble(key, value.toDouble())
                is Float -> map.putDouble(key, value.toDouble())
                is Map<*, *> -> {
                    @Suppress("UNCHECKED_CAST")
                    val nested = value as? Map<String, Any>
                    if (nested != null) {
                        map.putMap(key, mapToWritableMap(nested))
                    } else {
                        map.putString(key, value.toString())
                    }
                }
                is List<*> -> {
                    map.putArray(key, listToWritableArray(value))
                }
                null -> map.putNull(key)
                else -> map.putString(key, value.toString())
            }
        }
        return map
    }

    private fun listToWritableArray(list: List<*>): WritableArray {
        val array = Arguments.createArray()
        for (item in list) {
            when (item) {
                is String -> array.pushString(item)
                is Int -> array.pushInt(item)
                is Double -> array.pushDouble(item)
                is Boolean -> array.pushBoolean(item)
                is Long -> array.pushDouble(item.toDouble())
                is Float -> array.pushDouble(item.toDouble())
                is Map<*, *> -> {
                    @Suppress("UNCHECKED_CAST")
                    val nested = item as? Map<String, Any>
                    if (nested != null) {
                        array.pushMap(mapToWritableMap(nested))
                    } else {
                        array.pushString(item.toString())
                    }
                }
                is List<*> -> array.pushArray(listToWritableArray(item))
                null -> array.pushNull()
                else -> array.pushString(item.toString())
            }
        }
        return array
    }

    private fun sendLocationEvent(locationData: Map<String, Any>) {
        try {
            sendEvent("onLocation", mapToWritableMap(locationData))
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to send location event: ${e.message}")
        }
    }

    private fun sendGeofenceEvent(eventData: Map<String, Any>) {
        try {
            sendEvent("onGeofenceEvent", mapToWritableMap(eventData))
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to send geofence event: ${e.message}")
        }
    }

    private fun sendErrorEvent(errorData: Map<String, Any>) {
        try {
            sendEvent("onError", mapToWritableMap(errorData))
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to send error event: ${e.message}")
        }
    }

    private fun sendPerformanceEvent(eventData: Map<String, Any>) {
        try {
            sendEvent("onPerformance", mapToWritableMap(eventData))
        } catch (e: Exception) {
            Log.e("PolyfenceModule", "Failed to send performance event: ${e.message}")
        }
    }

    // Required by NativeEventEmitter in RN 0.65+ / Bridgeless mode
    @ReactMethod
    fun addListener(eventName: String) {
        // No-op: event delivery is handled by sendEvent/RCTDeviceEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // No-op: cleanup handled by JS-side subscription management
    }

    /**
     * Helper: send event to React Native listeners.
     * Guards against crashes when React context is not ready or has been torn down.
     */
    private fun sendEvent(eventName: String, params: WritableMap) {
        try {
            val hasInstance = reactApplicationContext.hasActiveReactInstance()
            if (hasInstance) {
                reactApplicationContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(eventName, params)
            }
        } catch (e: Exception) {
            Log.w("PolyfenceModule", "Failed to emit event $eventName: ${e.message}")
        }
    }

    /**
     * Send status event (zone count, tracking enabled) to onPerformance
     */
    private fun sendStatus(context: Context) {
        val tracking = isTrackingEnabled(context)
        val zonesCount = try {
            val persistence = ZonePersistence(context)
            persistence.getZoneCount()
        } catch (e: Exception) { 0 }

        // BUG-013a: pull profile + lastAccuracy from polyfence-core
        // instead of hardcoding null. Pre-fix the two fields were dead
        // values that suggested data was available when it wasn't —
        // consumers reading status.profile / status.lastAccuracy always
        // got null regardless of runtime state.
        val profile = LocationTracker.getCurrentSmartConfiguration().accuracyProfile.name
        val lastAccuracy = LocationTracker.getLastKnownAccuracy()

        val statusMap = Arguments.createMap().apply {
            putString("type", "status")
            putBoolean("trackingEnabled", tracking)
            putInt("zonesCount", zonesCount)
            putString("profile", profile)
            // null until the first GPS fix lands.
            if (lastAccuracy != null) {
                putDouble("lastAccuracy", lastAccuracy.toDouble())
            } else {
                putNull("lastAccuracy")
            }
            putDouble("timestamp", System.currentTimeMillis().toDouble())
        }
        sendEvent("onPerformance", statusMap)
    }

    /**
     * Device category bucketing (not exact model) for ML telemetry
     */
    private fun getDeviceCategory(): String {
        val manufacturer = Build.MANUFACTURER.lowercase(Locale.ROOT)
        val model = Build.MODEL.lowercase(Locale.ROOT)
        return when {
            manufacturer.contains("samsung") -> when {
                model.contains("sm-s9") || model.contains("sm-s24") || model.contains("sm-s23") || model.contains("sm-f") -> "samsung_flagship"
                model.contains("sm-a5") || model.contains("sm-a7") || model.contains("sm-a3") -> "samsung_mid"
                else -> "samsung_other"
            }
            manufacturer.contains("google") || manufacturer.contains("pixel") -> "google_pixel"
            manufacturer.contains("xiaomi") || manufacturer.contains("redmi") -> "xiaomi"
            manufacturer.contains("huawei") -> "huawei"
            manufacturer.contains("oneplus") -> "oneplus"
            manufacturer.contains("oppo") -> "oppo"
            manufacturer.contains("vivo") -> "vivo"
            else -> "android_other"
        }
    }

    override fun isTrackingEnabled(): Boolean {
        return isTrackingEnabled(context)
    }

    /**
     * Tracking state helpers
     */
    private fun isTrackingEnabled(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_TRACKING_ENABLED, false)
    }

    private fun setTrackingEnabled(context: Context, enabled: Boolean) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_TRACKING_ENABLED, enabled).apply()
    }

    /**
     * Check if all required permissions are granted
     */
    private fun hasAllRequiredPerms(context: Context): Boolean {
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val bgOk = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
        } else true
        val fgsOk = if (Build.VERSION.SDK_INT >= 34) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.FOREGROUND_SERVICE_LOCATION) == PackageManager.PERMISSION_GRANTED
        } else true
        return (fine || coarse) && bgOk && fgsOk
    }

    /**
     * Get current SmartGpsConfig as a map
     */
    private fun getConfigurationMap(): Map<String, Any> {
        val config = LocationTracker.getCurrentSmartConfiguration()
        return SmartGpsConfigFactory.toMap(config)
    }

    /**
     * Update configuration and notify service
     */
    private fun updateConfigurationInternal(configMap: Map<String, Any>) {
        val activitySettingsMap = configMap["activitySettings"] as? Map<String, Any>
        if (activitySettingsMap != null) {
            val activitySettings = ActivitySettings.fromMap(activitySettingsMap)
            LocationTracker.setPendingActivitySettings(activitySettings)
        }

        try {
            val intent = Intent(context, LocationTracker::class.java).apply {
                action = LocationTracker.ACTION_UPDATE_CONFIG
                putExtra("config", HashMap(configMap))
            }
            context.startService(intent)
        } catch (e: Exception) {
            Log.w("PolyfenceModule", "Failed to apply config: ${e.message}")
        }
    }
}
