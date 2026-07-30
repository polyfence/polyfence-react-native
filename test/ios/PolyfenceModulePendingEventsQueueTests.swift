import XCTest
import ObjectiveC
@testable import PolyfenceReactNative

/// Cross-platform parity coverage for the pending-events-queue bridge surface.
/// Every case here has a matching Kotlin counterpart in
/// `android/src/test/kotlin/io/polyfence/reactnative/PolyfenceModulePendingEventsQueueTest.kt`.
/// Drift between the two is the failure mode Bug-028 caught on the previous
/// release train.
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

    // Case 1 parity — the JS drainPendingEvents flow depends on a native
    // Promise-resolving method exported as `drainPendingEvents:rejecter:`.
    // A rename or arity drift surfaces as a silent NativeModule miss under
    // Bridgeless / New Arch rather than a clean method-not-found.
    func testDrainPendingEventsExportsPromiseResolvingSelector() {
        let selector = NSSelectorFromString("drainPendingEvents:rejecter:")
        XCTAssertTrue(
            moduleClass.instancesRespond(to: selector),
            "Polyfence.drainPendingEvents:rejecter: selector must exist"
        )
    }

    // Case 7 parity — pendingEventsDroppedCount is the observable-eviction
    // hook that Roadie asked for; the wire name must match the TS surface.
    func testPendingEventsDroppedCountExportsPromiseResolvingSelector() {
        let selector = NSSelectorFromString("pendingEventsDroppedCount:rejecter:")
        XCTAssertTrue(
            moduleClass.instancesRespond(to: selector),
            "Polyfence.pendingEventsDroppedCount:rejecter: selector must exist"
        )
    }

    // Case 3 parity — the bridge must own setBridgeAttached toggling. On iOS
    // the persist-vs-live signal flips from within initialize / dispose /
    // invalidate; a missing @objc-exported invalidate override reintroduces
    // the silent-drop regression the queue exists to prevent.
    func testInvalidateSelectorPresent() {
        let selector = NSSelectorFromString("invalidate")
        XCTAssertTrue(
            moduleClass.instancesRespond(to: selector),
            "Polyfence must respond to invalidate() so the RN bridge teardown flips bridgeAttached=false"
        )
    }

    // Case 4 parity — the dispose selector routes through the ObjC bridge
    // and must remain exported as the RCT_EXTERN_METHOD signature the JS
    // dispose() call resolves against. If this drifts, dispose() rejects at
    // runtime and Polyfence.dispose() throws in production.
    func testDisposeSelectorPresent() {
        let selector = NSSelectorFromString("dispose:rejecter:")
        XCTAssertTrue(
            moduleClass.instancesRespond(to: selector),
            "Polyfence.dispose:rejecter: selector must exist"
        )
    }
}
