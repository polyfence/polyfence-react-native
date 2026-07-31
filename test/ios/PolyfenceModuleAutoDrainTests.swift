import XCTest
import ObjectiveC
@testable import PolyfenceReactNative

/// Cross-platform parity coverage for the listener-live signal that triggers
/// automatic delivery of the durable pending-events queue. Every case here has
/// a matching Kotlin counterpart in
/// `android/src/test/kotlin/io/polyfence/reactnative/PolyfenceModuleAutoDrainTest.kt`
/// and a JS counterpart in `__tests__/pendingEventsAutoDrain.test.ts`.
///
/// The bridge is an RCTEventEmitter subclass whose end-to-end lifecycle needs
/// a live RN bridge to exercise; these tests inspect the compiled ObjC
/// runtime surface so a rename or arity drift fails cheaply. End-to-end replay
/// coverage lives in polyfence-core's `PendingEventsAutoDrainTests`.
final class PolyfenceModuleAutoDrainTests: XCTestCase {

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

    // The JS side subscribes through RCTDeviceEventEmitter, so the codegen
    // addListener hook is never invoked and this method is the only carrier
    // for the listener-live signal. A rename silently disables automatic
    // delivery — the queue keeps filling and nothing is ever replayed.
    func testSetEventListenerActiveExportsPromiseResolvingSelector() {
        let selector = NSSelectorFromString("setEventListenerActive:resolver:rejecter:")
        XCTAssertTrue(
            moduleClass.instancesRespond(to: selector),
            "Polyfence.setEventListenerActive:resolver:rejecter: selector must exist"
        )
    }

    // The listener signal and the bridge-teardown hook are separate concerns:
    // invalidate reports the bridge going away, setEventListenerActive reports
    // a consumer subscribing. Collapsing them would replay the queue at bridge
    // attach — before any consumer has subscribed — which is the loss the
    // feature exists to prevent.
    func testListenerSignalIsDistinctFromTheBridgeTeardownHook() {
        let listenerSignal = NSSelectorFromString("setEventListenerActive:resolver:rejecter:")
        let invalidate = NSSelectorFromString("invalidate")
        XCTAssertTrue(moduleClass.instancesRespond(to: listenerSignal))
        XCTAssertTrue(moduleClass.instancesRespond(to: invalidate))
        XCTAssertNotEqual(listenerSignal, invalidate)
    }

    // The codegen listener hooks remain no-ops and must NOT be repurposed as
    // the signal: `DeviceEventEmitter` never invokes them, so an implementation
    // that keyed automatic delivery off them would never fire.
    func testCodegenListenerHooksRemainSeparateFromTheSignal() {
        let codegenAdd = NSSelectorFromString("addListener:")
        let codegenRemove = NSSelectorFromString("removeListeners:")
        let listenerSignal = NSSelectorFromString("setEventListenerActive:resolver:rejecter:")
        XCTAssertTrue(moduleClass.instancesRespond(to: codegenAdd))
        XCTAssertTrue(moduleClass.instancesRespond(to: codegenRemove))
        XCTAssertNotEqual(codegenAdd, listenerSignal)
        XCTAssertNotEqual(codegenRemove, listenerSignal)
    }

    // Manual control stays available alongside automatic delivery — the
    // opt-out config flag turns the replay off and leaves this as the only
    // way to get the events out.
    func testManualDrainSelectorStillPresentAlongsideTheSignal() {
        XCTAssertTrue(
            moduleClass.instancesRespond(to: NSSelectorFromString("drainPendingEvents:rejecter:")),
            "drainPendingEvents:rejecter: must survive the move to automatic delivery"
        )
    }
}
