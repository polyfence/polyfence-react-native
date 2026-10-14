package io.polyfence.reactnative

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import io.polyfence.core.ZonePersistence
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.ArgumentMatchers.anyInt
import org.mockito.ArgumentMatchers.anyString
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.lang.reflect.Method

/**
 * The bridge's `getZone`: reading back whatever a consumer attached to a zone,
 * from the zone id a crossing hands it.
 *
 * Two things are under test and they fail differently. The method's **shape**
 * matters because a rename or an arity change surfaces as a silent
 * NativeModule miss under Bridgeless rather than a clean method-not-found, so
 * the consumer sees `undefined` and no error. The method's **behaviour**
 * matters because it reads persisted storage rather than the running engine,
 * which is what lets it answer before `startTracking` and after a process
 * restart.
 *
 * The iOS counterpart is declared in `ios/PolyfenceModule.m`; a Swift method
 * whose `@objc` name does not match its `RCT_EXTERN_METHOD` line is invisible
 * to JS in the same silent way. `test/ios/PolyfenceModuleGetZoneTests.swift`
 * asserts that selector, though nothing in this repository executes
 * `test/ios` yet, so on iOS that pairing currently rests on review.
 *
 * **Not covered here: the contents of a successfully resolved zone.**
 * `Arguments.makeNativeMap` returns a `WritableNativeMap`, which is JNI-backed
 * and throws `UnsatisfiedLinkError` in a JVM unit test, so the one line that
 * converts core's map for the bridge cannot run here. What that line is handed
 * is covered by polyfence-core's `ZoneMetadataReadTest`, and what a consumer
 * receives is covered by this repo's `__tests__/notificationTextAndZoneRead.test.ts`
 * against a mocked native module. The gap between them is a single framework
 * call, and an instrumented test is what would close it.
 *
 * What that line is handed, however, is this bridge's own business, so
 * `withJsonNullsAsNull` is a pure function and is exercised directly below.
 * It is the whole reason a zone with a null in it reads back at all.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class PolyfenceModuleGetZoneTest {

    private val reactContext: ReactApplicationContext = mock()
    private lateinit var module: PolyfenceModule
    private lateinit var appContext: Context

    @Before
    fun setUp() {
        appContext = ApplicationProvider.getApplicationContext()
        // The bridge uses the ReactApplicationContext as its Context directly
        // (`private val context: Context = reactContext`), and ZonePersistence
        // reads SharedPreferences off it. Delegate that one call to the real
        // Robolectric context so storage behaves, rather than stubbing
        // ZonePersistence itself, which would test a model of the store instead
        // of the store.
        whenever(reactContext.applicationContext).thenReturn(appContext)
        whenever(reactContext.getSharedPreferences(anyString(), anyInt()))
            .thenAnswer { invocation ->
                appContext.getSharedPreferences(
                    invocation.getArgument<String>(0),
                    invocation.getArgument<Int>(1)
                )
            }
        // Preferences are process-wide, so a previous test's zones would read
        // as this test's starting state.
        appContext.getSharedPreferences("polyfence_zones", Context.MODE_PRIVATE)
            .edit().clear().commit()
        module = PolyfenceModule(reactContext)
    }

    // -------- shape: a rename here is invisible to JS, not an error --------

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
    fun `getZone is exposed as a ReactMethod taking a zone id and a Promise`() {
        val method = requireReactMethod("getZone")
        assertEquals(
            "getZone must take exactly two parameters (String, Promise)",
            2, method.parameterCount
        )
        assertEquals("java.lang.String", method.parameterTypes[0].name)
        assertEquals(
            "com.facebook.react.bridge.Promise",
            method.parameterTypes[1].name
        )
    }

    // -------- behaviour --------

    @Test
    fun `resolves null for a zone that was never added`() {
        val promise: Promise = mock()
        module.getZone("nope", promise)

        verify(promise).resolve(null)
        verify(promise, never()).reject(any<String>(), any<String>())
    }

    @Test
    fun `resolves null once the zone is removed`() {
        val persistence = ZonePersistence(appContext)
        persistence.saveZone("zone-1", "Home", mapOf("note" to "milk"))
        persistence.removeZone("zone-1")

        val promise: Promise = mock()
        module.getZone("zone-1", promise)

        verify(promise).resolve(null)
    }

    @Test
    fun `rejects a blank zone id rather than reading the whole store`() {
        val promise: Promise = mock()
        module.getZone("  ", promise)

        verify(promise).reject(eq("INVALID_ZONE_ID"), any<String>())
    }

    @Test
    fun `rejects a null zone id`() {
        val promise: Promise = mock()
        module.getZone(null, promise)

        verify(promise).reject(eq("INVALID_ZONE_ID"), any<String>())
    }


    // -------- the sentinel a stored null comes back as --------

    @Test
    fun `a top-level JSON null becomes a Java null`() {
        // The case that breaks every circle built from a full Zone object:
        // `polygon` is null, core returns JSONObject.NULL, and makeNativeMap
        // recognises neither its nullness nor its type.
        val out = PolyfenceModule.withJsonNullsAsNull(
            mapOf("id" to "z1", "polygon" to JSONObject.NULL)
        ) as Map<*, *>

        assertEquals("z1", out["id"])
        assertTrue("polygon must be an actual null", out.containsKey("polygon"))
        assertNull(out["polygon"])
    }

    @Test
    fun `a JSON null nested in a map becomes a Java null`() {
        val out = PolyfenceModule.withJsonNullsAsNull(
            mapOf("metadata" to mapOf("note" to JSONObject.NULL, "pinned" to true))
        ) as Map<*, *>

        val metadata = out["metadata"] as Map<*, *>
        assertNull(metadata["note"])
        assertEquals(true, metadata["pinned"])
    }

    @Test
    fun `a JSON null inside a list becomes a Java null`() {
        val out = PolyfenceModule.withJsonNullsAsNull(
            mapOf("tags" to listOf("a", JSONObject.NULL, "c"))
        ) as Map<*, *>

        assertEquals(listOf("a", null, "c"), out["tags"])
    }

    @Test
    fun `a JSON null inside a map inside a list becomes a Java null`() {
        val out = PolyfenceModule.withJsonNullsAsNull(
            mapOf("polygon" to listOf(mapOf("latitude" to 1.0, "altitude" to JSONObject.NULL)))
        ) as Map<*, *>

        val first = (out["polygon"] as List<*>)[0] as Map<*, *>
        assertEquals(1.0, first["latitude"])
        assertNull(first["altitude"])
    }

    @Test
    fun `values that are not the sentinel are left exactly as they are`() {
        val nested = mapOf("deep" to listOf(1, "two", false))
        val out = PolyfenceModule.withJsonNullsAsNull(
            mapOf(
                "s" to "text",
                "i" to 7,
                "d" to 1.5,
                "b" to true,
                "m" to nested
            )
        ) as Map<*, *>

        assertEquals("text", out["s"])
        assertEquals(7, out["i"])
        assertEquals(1.5, out["d"])
        assertEquals(true, out["b"])
        assertEquals(nested, out["m"])
    }

    @Test
    fun `an already-null value stays null`() {
        val out = PolyfenceModule.withJsonNullsAsNull(mapOf("x" to null)) as Map<*, *>
        assertTrue(out.containsKey("x"))
        assertNull(out["x"])
    }

    @Test
    fun `an empty map and an empty list survive`() {
        val out = PolyfenceModule.withJsonNullsAsNull(
            mapOf("m" to emptyMap<String, Any>(), "l" to emptyList<Any>())
        ) as Map<*, *>

        assertEquals(emptyMap<String, Any>(), out["m"])
        assertEquals(emptyList<Any>(), out["l"])
    }
}
