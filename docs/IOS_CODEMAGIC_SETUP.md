# JOMON PIX iOS / Codemagic setup

This project packages the actual React/Vite editor inside Capacitor's WKWebView
(no GitHub Pages URL loaded in the native app). The website remains published
normally at https://kimura-jane.github.io/jomon-pix/.

## Chosen identifiers (new application)

- Display name: **JOMON PIX**
- iOS Bundle ID: **com.jomonpix.app** (not registered automatically)
- App version: **1.0.3** (read from `package.json` during signing)
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
   **JOMON PIX — signed IPA + TestFlight upload (manual)**). It creates a
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

## iOS 27 SDK / Apple ITMS-90725 (November 2026)

Apple accepted JOMON PIX **1.0.3 Build 10**, but reported it was built using
the **iOS 26.5 SDK**. That delivery is successful; the mandatory iOS 27 SDK
deadline is **April 2027**. The repository now pins **Xcode 27.2** for both
Codemagic workflows, and checks the actual selected Xcode and iOS SDK **before
compilation**. The signed `.ipa` is also inspected **before TestFlight upload**:
`DTSDKName` must indicate iphoneos27 or newer and `DTXcode` must indicate
Xcode 27 or newer. A mismatch stops the workflow.

**Important:** The previous Codemagic YAML specified Xcode 26.6 even though
Apple reported SDK 26.5. This suggests the actual build environment may
not have followed that YAML version, but the cause is **not confirmed**.
On the next manual Codemagic build, select a workflow defined in
**`codemagic.yaml`** (not a stale visual workflow), and check the
"Verify Xcode 27 and iOS 27 SDK before compilation" log. It should
report **Xcode 27.2 and iOS SDK 27.2**.

For another 1.0.3 delivery, **Build 10 cannot be reused**: Build **11 or
later** is required. Both the build-number setter and IPA verifier
fail on 1.0.3 numbers at or below 10. The version remains 1.0.3
and the minimum supported iOS remains 15. An SDK update **does not**
upgrade the deployment target.

Recommended flow: first `ios-simulator-check` (no signing, no upload),
then `ios-ipa` after reviewing its results. `ios-ipa` automatically
**uploads the signed IPA to App Store Connect**, but does not automatically
submit for App Store review. Neither GitHub/Linux preflight nor the
simulator check proves that the signed IPA compiles on Codemagic;
a real Codemagic build is still required. See the final IPA verification
log before checking for a new TestFlight build.

## App Store Connect privacy policy

Public URL: https://jomon-policy.onrender.com/

- Operator: 縄文
- Contact: jomon@jomonkusama.com
- Enter this URL in **App Store Connect > App Privacy > Privacy Policy**.
- A privacy button in the editor opens the same policy without leaving the app.
- The repository change does **not** update App Store Connect metadata or
  its data collection questionnaire. Complete those separately and accurately.

## Image export / restoration

The iOS app writes a temporary PNG or JSON to its local cache and opens the
system share sheet. To store a photo in Photos, choose **Save Image**. To store
a PNG or edit-backup in Files, choose **Save to Files**. No remote upload is
made by this export operation.

The editor now autosaves editable projects in **IndexedDB** rather than
localStorage's small per-origin quota. On first startup with this version,
an existing localStorage project is copied to IndexedDB; the old copy is
deliberately retained and is not deleted automatically. Browser and native
app data remain **separate** and do not synchronize.

**Before updating a native app showing "保存失敗":** while the current edit
screen is still open, open **📁 > 作品をバックアップ** and save the JSON file to
Files. Changes not previously written by the old app cannot be recovered
from its localStorage after it closes. A PNG export is *not* an editable
backup. After installing the updated build, use **作品を読み込む** if necessary,
and verify the imported project before deleting any backups.

IndexedDB has a much larger typical quota, but is still subject to device
free-space limits or WebKit storage eviction. A save is reported as complete
only after the underlying database transaction commits. Use the JSON
backup / restore buttons to move editable artwork between web and iOS.

## Release version checks

- `package.json` is the single source of truth for the iOS marketing version.
  `prepare-ios.sh`, the build-number setter and IPA verification read this value.
- Before an update is uploaded, set the next App Store version in `package.json`;
  the repository does not automatically select it from App Store Connect.
- Codemagic `BUILD_NUMBER` must be higher than the existing build number
  for the same App Store version. Check App Store Connect first.
- The IPA is only uploaded when `ios-ipa` is **manually** started.
  This workflow does not request App Store review.

## On-device offline editing (new-build requirement)

The iOS app uses a local Capacitor WKWebView and bundles frames, backgrounds,
stickers, NFT dogs, archaeology photos and MediaPipe face detection assets.
For the NEXT iOS build, `scripts/prepare-ios.sh` additionally runs
`scripts/bundle_native_offline.py` after the native Vite build and before
Capacitor sync. This pins IMG.LY **1.7.0** / medium `isnet_fp16` and downloads
its exact model chunks + all CPU WASM variations at build time. IMG.LY's
original asset names are bare SHA256 strings. Capacitor 7.6.10's Router.swift
rewrites extensionless paths to index.html, making the bundled AI unreadable.
The script now renames every chunk to SHA256.bin and rewrites resources.json
accordingly. Build verification rejects any extensionless resource path.
It also bundles
all **15 Google Fonts families** and their OFL license texts, replacing the
Google Fonts network links ONLY in the native HTML. Missing/corrupt resources,
mismatched versions and missing licenses fail the build. The website's build
continues to use its current external font and background-model loading.

Because IMG.LY's `@imgly/background-removal` is licensed **AGPL**, review
the source/notice and App Store distribution obligations before releasing.
The fonts are under SIL OFL (license texts are packaged into the IPA).
Large models/fonts make the IPA significantly bigger. The previous 1.0.2
build FAILED airplane-mode background removal on a physical iPhone; the defect
is now identified in Capacitor's extensionless route handling. This correction
has not yet passed an updated physical-iPhone test. Do not advertise fully
offline AI until a new build passes on device.

Do NOT start Codemagic, upload to App Store Connect or change the app's
marketing version without an explicit release instruction.

## Checks to perform on a physical iPhone

- Photo picker and background removal
- Beauty and multi-face auto-placement, including manual resizing
- TAF DOG, archaeology stickers and scene background assets
- PNG share -> Save Image / Save to Files
- Editable JSON backup -> Files, then import
- Background/foreground and restart: local project remains editable
- Turn on Airplane Mode (Wi-Fi and cellular OFF), cold-launch the app and test
  every tool, **especially first-ever background removal** and
  background-only mosaic without a previously populated model cache
- Check all 15 fonts while completely offline; save and reopen text edits
- For Web/PWA: offline remains unverified; do not advertise full offline Web use

The unsigned simulator workflow is only a compilation check. Neither
workflow claims device verification or App Store acceptance.
