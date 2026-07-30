package io.polyfence.reactnative

import com.facebook.react.bridge.ReactMethod
import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import java.lang.reflect.Method

/**
 * Cross-platform parity test for the pending-events-queue bridge surface.
 * Every case here has a matching Swift counterpart in
 * `test/ios/PolyfenceModulePendingEventsQueueTests.swift` — drift between
 * the two is the failure mode Bug-028 caught on the previous release train.
 *
 * Constructing a `ReactContextBaseJavaModule` requires a full
 * `ReactApplicationContext` and cannot happen off-instrumentation. These
 * tests inspect the compiled class' surface reflectively; end-to-end
 * lifecycle coverage lives in polyfence-core's
 * `LocationTrackerPersistHookTest` / `DrainThenReconcileTest` where it
 * belongs.
 */
class PolyfenceModulePendingEventsQueueTest {

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
    // On Android that responsibility is `signalCoreBridgeAttached(Boolean)`
    // — a private method reflecting into LocationTracker.Companion. Assert
    // the shape here so a rename can't silently orphan the persist path.
    @Test
    fun `signalCoreBridgeAttached is present with a single Boolean parameter`() {
        val method = PolyfenceModule::class.java.declaredMethods
            .firstOrNull { it.name == "signalCoreBridgeAttached" }
            ?: fail("expected private fun signalCoreBridgeAttached on PolyfenceModule")
                    .let { throw AssertionError("unreachable") }
        assertEquals(
            "signalCoreBridgeAttached must take exactly one Boolean parameter",
            1, method.parameterCount
        )
        val kind = method.parameterTypes[0]
        val ok = kind == java.lang.Boolean.TYPE || kind == java.lang.Boolean::class.java
        assertTrue(
            "signalCoreBridgeAttached parameter must be Boolean (was ${kind.name})",
            ok
        )
    }

    // Case 4 parity — RN's catalyst-destroy hook is where a bridge must
    // signal `bridgeAttached = false` for the tracker service that
    // outlives it. If the override drifts, the auto-flip fallback only
    // catches thrown delegate exceptions, and the RN sendEvent gate does
    // not throw — so a missing override reintroduces the silent-drop
    // regression the queue exists to prevent.
    @Test
    fun `onCatalystInstanceDestroy is overridden on PolyfenceModule`() {
        val declared = PolyfenceModule::class.java.declaredMethods
            .firstOrNull { it.name == "onCatalystInstanceDestroy" && it.parameterCount == 0 }
        assertNotNull(
            "expected fun onCatalystInstanceDestroy() override on PolyfenceModule",
            declared
        )
    }
}
