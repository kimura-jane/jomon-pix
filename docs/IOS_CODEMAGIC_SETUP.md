# JOMON pix iOS / Codemagic setup

This project packages the actual React/Vite editor inside Capacitor's WKWebView
(no GitHub Pages URL loaded in the native app). The website remains published
normally at https://kimura-jane.github.io/jomon-pix/.

## Chosen identifiers (new application)

- Display name: **JOMON pix**
- iOS Bundle ID: **com.jomonpix.app** (not registered automatically)
- App version: **1.0.0** (first build)
- Native framework: Capacitor **7.6.10**; iOS minimum **15**
- Git repository: **kimura-jane/jomon-pix**, nothing else may be modified

Do NOT reuse credentials or bundle identifiers from みんやせ or かなたけ.
If com.jomonpix.app is already registered to someone else, choose a unique
identifier in both capacitor.config.ts and codemagic.yaml before signing.

## Codemagic (manual, no automatic builds)

1. Add GitHub repository **kimura-jane/jomon-pix** in Codemagic. Select
   **codemagic.yaml** from the repository root (not the visual workflow).
2. Run **ios-simulator-check** first. This does not require Apple signing;
   it produces a simulator build, not an installable device IPA.
3. To build a signed IPA, register **com.jomonpix.app** as an explicit App ID
   in Apple Developer and create an App Store Connect app record if needed.
4. Configure the App Store Connect API integration in Codemagic team settings.
   Its integration name must match `Codemagic` in codemagic.yaml or edit that
   one line. Configure an Apple Distribution certificate and App Store
   provisioning profile for **com.jomonpix.app** in Codemagic.
5. Run **ios-ipa** manually (Codemagic shows this as
   **JOMON pix — signed IPA + TestFlight upload (manual)**). It creates a
   signed IPA and **uploads it to App Store Connect** automatically using the
   configured Apple integration. Apple processes the build before it appears
   in TestFlight. Starting this workflow is still a manual action.
6. In **App Store Connect > TestFlight**, open the newly processed build and
   add it to the existing internal testing group **Jomon**. There is no
   automatic external beta-review submission and no App Store review.
   The very first build may require filling Apple's compliance and TestFlight
   testing details before a tester can install it.

Codemagic regenerates or syncs the iOS platform with
`bash scripts/prepare-ios.sh` using the native Vite build:
`npm run build:native` sets base `/` so that /assets, /mediapipe and
/stickers load from the app bundle. `npm run build` keeps the website's
`/jomon-pix/` base unchanged.

## Image export / restoration

The iOS app writes a temporary PNG or JSON to its local cache and opens the
system share sheet. To store a photo in Photos, choose **Save Image**. To store
a PNG or edit-backup in Files, choose **Save to Files**. No remote upload is
made by this export operation.

The existing in-app auto-save uses local browser storage in the WKWebView;
web and iOS app data are **separate** and do not synchronize. Use the
**JSON backup / restore** buttons to move editable artwork between them.
Do not delete the original browser's stored work until import is verified.

## Checks to perform on a physical iPhone

- Photo picker and background removal
- Beauty and multi-face auto-placement, including manual resizing
- TAF DOG, archaeology stickers and scene background assets
- PNG share -> Save Image / Save to Files
- Editable JSON backup -> Files, then import
- Background/foreground and restart: local project remains editable
- Offline launch: bundled editor/stickers/model load; some optional
  external image processing/fonts may still need network access

The unsigned simulator workflow is only a compilation check. Neither
workflow claims device verification or App Store acceptance.
