package com.jomonpix.app;

import android.content.ComponentName;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Six distinct launcher aliases plus the original, all targeting MainActivity.
// The Android application ID and user project storage never change.
@CapacitorPlugin(name = "IconSwitcher")
public class IconSwitcherPlugin extends Plugin {
    private static final String DEFAULT_ALIAS = "IconDefault";
    private static final int NO_KILL = PackageManager.DONT_KILL_APP;

    private static boolean validChoice(String icon) {
        return "default".equals(icon) || (icon != null && icon.matches("[1-6]"));
    }

    private String aliasFor(String icon) {
        return "default".equals(icon) ? DEFAULT_ALIAS : "IconVariant" + icon;
    }

    private ComponentName component(String suffix) {
        String pkg = getContext().getPackageName();
        return new ComponentName(pkg, pkg + "." + suffix);
    }

    private String currentIcon() {
        PackageManager pm = getContext().getPackageManager();
        for (int n = 1; n <= 6; n++) {
            if (pm.getComponentEnabledSetting(component("IconVariant" + n))
                == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                return String.valueOf(n);
            }
        }
        return "default";
    }

    private void respond(PluginCall call, String icon) {
        JSObject result = new JSObject();
        result.put("icon", icon);
        call.resolve(result);
    }

    @PluginMethod
    public void getIcon(PluginCall call) {
        respond(call, currentIcon());
    }

    @PluginMethod
    public void setIcon(PluginCall call) {
        String icon = call.getString("icon");
        if (!validChoice(icon)) {
            call.reject("Invalid app icon choice.");
            return;
        }
        if (icon.equals(currentIcon())) {
            respond(call, icon);
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                PackageManager pm = getContext().getPackageManager();
                // Enable the requested launcher entry before disabling the old
                // entry to avoid a period when the launcher has no app icon.
                pm.setComponentEnabledSetting(component(aliasFor(icon)),
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED, NO_KILL);
                for (String candidate : new String[] {
                    "default", "1", "2", "3", "4", "5", "6"
                }) {
                    if (!candidate.equals(icon)) {
                        pm.setComponentEnabledSetting(component(aliasFor(candidate)),
                            PackageManager.COMPONENT_ENABLED_STATE_DISABLED, NO_KILL);
                    }
                }
                if (!icon.equals(currentIcon())) {
                    call.reject("Android launcher could not confirm the new icon.");
                    return;
                }
                respond(call, icon);
            } catch (Exception error) {
                call.reject("Android launcher icon change failed.", error);
            }
        });
    }
}
