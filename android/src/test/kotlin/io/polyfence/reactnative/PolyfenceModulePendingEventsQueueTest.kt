package io.polyfence.reactnative

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import io.polyfence.core.LocationTracker
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.mockito.kotlin.mock
import java.lang.reflect.Method

/**
 * Cross-platform parity test for the pending-events-queue bridge surface.
 * Every case here has a matching Swift counterpart in
 * `test/ios/PolyfenceModulePendingEventsQueueTests.swift` — drift between
 * the two is the failure mode Bug-028 caught on the previous release train.
 *
 * The bridge is a `ReactContextBaseJavaModule`, which needs a
 * `ReactApplicationContext` to construct. The context is mocked here — the
 * cases below never exercise a live RN loop; they observe the persist-vs-live
 * signal on `LocationTracker.Companion` through its `pendingBridgeAttached`
 * staging field, which is the same path a running Service applies in
 * `onCreate`. End-to-end lifecycle coverage against a real `LocationTracker`
 * Service lives in polyfence-core's `LocationTrackerPersistHookTest` /
 * `DrainThenReconcileTest`.
 */
class PolyfenceModulePendingEventsQueueTest {

    private val reactContext: ReactApplicationContext = mock()
    private lateinit var module: PolyfenceModule

    // Kotlin lifts companion `private var` properties onto the outer class as
    // `private static` fields — read the staging value there rather than on
    // the Companion class where a naive lookup would fail with NoSuchField.
    private val pendingField = LocationTracker::class.java
        .getDeclaredField("pendingBridgeAttached")
        .apply { isAccessible = true }

    private fun readPendingBridgeAttached(): Boolean? =
        pendingField.get(null) as Boolean?

    private fun writePendingBridgeAttached(value: Boolean?) {
        pendingField.set(null, value)
    }

    @Before
    fun setUp() {
        writePendingBridgeAttached(null)
        module = PolyfenceModule(reactContext)
    }

    @After
    fun tearDown() {
        writePendingBridgeAttached(null)
    }

    private fun requireReactMethod(name: String): Method {
        val method = PolyfenceModule::class.java.declaredMethods
            .firstOrNull { it.name == name }
            ?: fail("expected @ReactMethod fun $name on PolyfenceModule")
                    .let { throw AssertionError("unreachable") }
        assertNotNull(
            "@ReactMethod annotation missing on $name",
            method.getAnnotation(ReactMethod::class.java)
        )
        return method
    }

    // Case 1 parity — the JS drainPendingEvents flow depends on a native
    // @ReactMethod named `drainPendingEvents` taking a single Promise
    // parameter. A rename or arity drift here surfaces as a silent
    // NativeModule miss in Bridgeless (react-native#41394) rather than a
    // clean method-not-found — hence assert the shape reflectively.
    @Test
    fun `drainPendingEvents is exposed as a Promise-returning ReactMethod`() {
        val method = requireReactMethod("drainPendingEvents")
        assertEquals(
            "drainPendingEvents must take exactly one parameter (Promise)",
            1, method.parameterCount
        )
        assertEquals(
            "drainPendingEvents parameter must be a Promise",
            "com.facebook.react.bridge.Promise",
            method.parameterTypes[0].name
        )
    }

    // Case 7 parity — pendingEventsDroppedCount is the observable-eviction
    // hook that Roadie asked for; the wire name must match the TS surface.
    @Test
    fun `pendingEventsDroppedCount is exposed as a Promise-returning ReactMethod`() {
        val method = requireReactMethod("pendingEventsDroppedCount")
        assertEquals(
            "pendingEventsDroppedCount must take exactly one parameter (Promise)",
            1, method.parameterCount
        )
        assertEquals(
            "pendingEventsDroppedCount parameter must be a Promise",
            "com.facebook.react.bridge.Promise",
            method.parameterTypes[0].name
        )
    }

    // Case 3+4 parity — the bridge must own the setBridgeAttached signal.
    // polyfence-core 1.1.0 exposes it on `LocationTracker.Companion` as a
    // wrapper that mirrors `setBridgePlatform` / `setPendingCoreDelegate`.
    // Assert the entry point exists with the expected shape so a rename or
    // arity drift on core cannot silently reintroduce the persist-vs-live
    // signal gap the queue exists to close.
    @Test
    fun `LocationTracker companion exposes setBridgeAttached with a Boolean param`() {
        val method = LocationTracker.Companion::class.java.declaredMethods
            .firstOrNull { it.name == "setBridgeAttached" }
            ?: fail("expected LocationTracker.Companion.setBridgeAttached")
                    .let { throw AssertionError("unreachable") }
        assertEquals(
            "LocationTracker.setBridgeAttached must take exactly one Boolean parameter",
            1, method.parameterCount
        )
        val kind = method.parameterTypes[0]
        val ok = kind == java.lang.Boolean.TYPE || kind == java.lang.Boolean::class.java
        assertTrue(
            "LocationTracker.setBridgeAttached parameter must be Boolean (was ${kind.name})",
            ok
        )
    }

    // Case 4 parity — the RN catalyst-destroy path must invoke the companion
    // helper with `false` so the Service that outlives the JS runtime routes
    // subsequent events through the durable queue instead of dropping them
    // silently. Observed through the same `pendingBridgeAttached` staging
    // field the core's `onCreate` reads back into the running instance.
    @Test
    fun `onCatalystInstanceDestroy calls LocationTracker setBridgeAttached with false`() {
        assertEquals(
            "pending value should be null before the module is torn down",
            null, readPendingBridgeAttached()
        )

        module.onCatalystInstanceDestroy()

        assertEquals(
            "onCatalystInstanceDestroy must route the persist signal through " +
                "LocationTracker.setBridgeAttached(false)",
            false, readPendingBridgeAttached()
        )
    }
}
