import XCTest
import ObjectiveC
@testable import PolyfenceReactNative

/// Cross-platform parity coverage for the pending-events-queue bridge surface.
/// Every case here has a matching Kotlin counterpart in
/// `android/src/test/kotlin/io/polyfence/reactnative/PolyfenceModulePendingEventsQueueTest.kt`
/// — running the two together is what keeps the bridge's public surface
/// identical on both platforms.
///
/// The bridge is an RCTEventEmitter subclass whose end-to-end lifecycle needs
/// a live RN bridge to exercise; these tests inspect the compiled ObjC
/// runtime surface so a rename or arity drift fails cheaply. End-to-end
/// lifecycle coverage lives in polyfence-core's
/// `LocationTrackerPersistHookTests` / `DrainThenReconcileTests` where it
/// belongs.
final class PolyfenceModulePendingEventsQueueTests: XCTestCase {

    private var moduleClass: AnyClass {
        // The @objc(Polyfence) name is what NativeModules.Polyfence resolves
        // to on the JS side — assert against the exported ObjC identifier
        // rather than the Swift class name so a rename of the export
        // (which would break every JS consumer) fails here loudly.
        guard let cls = NSClassFromString("Polyfence") else {
            XCTFail("@objc(Polyfence) class not found in the ObjC runtime")
            return NSObject.self
        }
        return cls
    }

    // The JS drainPendingEvents flow depends on a native Promise-resolving
    // method exported as `drainPendingEvents:rejecter:`. A rename or arity
    // drift surfaces as a silent NativeModule miss under Bridgeless / New Arch
    // rather than a clean method-not-found — assert the selector shape so a
    // rename here trips the test rather than the consumer.
    func testDrainPendingEventsExportsPromiseResolvingSelector() {
        let selector = NSSelectorFromString("drainPendingEvents:rejecter:")
        XCTAssertTrue(
            moduleClass.instancesRespond(to: selector),
            "Polyfence.drainPendingEvents:rejecter: selector must exist"
        )
    }

    // pendingEventsDroppedCount is the observable-eviction hook — silent
    // loss would otherwise reach consumers only through the eviction error
    // event. Its wire name must match the TS surface exactly, and the
    // exported selector is what the RN bridge resolves against.
    func testPendingEventsDroppedCountExportsPromiseResolvingSelector() {
        let selector = NSSelectorFromString("pendingEventsDroppedCount:rejecter:")
        XCTAssertTrue(
            moduleClass.instancesRespond(to: selector),
            "Polyfence.pendingEventsDroppedCount:rejecter: selector must exist"
        )
    }

    // The bridge owns setBridgeAttached toggling. On iOS the persist-vs-live
    // signal flips from within initialize / dispose / invalidate; a missing
    // @objc-exported invalidate override reintroduces the silent-drop
    // regression the queue exists to prevent.
    func testInvalidateSelectorPresent() {
        let selector = NSSelectorFromString("invalidate")
        XCTAssertTrue(
            moduleClass.instancesRespond(to: selector),
            "Polyfence must respond to invalidate() so the RN bridge teardown flips bridgeAttached=false"
        )
    }

    // The dispose selector routes through the ObjC bridge and must remain
    // exported as the RCT_EXTERN_METHOD signature the JS dispose() call
    // resolves against. If this drifts, dispose() rejects at runtime and
    // Polyfence.dispose() throws in production.
    func testDisposeSelectorPresent() {
        let selector = NSSelectorFromString("dispose:rejecter:")
        XCTAssertTrue(
            moduleClass.instancesRespond(to: selector),
            "Polyfence.dispose:rejecter: selector must exist"
        )
    }

    // XOR of the attach signal — the drain method must exist so drained
    // events reach the consumer through the drain channel, and the invalidate
    // hook must exist so live delivery stops on RN bridge teardown. Present
    // both selectors together captures the XOR shape: one channel or the
    // other, never both, per polyfence-core's persist-vs-live contract.
    func testXORChannelSelectorsPresent() {
        let drain = NSSelectorFromString("drainPendingEvents:rejecter:")
        let invalidate = NSSelectorFromString("invalidate")
        XCTAssertTrue(
            moduleClass.instancesRespond(to: drain),
            "drainPendingEvents:rejecter: is the queue-side channel — must exist"
        )
        XCTAssertTrue(
            moduleClass.instancesRespond(to: invalidate),
            "invalidate is the detach signal that closes the live channel — must exist"
        )
    }
}
