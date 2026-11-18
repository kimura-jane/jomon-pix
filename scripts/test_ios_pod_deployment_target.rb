# frozen_string_literal: true
# Regression: preserve higher deployment targets while upgrading old Pods.
require_relative 'ios_pod_deployment_target'

Configuration = Struct.new(:build_settings)
Target = Struct.new(:name, :build_configurations)
Project = Struct.new(:targets)
Installer = Struct.new(:pods_project)

cases = {
  'Capacitor' => ['14.0', '15.0'],
  'CapacitorCordova' => ['14.0', '15.0'],
  'CapacitorShare' => ['14.9', '15.0'],
  'CapacitorFilesystem' => ['15.0', '15.0'],
  'IONFilesystemLib' => ['16.0', '16.0'],
  'UnknownTarget' => [nil, '15.0'],
  'InheritedTarget' => ['$(inherited)', '15.0']
}

targets = cases.map do |name, (before, _after)|
  Target.new(name, [
    Configuration.new({'IPHONEOS_DEPLOYMENT_TARGET' => before}),
    Configuration.new({'IPHONEOS_DEPLOYMENT_TARGET' => before})
  ])
end

JomonPixPodDeploymentTarget.enforce(Installer.new(Project.new(targets)))
targets.each do |target|
  expected = cases.fetch(target.name)[1]
  target.build_configurations.each do |config|
    actual = config.build_settings.fetch('IPHONEOS_DEPLOYMENT_TARGET')
    raise "#{target.name}: expected #{expected}, got #{actual}" unless actual == expected
  end
end

podfile = File.read(File.expand_path('../ios/App/Podfile', __dir__))
raise 'Podfile missing deployment fix hook' unless podfile.include?('JomonPixPodDeploymentTarget.enforce(installer)')
raise 'Podfile missing iOS 15 platform' unless podfile.include?("platform :ios, '15.0'")

puts "All CocoaPods iOS 15 deployment target regressions passed."
