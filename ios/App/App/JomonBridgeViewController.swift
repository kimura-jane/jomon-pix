import UIKit
import Capacitor
import StoreKit

class JomonBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(IconSwitcherPlugin())
        bridge?.registerPluginInstance(AppReviewPlugin())
    }
}

// StoreKit decides whether to actually present the system review prompt.
@objc(AppReviewPlugin)
public class AppReviewPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppReviewPlugin"
    public let jsName = "AppReview"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise)
    ]

    @objc func request(_ call: CAPPluginCall) {
        // Let the completed share sheet finish dismissing.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            guard let controller = self?.bridge?.viewController,
                  controller.presentedViewController == nil,
                  let scene = controller.viewIfLoaded?.window?.windowScene,
                  scene.activationState == .foregroundActive else {
                call.resolve(["requested": false])
                return
            }
            if #available(iOS 16.0, *) {
                AppStore.requestReview(in: scene)
            } else {
                SKStoreReviewController.requestReview(in: scene)
            }
            call.resolve(["requested": true])
        }
    }
}
