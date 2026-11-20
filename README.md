# DUO

Private, local-first iPhone fitness app for two people. The design is in [`docs/design.md`](docs/design.md).

Right now the app is the **phase 0 check app**: one screen that tests, on the real phone, what the design depends on.

| Check | What it tells us |
|---|---|
| 1. Build and install | An unsigned Codemagic IPA installs through A.M.Y Loader and opens |
| 2. Apple Health | Whether HealthKit is granted after signing, and which apps (Fitdays?) write weight, body fat and other readings |
| 3. Location for runs | Whether "Always" location can be granted, so runs keep tracking with the screen locked |
| 4. Text recognition | Whether on-device text recognition (Apple Vision) reads numbers, as the Fitdays screenshot import needs |

## Build an IPA (Codemagic)

1. In Codemagic, add this repository as an app (Codemagic reads `codemagic.yaml`).
2. Start a build of the **DUO unsigned IPA** workflow. There is no automatic trigger.
3. When it finishes, download `DUO.ipa` from the build's artifacts. If the build fails, `build.log` has the errors.

It uses about 15–25 of the 500 free macOS minutes a month. Keep billing off.

## Install (A.M.Y Loader)

1. Drag `DUO.ipa` onto A.M.Y Loader with the phone and Apple ID selected.
2. Open **DUO** on the phone, tap **Run all checks**, and answer the permission sheets. Turn on every Health category in the Health sheet.
3. Tap **Copy report** and paste it to Claude.

### Known gap: HealthKit and A.M.Y Loader

A.M.Y Loader's signing engine (isideload 0.5.2) uses only the entitlements in the free provisioning profile, and the only capability it switches on is increased memory. HealthKit is allowed for free Apple IDs, but it has to be enabled for the app first. Until A.M.Y Loader does that, check 2 is expected to fail with an entitlement error, and the report will confirm it. Checks 1, 3 and 4 don't depend on this.

## Develop

```sh
npm ci
npm run typecheck
npx expo prebuild --platform ios --no-install   # generates ios/ (never committed)
```

`ios/` and `android/` are generated from `app.json` and config plugins. Change those files, not the generated folders.
