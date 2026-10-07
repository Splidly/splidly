Pod::Spec.new do |s|
  s.name = 'SplidlySwipe'
  s.version = '1.0.0'
  s.summary = 'Native expense list swipe actions'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Splidly'
  s.homepage = 'https://splidly.app'
  s.platform = :ios, '16.4'
  s.source = { :git => 'https://splidly.app' }
  s.static_framework = true
  s.swift_version = '6.0'
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
