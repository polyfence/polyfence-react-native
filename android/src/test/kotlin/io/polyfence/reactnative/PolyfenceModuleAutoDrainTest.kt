package io.polyfence.reactnative

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import io.polyfence.core.LocationTracker
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.Assert.fail
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import java.lang.reflect.Method

/**
 * Cross-platform parity test for the listener-live signal that triggers
 * automatic delivery of the durable pending-events queue. Every case here has
 * a matching Swift counterpart in `test/ios/PolyfenceModuleAutoDrainTests.swift`
 * and a JS counterpart in `__tests__/pendingEventsAutoDrain.test.ts`.
 *
 * The signal is observed through core's `pendingEventListenerActive` staging
 * field — the same path a running Service applies in `onCreate`. End-to-end
 * replay coverage against a real `LocationTracker` Service lives in
 * polyfence-core's `PendingEventsAutoDrainTest`.
 */
class PolyfenceModuleAutoDrainTest {

    private val reactContext: ReactApplicationContext = mock()

    // Coupled to core's `pendingEventListenerActive` private field name; a
    // rename in core will break this test opaquely. Kotlin lifts companion
    // `private var` properties onto the outer class as `private static`
    // fields — read the staging value there rather than on the Companion
    // class where a naive lookup would fail with NoSuchField.
    private val pendingField = LocationTracker::class.java
        .getDeclaredField("pendingEventListenerActive")
        .apply { isAccessible = true }

    private fun readPendingListenerActive(): Boolean? =
        pendingField.get(null) as Boolean?

    private fun writePendingListenerActive(value: Boolean?) {
        pendingField.set(null, value)
    }

    @Before
    fun setUp() {
        writePendingListenerActive(null)
    }

    @After
    fun tearDown() {
        writePendingListenerActive(null)
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

    @Test
    fun `module construction declares ownership of the listener signal`() {
        // Core treats delegate registration as a direct-Kotlin consumer
        // subscribing. Declaring at construction — before any JS call can
        // reach initialize() — is what stops that shortcut from replaying the
        // queue into a JS runtime that has not subscribed yet.
        assertNull(
            "precondition: nothing staged before the module exists",
            readPendingListenerActive()
        )

        PolyfenceModule(reactContext)

        assertEquals(false, readPendingListenerActive())
    }

    @Test
    fun `setEventListenerActive is exported to JS as a ReactMethod`() {
        // The JS side subscribes through DeviceEventEmitter, so the codegen
        // addListener hook never fires and this method is the only carrier for
        // the signal. A rename would silently disable automatic delivery.
        val method = requireReactMethod("setEventListenerActive")
        assertEquals(
            "setEventListenerActive(active, promise)",
            2,
            method.parameterTypes.size
        )
        assertEquals(Boolean::class.javaPrimitiveType, method.parameterTypes[0])
        assertEquals(Promise::class.java, method.parameterTypes[1])
    }

    @Test
    fun `setEventListenerActive true reaches core and resolves`() {
        val module = PolyfenceModule(reactContext)
        val promise: Promise = mock()

        module.setEventListenerActive(true, promise)

        assertEquals(true, readPendingListenerActive())
        verify(promise).resolve(null)
    }

    @Test
    fun `setEventListenerActive false reaches core and resolves`() {
        val module = PolyfenceModule(reactContext)
        val promise: Promise = mock()
        module.setEventListenerActive(true, promise)

        val second: Promise = mock()
        module.setEventListenerActive(false, second)

        assertEquals(false, readPendingListenerActive())
        verify(second).resolve(null)
    }

    @Test
    fun `dispose reports the listener as gone`() {
        val module = PolyfenceModule(reactContext)
        val activate: Promise = mock()
        module.setEventListenerActive(true, activate)

        module.dispose(mock())

        assertEquals(false, readPendingListenerActive())
    }

    @Test
    fun `catalyst instance destruction reports the listener as gone`() {
        val module = PolyfenceModule(reactContext)
        val activate: Promise = mock()
        module.setEventListenerActive(true, activate)

        module.onCatalystInstanceDestroy()

        assertEquals(false, readPendingListenerActive())
    }
}
