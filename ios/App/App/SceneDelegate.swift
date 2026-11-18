import UIKit
import Capacitor

// iOS 27 SDK requires UIWindowScene lifecycle. UIKit creates this scene's
// window and its CAPBridgeViewController from the existing Main.storyboard
// declared in Info.plist's UIApplicationSceneManifest.
//
// Keep the Capacitor 7 bridge and storyboard intact: no second WKWebView,
// new project identifier or project-data reset is involved.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    // Capacitor 7 forwards deep links through ApplicationDelegateProxy.
    // With scene adoption these callbacks arrive here rather than AppDelegate.
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let context = URLContexts.first else { return }
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared, open: context.url, options: [:]
        )
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            continue: userActivity,
            restorationHandler: { _ in }
        )
    }

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        if let context = connectionOptions.urlContexts.first {
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared, open: context.url, options: [:]
            )
        }
        if let activity = connectionOptions.userActivities.first {
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared,
                continue: activity,
                restorationHandler: { _ in }
            )
        }
    }
}
