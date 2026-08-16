package io.polyfence.reactnative

import android.Manifest
import android.app.Application
import android.content.Context
import android.os.Build
import androidx.test.core.app.ApplicationProvider
import com.facebook.react.bridge.ReactApplicationContext
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.kotlin.mock
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * Permission matrix for the bridge's `requestPermissions` gate.
 *
 * The property under test: this gate must never be stricter than
 * polyfence-core's own `hasCoreTrackingPerms`. A bridge-side copy that
 * additionally demanded `ACCESS_BACKGROUND_LOCATION` refused to start tracking
 * before core was ever consulted, so a relaxation landed in core alone was
 * inert. Counterparts: polyfence-core `LocationTrackerPermissionGateTest`,
 * polyfence-flutter `PolyfencePluginPermissionGateTest`.
 *
 * The gate is private, so the cases drive it by reflection. That is the exact
 * predicate the `requestPermissions` React method resolves with.
 */
@RunWith(RobolectricTestRunner::class)
class PolyfenceModulePermissionGateTest {

    private lateinit var module: PolyfenceModule
    private lateinit var context: Context

    @Before
    fun setUp() {
        // The gate takes its Context as a parameter, so the module's own
        // ReactApplicationContext is never consulted by the code under test.
        val reactContext: ReactApplicationContext = mock()
        module = PolyfenceModule(reactContext)
        context = ApplicationProvider.getApplicationContext()
    }

    private fun grant(vararg permissions: String) {
        shadowOf(ApplicationProvider.getApplicationContext<Application>())
            .grantPermissions(*permissions)
    }

    private fun deny(vararg permissions: String) {
        shadowOf(ApplicationProvider.getApplicationContext<Application>())
            .denyPermissions(*permissions)
    }

    /** True when the bridge would report permissions as satisfied. */
    private fun wouldStartTracking(): Boolean {
        val method = PolyfenceModule::class.java
            .getDeclaredMethod("hasCoreTrackingPerms", Context::class.java)
        method.isAccessible = true
        return method.invoke(module, context) as Boolean
    }

    // ---------------------------------------------------------------
    // The case the bridge used to refuse
    // ---------------------------------------------------------------

    @Test
    @Config(sdk = [Build.VERSION_CODES.S])
    fun `starts without background location when wake fences are off`() {
        // A consumer running the in-process polling engine and never touching
        // OS wake fences must not be forced through Google Play's
        // background-location review to use this bridge at all. This is the
        // exact configuration an API 31 device reproduced as a hard refusal.
        grant(Manifest.permission.ACCESS_FINE_LOCATION)
        deny(Manifest.permission.ACCESS_BACKGROUND_LOCATION)

        assertTrue(wouldStartTracking())
    }

    @Test
    @Config(sdk = [Build.VERSION_CODES.S])
    fun `starts on coarse location alone`() {
        grant(Manifest.permission.ACCESS_COARSE_LOCATION)
        deny(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_BACKGROUND_LOCATION
        )

        assertTrue(wouldStartTracking())
    }

    @Test
    @Config(sdk = [Build.VERSION_CODES.P])
    fun `pre-Q starts on foreground location alone`() {
        grant(Manifest.permission.ACCESS_FINE_LOCATION)

        assertTrue(wouldStartTracking())
    }

    // ---------------------------------------------------------------
    // What the gate still enforces
    // ---------------------------------------------------------------

    @Test
    @Config(sdk = [Build.VERSION_CODES.S])
    fun `refuses without any foreground location grant`() {
        deny(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )

        assertFalse(wouldStartTracking())
    }

    @Test
    @Config(sdk = [34])
    fun `API 34 refuses without FOREGROUND_SERVICE_LOCATION`() {
        grant(Manifest.permission.ACCESS_FINE_LOCATION)
        deny(Manifest.permission.FOREGROUND_SERVICE_LOCATION)

        assertFalse(wouldStartTracking())
    }

    @Test
    @Config(sdk = [34])
    fun `API 34 starts with FOREGROUND_SERVICE_LOCATION and no background grant`() {
        grant(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.FOREGROUND_SERVICE_LOCATION
        )
        deny(Manifest.permission.ACCESS_BACKGROUND_LOCATION)

        assertTrue(wouldStartTracking())
    }
}
