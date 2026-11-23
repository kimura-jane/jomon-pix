import UIKit
import Capacitor

// SceneDelegate continues using the existing Main.storyboard and Capacitor
// bridge; only the local icon-switching plugin is registered here.
class JomonBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(IconSwitcherPlugin())
    }
}
