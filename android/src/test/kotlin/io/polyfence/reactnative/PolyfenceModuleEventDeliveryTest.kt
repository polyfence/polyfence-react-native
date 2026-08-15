package io.polyfence.reactnative

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import io.polyfence.core.LocationTracker
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.mockito.MockedStatic
import org.mockito.Mockito
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

/**
 * Delivery-reporting contract between this bridge and polyfence-core.
 *
 * Core attempts live delivery by calling `onGeofenceEvent` and treats a normal
 * return as proof the consumer received the crossing — it then skips its
 * persist branch entirely. A bridge that emits nothing and returns normally
 * therefore destroys the event while core believes it was delivered, and the
 * OS notification still fires: a crossing the user is told about that never
 * reaches the event log.
 *
 * These cases pin the reporting half that lives on this side of the boundary.
 * The persist-and-replay half — that a throwing delegate makes core write to
 * the durable queue — is covered against a real `LocationTracker` Service in
 * polyfence-core's `LocationTrackerPersistHookTest`.
 */
class PolyfenceModuleEventDeliveryTest {

    private val reactContext: ReactApplicationContext = mock()
    private val emitter: DeviceEventManagerModule.RCTDeviceEventEmitter = mock()
    private lateinit var arguments: MockedStatic<Arguments>

    // Both staging fields are companion-level state on core that the module
    // constructor and the lifecycle hooks write through. Reset around every
    // case so ordering cannot leak a value between tests.
    private val bridgeAttachedField = LocationTracker::class.java
        .getDeclaredField("pendingBridgeAttached")
        .apply { isAccessible = true }
    private val listenerActiveField = LocationTracker::class.java
        .getDeclaredField("pendingEventListenerActive")
        .apply { isAccessible = true }

    @Before
    fun setUp() {
        bridgeAttachedField.set(null, null)
        listenerActiveField.set(null, null)
        // `Arguments.createMap` builds a WritableNativeMap, which needs the RN
        // native library. JavaOnlyMap/JavaOnlyArray are the pure-JVM
        // equivalents RN ships for exactly this. A fresh instance per call —
        // a shared one would let nested payloads overwrite each other.
        arguments = Mockito.mockStatic(Arguments::class.java)
        arguments.`when`<Any> { Arguments.createMap() }.thenAnswer { JavaOnlyMap() }
        arguments.`when`<Any> { Arguments.createArray() }.thenAnswer { JavaOnlyArray() }
    }

    @After
    fun tearDown() {
        arguments.close()
        bridgeAttachedField.set(null, null)
        listenerActiveField.set(null, null)
    }

    private fun geofenceEvent(): Map<String, Any> = mapOf(
        "eventType" to "ENTER",
        "zoneId" to "zone-1",
        "zoneName" to "Warehouse",
        "latitude" to 51.5007,
        "longitude" to -0.1246
    )

    private fun attachLiveInstance() {
        whenever(reactContext.hasActiveReactInstance()).thenReturn(true)
        whenever(
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ).thenReturn(emitter)
    }

    /**
     * The reported failure: app swiped away, foreground service still running,
     * crossing detected, nothing in the event log and nothing in the queue.
     */
    @Test
    fun `a crossing with no live React instance is reported as undelivered`() {
        whenever(reactContext.hasActiveReactInstance()).thenReturn(false)
        val module = PolyfenceModule(reactContext)

        try {
            module.onGeofenceEvent(geofenceEvent())
            fail(
                "onGeofenceEvent must throw when there is no live React instance — " +
                    "returning normally tells core the crossing was delivered and it " +
                    "will skip persisting to the durable queue"
            )
        } catch (expected: IllegalStateException) {
            assertTrue(
                "the failure should name the missing React instance",
                expected.message?.contains("React instance") == true
            )
        }

        verify(emitter, never()).emit(any(), any())
    }

    @Test
    fun `a crossing reaching a live React instance is emitted and reported delivered`() {
        attachLiveInstance()
        val module = PolyfenceModule(reactContext)

        module.onGeofenceEvent(geofenceEvent())

        verify(emitter).emit(eq("onGeofenceEvent"), any())
    }

    /**
     * A live instance whose emit fails is just as undelivered as no instance at
     * all. Swallowing here would put the event back on the silent-drop path.
     */
    @Test
    fun `a crossing whose emit fails is reported as undelivered`() {
        attachLiveInstance()
        whenever(emitter.emit(any(), any())).thenThrow(RuntimeException("bridge torn down"))
        val module = PolyfenceModule(reactContext)

        try {
            module.onGeofenceEvent(geofenceEvent())
            fail("onGeofenceEvent must throw when the emit itself fails")
        } catch (expected: IllegalStateException) {
            // expected — core persists instead
        }
    }

    /**
     * Only geofence events have a durable queue behind them. Location,
     * performance and error callbacks have nowhere to be persisted, and core
     * calls them from paths with no catch of their own — throwing there would
     * propagate into the tracker rather than save anything.
     */
    @Test
    fun `non-geofence callbacks stay silent when there is no live React instance`() {
        whenever(reactContext.hasActiveReactInstance()).thenReturn(false)
        val module = PolyfenceModule(reactContext)

        module.onLocationUpdate(mapOf("latitude" to 51.5007, "longitude" to -0.1246))
        module.onPerformanceEvent(mapOf("metric" to "battery", "value" to 0.5))
        module.onError(mapOf("type" to "gps_timeout", "message" to "no fix"))

        verify(emitter, never()).emit(any(), any())
    }
}
