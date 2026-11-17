# JOMON pix

写真編集アプリ JOMON pix。

- Web版: https://kimura-jane.github.io/jomon-pix/
- プライバシーポリシー: https://jomon-policy.onrender.com/
- 運営者: 縄文
- お問い合わせ: jomon@jomonkusama.com

iOSのビルド手順は [docs/IOS_CODEMAGIC_SETUP.md](docs/IOS_CODEMAGIC_SETUP.md) を参照してください。

## Android (PWABuilder / Google Play)

The hosted Web edition is `https://kimura-jane.github.io/jomon-pix/`.
The Pages workflow runs `scripts/build_pwa.py` after Vite builds, creates
192px and 512px PNG icons from the **existing user-selected iOS icon**, then
generates a scoped `sw.js` that caches the HTML, bundled JS/CSS and PWA icons.
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
- Google Play publishing and Android signing/assetlinks have **not** been
  performed. Do not upload the app before an Android device test.
- The iOS native app still uses Codemagic/Capacitor and is unaffected by
  the website Service Worker.
