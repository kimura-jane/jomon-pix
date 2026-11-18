# frozen_string_literal: true

# Xcode 27 requires an iOS deployment target of at least 15.0.
# Some Capacitor/CocoaPods podspec targets still generate iOS 14.0 even though
# the app's Podfile specifies platform :ios, '15.0'.
require 'rubygems'

module JomonPixPodDeploymentTarget
  MINIMUM = Gem::Version.new('15.0')

  def self.enforce(installer)
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |configuration|
        settings = configuration.build_settings
        original = settings['IPHONEOS_DEPLOYMENT_TARGET']
        parsed = if original.to_s.match?(/\A\d+(?:\.\d+)*\z/)
                   Gem::Version.new(original.to_s)
                 end
        # Preserve pod targets requiring newer iOS; fill blank/old targets.
        next if parsed && parsed >= MINIMUM

        settings['IPHONEOS_DEPLOYMENT_TARGET'] = MINIMUM.to_s
      end
    end
  end
end
