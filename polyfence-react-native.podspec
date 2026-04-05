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
  s.dependency "PolyfenceCore", "~> 1.0.5"

  s.frameworks = "CoreLocation", "CoreMotion"

  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
    "EXCLUDED_ARCHS[sdk=iphonesimulator*]" => "i386"
  }
end
