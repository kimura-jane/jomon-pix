import Foundation
import UIKit
import Capacitor

// User-selectable launcher icons. The exact Icon1...Icon6 names are generated
// from existing gazo/icon/<n>/master_1024.png during iOS preparation.
@objc(IconSwitcherPlugin)
public class IconSwitcherPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "IconSwitcherPlugin"
    public let jsName = "IconSwitcher"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getIcon", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setIcon", returnType: CAPPluginReturnPromise),
    ]

    @objc func getIcon(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let current = UIApplication.shared.alternateIconName
            guard let name = current else {
                call.resolve(["icon": "default"])
                return
            }
            let permitted = (1...6).map { "Icon\($0)" }
            guard permitted.contains(name) else {
                call.reject("The active icon is not recognized.")
                return
            }
            call.resolve(["icon": String(name.dropFirst(4))])
        }
    }

    @objc func setIcon(_ call: CAPPluginCall) {
        guard let choice = call.getString("icon"),
              choice == "default" || (1...6).map(String.init).contains(choice) else {
            call.reject("Invalid icon selection.")
            return
        }
        DispatchQueue.main.async {
            let app = UIApplication.shared
            guard app.supportsAlternateIcons else {
                call.reject("Alternate icons are not supported on this device.")
                return
            }
            let name: String? = choice == "default" ? nil : "Icon\(choice)"
            if app.alternateIconName == name {
                call.resolve(["icon": choice])
                return
            }
            app.setAlternateIconName(name) { error in
                DispatchQueue.main.async {
                    if let error = error {
                        call.reject("Could not change the Home Screen icon: \(error.localizedDescription)")
                    } else {
                        call.resolve(["icon": choice])
                    }
                }
            }
        }
    }
}
