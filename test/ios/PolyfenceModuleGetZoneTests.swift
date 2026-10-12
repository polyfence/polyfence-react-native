import XCTest
import ObjectiveC
@testable import PolyfenceReactNative

/// Cross-platform parity coverage for `getZone`, the counterpart of
/// `android/src/test/kotlin/io/polyfence/reactnative/PolyfenceModuleGetZoneTest.kt`.
///
/// That Kotlin file asserts the `@ReactMethod` shape because a rename surfaces
/// as a silent NativeModule miss under Bridgeless rather than a clean
/// method-not-found, and it says the iOS equivalent is this: a Swift method
/// whose `RCT_EXTERN_METHOD` line in `PolyfenceModule.m` does not match its
/// `@objc` name is invisible to JS in exactly the same quiet way. The two
/// declarations are written in different files and nothing but a test holds
/// them together.
///
/// **Nothing in this repository executes this file today.** There is no
/// `Package.swift`, no Xcode project and no CI step that builds `test/ios`, so
/// this and its two siblings are written but not run. They are kept because
/// they are the only statement of the iOS bridge's expected surface and they
/// start working the day a runner exists, but a reader should not take their
/// presence as coverage.
///
/// Behaviour is not covered here. These tests inspect the compiled ObjC
/// runtime surface; what `getZone` answers for a stored, missing or malformed
/// zone is covered by polyfence-core's `ZoneMetadataReadTests` and by this
/// repo's `__tests__/notificationTextAndZoneRead.test.ts`.
final class PolyfenceModuleGetZoneTests: XCTestCase {

    private var moduleClass: AnyClass {
        // The @objc(Polyfence) name is what NativeModules.Polyfence resolves to
        // on the JS side, so assert against the exported ObjC identifier rather
        // than the Swift class name.
        guard let cls = NSClassFromString("Polyfence") else {
            XCTFail("@objc(Polyfence) class not found in the ObjC runtime")
            return NSObject.self
        }
        return cls
    }

    func testGetZoneExportsPromiseResolvingSelector() {
        let selector = NSSelectorFromString("getZone:resolver:rejecter:")
        XCTAssertTrue(
            moduleClass.instancesRespond(to: selector),
            "Polyfence.getZone:resolver:rejecter: selector must exist, and must "
                + "match the RCT_EXTERN_METHOD declaration in PolyfenceModule.m"
        )
    }

    func testGetZoneTakesAZoneIdRatherThanNoArguments() {
        // Guards arity as well as name. A zero-argument getZone would still
        // respond to a differently shaped selector, and JS would pass an id
        // that nothing read.
        XCTAssertFalse(
            moduleClass.instancesRespond(to: NSSelectorFromString("getZone:rejecter:")),
            "getZone must not expose a two-argument form; the id is required"
        )
        XCTAssertFalse(
            moduleClass.instancesRespond(to: NSSelectorFromString("getZone")),
            "getZone must not expose a no-argument form"
        )
    }
}
