# JOMON PIX

写真編集アプリ JOMON PIX。

- Web版: https://kimura-jane.github.io/jomon-pix/
- プライバシーポリシー: https://jomon-policy.onrender.com/
- 運営者: 縄文
- お問い合わせ: jomon@jomonkusama.com

iOSのビルド手順は [docs/IOS_CODEMAGIC_SETUP.md](docs/IOS_CODEMAGIC_SETUP.md) を参照してください。


## PNG画像の保存

「画像保存」は、写真・スタンプ・メイク加工がキャンバスに読み込まれてからPNGを書き出します。
2026-11-19に、メイク設定を含めず読み込み完了を判定していた不具合を修正しました。
実画像のブラウザテストでは通常メイクとメイクのみの状態でPNG出力を検証しています。
GitHub Pagesが更新されても、配布済みiOSアプリの実行コードは変わりません。
iPhoneのTestFlightで試すには、修正後のmainからCodemagicで新しいIPAをビルドしてください。
実機での写真ライブラリへの保存は別途確認が必要です。


## Android (Capacitor 7 native app / offline)

**The old 3 MB PWABuilder/TWA Android release is not an offline native app.**
The replacement is a Capacitor Android package built from the same React UI
and local AI assets as iOS. The Google Play package remains
`com.jomonpix.app`; the app marketing version comes from `package.json`
(currently **1.1.0**).

Build manually from **Actions -> JOMON PIX Android 1.1.0 native offline (manual)**.
Enter a `version_code` STRICTLY GREATER than the highest code previously
uploaded to Google Play. This workflow does not upload to Google Play or
overwrite an existing release.

Create these **GitHub repository Actions secrets**, using the original
PWABuilder upload key, not the Google Play app-signing certificate:

- `ANDROID_KEYSTORE_BASE64`: Base64 of the original `signing.keystore`
  (encode locally; never commit the keystore or paste it into chat).
- `ANDROID_KEYSTORE_PASSWORD`: the keystore store password.
- `ANDROID_KEY_ALIAS`: the exact key alias.
- `ANDROID_KEY_PASSWORD`: the alias key password.

The CI verifies the old PWABuilder upload-key certificate fingerprint before
building, and stops on mismatch. It generates a native Android Gradle project,
packages the app UI plus models/WASM/fonts inside the application, sets Android
target API 36, and signs AAB and APK with the stored **upload key**. Download
the `jomon-pix-android-native-1.1.0-code-...` Actions artifact for inspection.

- The app does **not** load the editing UI from GitHub Pages or need a TWA
  association; browser toolbars do not appear.
- First-launch offline model availability is checked at **build time**, not
  left to runtime downloads. The native app embeds background removal,
  smart erase, face/body models, supporting WASM and Japanese fonts.
- Native WebView execution is **not yet confirmed on Android hardware**.
  Verify photo import/export, each AI feature, offline launch in airplane
  mode, lifecycle, and Android launcher icon *before* publishing.
- Offline availability and privacy claims require Android device tests;
  Android WebView/Mediapipe/IMG.LY portability cannot be proven by file
  existence alone. Source code and third-party model notices remain required.

The old Web/PWA edition stays at
`https://kimura-jane.github.io/jomon-pix/` and is not replaced or disabled
by this Android workflow. The iOS Codemagic setup is unchanged.

### Legacy Android TWA / PWA

## Android (PWABuilder / Google Play)

The hosted Web edition is `https://kimura-jane.github.io/jomon-pix/`.
The Pages workflow runs `scripts/build_pwa.py` after Vite builds, creates
192px, 512px and Android maskable PNG icons from the **existing user-selected iOS icon**, then
generates a scoped `sw.js` that caches the HTML, bundled JS/CSS, icons,
frames, sticker images and backgrounds. An automated Chromium audit checks
real offline restart with core visual assets.
The website's manifest is `/jomon-pix/manifest.webmanifest`.

- The first visit requires an internet connection and the Service Worker must
  finish installing before cached features work offline. MediaPipe's heavy
  model and other assets are cached only **after use**; full first-launch
  offline capability is **not** supported by the TWA approach.
- The background removal library still fetches its web AI model from IMG.LY
  when needed. Do not market Android as fully offline.
- PWA Builder outputs an Android **Trusted Web Activity**. To verify TWA's
  association and remove browser chrome, the **host origin** must serve
  `/.well-known/assetlinks.json` containing the correct Google Play signing
  SHA-256. Because this site is hosted at `kimura-jane.github.io/jomon-pix/`,
  adding `.well-known` inside **this** repository cannot create the file at
  `https://kimura-jane.github.io/.well-known/assetlinks.json`. This must be
  solved by the owner of that root origin or by moving the PWA to a dedicated
  root hostname. Do not modify another repository without permission.
- The **legacy TWA** has already been uploaded to Google Play. The root-domain
  assetlinks.json association is configured separately. The new Capacitor
  Android package must pass signed-build and device tests before its update.
- The iOS native app still uses Codemagic/Capacitor and is unaffected by
  the website Service Worker.

- PWA regression tests: `python3 scripts/test_pwa.py`; actual browser test in
  `.github/workflows/audit-pwa-android.yml` (no Play upload or signing).
