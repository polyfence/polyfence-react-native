package io.polyfence.reactnative

import com.facebook.react.bridge.Promise
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
import org.mockito.kotlin.verify
import java.lang.reflect.Method

/**
 * Cross-platform parity test for the pending-events-queue bridge surface.
 * Every case here has a matching Swift counterpart in
 * `test/ios/PolyfenceModulePendingEventsQueueTests.swift` — running the two
 * together is what keeps the bridge's public surface identical on both
 * platforms.
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

    // Coupled to core's `pendingBridgeAttached` private field name; a rename
    // in core will break this test opaquely. The alternative is a
    // `@VisibleForTesting` accessor on core, which needs its own commit +
    // republish — accept the coupling for now and revisit if this becomes a
    // recurring pain.
    //
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

    // The JS drainPendingEvents flow depends on a native @ReactMethod named
    // `drainPendingEvents` taking a single Promise parameter. A rename or
    // arity drift surfaces as a silent NativeModule miss in Bridgeless
    // (react-native#41394) rather than a clean method-not-found — assert the
    // shape reflectively so a rename here trips the test rather than the
    // consumer.
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

    // pendingEventsDroppedCount is the observable-eviction hook — silent
    // loss would otherwise reach consumers only through the eviction error
    // event. Its wire name must match the TS surface exactly, and the
    // @ReactMethod annotation is what makes Bridgeless codegen expose it.
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

    // The bridge owns the setBridgeAttached signal. polyfence-core 1.1.0
    // exposes it on `LocationTracker.Companion` as a wrapper that mirrors
    // `setBridgePlatform` / `setPendingCoreDelegate`. Assert the entry point
    // exists with the expected shape so a rename or arity drift on core
    // cannot silently reintroduce the persist-vs-live signal gap the queue
    // exists to close.
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

    // The module-teardown path must invoke the companion helper with `false`
    // so a Service that outlives the JS runtime routes subsequent events
    // through the durable queue instead of dropping them silently. Observed
    // through the `pendingBridgeAttached` staging field the core's `onCreate`
    // reads back into the running instance.
    @Test
    fun `invalidate calls LocationTracker setBridgeAttached with false`() {
        assertEquals(
            "pending value should be null before the module is torn down",
            null, readPendingBridgeAttached()
        )

        module.invalidate()

        assertEquals(
            "invalidate must route the persist signal through " +
                "LocationTracker.setBridgeAttached(false)",
            false, readPendingBridgeAttached()
        )
    }

    // Teardown must hang off a hook React Native still calls. `invalidate()`
    // is declared abstract on the `NativeModule` interface and implemented by
    // `BaseJavaModule`, so an override always runs. `onCatalystInstanceDestroy`
    // is an empty interface default from RN 0.76 onward: an override of it
    // compiles and can be called directly by a test, but React Native never
    // invokes it.
    @Test
    fun `teardown overrides the hook React Native invokes`() {
        val declared = PolyfenceModule::class.java.declaredMethods.map { it.name }
        assertTrue(
            "PolyfenceModule must override invalidate() for teardown",
            declared.contains("invalidate")
        )
        assertTrue(
            "PolyfenceModule must not carry teardown on onCatalystInstanceDestroy — " +
                "React Native no longer calls it, so the override would be dead code",
            !declared.contains("onCatalystInstanceDestroy")
        )
    }

    // The cases below invoke the host callbacks directly, which proves what
    // they do but not that React Native ever calls them. These two close that
    // gap: without the registration the callbacks are unreachable in
    // production and every other lifecycle case here would still pass.
    @Test
    fun `module registers itself for host lifecycle callbacks`() {
        verify(reactContext).addLifecycleEventListener(module)
    }

    @Test
    fun `invalidate unregisters the lifecycle listener`() {
        module.invalidate()

        verify(reactContext).removeLifecycleEventListener(module)
    }

    // A destroyed Activity does not mean a destroyed React instance —
    // ReactInstanceManager only moves the lifecycle state to BEFORE_CREATE and
    // leaves the context alive, so a module-scoped JS subscription still
    // receives. Detaching here would divert deliverable crossings into the
    // durable queue, which is off by default, dropping them outright.
    @Test
    fun `onHostDestroy leaves the attach signal untouched`() {
        module.onHostResume()
        assertEquals(true, readPendingBridgeAttached())

        module.onHostDestroy()

        assertEquals(
            "onHostDestroy must not detach a sink that can still receive",
            true, readPendingBridgeAttached()
        )
    }

    // Re-arming on resume is what stops the detached hint from latching false
    // for the rest of the process once a crossing has been reported undelivered.
    @Test
    fun `onHostResume calls LocationTracker setBridgeAttached with true`() {
        module.invalidate()
        assertEquals(false, readPendingBridgeAttached())

        module.onHostResume()

        assertEquals(
            "onHostResume must re-arm live delivery",
            true, readPendingBridgeAttached()
        )
    }

    // Backgrounding is the normal operating state for a geofencing consumer
    // and the React instance still receives events there. Detaching on pause
    // would divert every background crossing into the durable queue.
    @Test
    fun `onHostPause leaves the attach signal untouched`() {
        module.onHostResume()
        assertEquals(true, readPendingBridgeAttached())

        module.onHostPause()

        assertEquals(
            "onHostPause must not change the persist-vs-live signal",
            true, readPendingBridgeAttached()
        )
    }

    // XOR of the attach signal — the RN `dispose()` @ReactMethod path (JS
    // calling `Polyfence.instance.dispose()`) must ALSO flip the signal to
    // `false` before it tears the delegate down. Any event fired inside the
    // stop-tracking transition then persists rather than reaching a
    // torn-down JS runtime. Mocked context means the later `startService` /
    // SharedPreferences steps throw; that's fine — `setBridgeAttached(false)`
    // runs first, and the flag is what this test asserts.
    @Test
    fun `dispose ReactMethod flips setBridgeAttached to false before delegate teardown`() {
        assertEquals(
            "pending value should be null before dispose",
            null, readPendingBridgeAttached()
        )

        val promise: Promise = mock()
        module.dispose(promise)

        assertEquals(
            "dispose() must call LocationTracker.setBridgeAttached(false) so " +
                "any event fired inside the teardown transition routes to the " +
                "durable queue rather than a dead JS sink",
            false, readPendingBridgeAttached()
        )
    }

    // XOR reset path — the JS `initialize()` flow calls
    // `LocationTracker.setBridgeAttached(true)` before returning so a stale
    // `false` from a previous session doesn't block live delivery on a
    // healthy re-attach. Simulate that a previous session latched `false`,
    // then run only the setBridgeAttached step (the full initialize() needs
    // ReactApplicationContext plumbing beyond mockability), and assert the
    // staging field flipped back to `true`.
    @Test
    fun `re-attach path flips setBridgeAttached back to true`() {
        writePendingBridgeAttached(false)
        assertEquals(false, readPendingBridgeAttached())

        LocationTracker.setBridgeAttached(true)

        assertEquals(
            "a re-init must re-flip bridgeAttached to true so live delivery " +
                "resumes on the healthy re-attach",
            true, readPendingBridgeAttached()
        )
    }
}
