require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "polyfence-react-native"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = { "Polyfence" => "hello@polyfence.io" }
  s.source       = { :git => "https://github.com/polyfence/polyfence-react-native.git", :tag => "v#{s.version}" }

  s.platforms    = { :ios => "14.0" }
  s.swift_version = "5.0"

  s.source_files = "ios/**/*.{h,m,mm,swift}"

  s.dependency "React-Core"
  # Coordinated with the polyfence-core 3.1.0 release train, which is the first
  # core carrying notificationText and ZonePersistence.loadZoneData. This
  # bridge's getZone calls the latter, so it does not build against an earlier
  # core.
  # example/ios/Podfile pins the same version, so the example app and this
  # library resolve to one core rather than two.
  #
  # Exact version, not "~> 3.1.0". android/build.gradle pins the same core
  # version exactly, and an optimistic pin here would let iOS pick up a core
  # patch on the next pod install while Android stayed put. One version of
  # this bridge would then sit on two different engines depending on the
  # platform, which is not reproducible from the version number alone.
  s.dependency "PolyfenceCore", "3.1.0"

  s.frameworks = "CoreLocation", "CoreMotion"

  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
    "EXCLUDED_ARCHS[sdk=iphonesimulator*]" => "i386"
  }
end
