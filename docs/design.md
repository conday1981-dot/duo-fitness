# Fitness App: Design Doc v2 (DRAFT, awaiting approval)

Status: draft v2. Nothing is built until this is approved.
Working name: **DUO** (placeholder, rename freely).
Scope: a separate app. It shares no code, data, repo or runtime with ORION or any other project (Forge, Bloom, Ledger). Its only planned link is to "A.M.Y AI", as part of the Amy ecosystem, added later through an opt-in, permissioned interface (section 11).

Changes from v1: decisions R3 (readings), B4 (buddy sync), C2 (calendars); expanded couples section; goals and extras with phasing; build route without a Mac; Amy hook.

---

## 1. Intent

A private, local-first iPhone app for Con and his wife. It tracks body goals, workouts, cardio, recovery, readings from the Fitdays scale, reminders and progress, shares progress between the two phones, and has a locked private couples section.

## 2. Users and devices (confirmed)

- Two users, two iPhones, one profile each. Each profile has its own theme, units and lock.
- Profile A (Con): dark graphite (#0E1116) with cyan accent (#3DD6F5).
- Profile B (wife): Bloom's honey palette, gold #F5C400 on warm dark #0E0B00. It uses the same colours as Bloom, but no code or data is shared with Bloom.
- The couples section uses the honey palette for both users. Its look is set apart from the fitness screens.
- Both themes are editable.
- Screen preview: https://claude.ai/artifact/9wWr5CppL5UqWHx5CmHJcU

## 3. Goals

- Works fully offline. All data lives on the phones; the phones are the source of truth.
- Body goals: lose weight, lose fat in target areas, tone, gain muscle, gain weight. Each goal has a metric, target and deadline, and its progress updates automatically from logs and readings.
- Workouts: gym, home, bodyweight, walking, jogging, running, with timers.
- Cardio: GPS distance, pace, speed and time, with distance left on planned routes.
- Rotational programmes (for example 5 min walk / 5 min jog / 5 min walk), progressed by the user.
- Recovery cooldowns per muscle group and per cardio type, shown on a body map.
- Personal records for every exercise and cardio type, with "beat the PR" prompts.
- Body measurements and body graphs (male and female silhouettes).
- Fitdays readings imported by Apple Health plus screenshot import (section 6).
- Buddy view: each user sees what the other has chosen to share, plus side-by-side comparisons and joint challenges.
- Two calendars: fitness and intimacy (section 8).
- Private couples section, off by default (section 9).

## 4. Non-goals (v1)

- No App Store release, no public sharing, no social feed, no third-party analytics or ads.
- No medical advice. Calorie and body-composition figures are shown as estimates, with their source.
- No Android build (the Expo codebase keeps that open for later).
- No AI coaching in v1. The data model leaves room for Amy later.
- No nutrition or food logging in v1 (planned for phase 4).
- No Apple Watch app in v1 (Watch workouts can still arrive through Apple Health).

## 5. Anti-goals (would make this a failure even if it works)

- Data leaving the phones in readable form. Anything that leaves is end-to-end encrypted, and only after the user turns sync on.
- Calorie or "burn" figures presented as facts.
- The couples section showing up in notifications, widgets, the app switcher, backups, exports, Apple Calendar or Amy unless both users turn that on.
- Needing a network connection to log anything.

---

## 6. Readings (decision R3)

### What the scale measures
An 8-electrode Fitdays scale reports roughly: weight, BMI, body fat %, muscle mass, skeletal muscle, visceral fat, body water, bone mass, protein, BMR, metabolic age, subcutaneous fat, and fat and muscle per arm, leg and trunk.

### Import routes
1. **Apple Health (automatic).** Reads whatever Fitdays writes to Health. Health only has slots for body mass, BMI, body fat % and lean body mass (plus height and waist), so at most those arrive this way. Fitdays' Health sync is reported to be unreliable, so the app shows when each Health reading was last received.
2. **Screenshot import (main route for everything else).** The user shares or picks a screenshot of the Fitdays report. On-device text recognition (Apple Vision framework through a native module) reads the numbers. A review screen shows each value, which the user confirms or corrects before saving. The image never leaves the phone and is discarded after import unless the user keeps it.
3. **Manual entry (fallback).** A quick-entry form for any reading, used when screenshot parsing fails.

### Rules
- Each reading stores its source: Health, screenshot or manual.
- If Health and a screenshot both give a value for the same time, the screenshot wins for that time, because it is the full report.
- The screenshot parser is versioned. A layout change in Fitdays shows "couldn't read this report" and falls back to manual entry, never wrong numbers saved silently.
- Readings from the scale's electrical measurement are labelled as estimates. Trend lines use a 7-day average. The app reminds the user to weigh at the same time each morning.

### Open check (Con)
In the Health app → Browse → Body Measurements, see which readings list Fitdays as a source. That decides how much arrives automatically.

---

## 7. Buddy sync (decision B4)

### Design
- A small **Cloudflare Worker relay** that Con owns. It stores only encrypted data and never holds keys.
- **Pairing in person:** one phone shows a QR code and the other scans it. This swaps device keys and creates a shared couple key, and that key never touches the relay.
- **Encryption:** XChaCha20-Poly1305 (libsodium). Each change is a small encrypted record in an append-only log, signed by the device that wrote it.
- **Transport:** each device pushes its new records and pulls the other's. Sync runs on app open, after logging, and on a background refresh when iOS allows it. Offline changes queue and send later.
- **Conflicts:** each record has an owner. Shared items (couples section, joint challenges) merge per field by a hybrid logical clock, and the newest change wins. Log entries are only ever added, never overwritten.
- **Relay storage:** encrypted records are deleted once both devices confirm receipt, or after 30 days at most. The relay sees only device IDs, sizes and timing.

### What syncs
| Data | Default | Control |
|---|---|---|
| Workout summaries, PRs, streaks | Shared | Per user |
| Body readings | Not shared | Per metric, per user |
| Goals and progress | Shared | Per goal |
| Progress photos | Never | Not syncable in v1 |
| Couples section | Off | Needs both users to turn it on, and uses its own key |

### Trade-offs accepted
- It depends on Cloudflare's free tier. The relay holds no source data, so moving it to the home server later only means changing an address.
- Background sync on iOS is best-effort. The other phone may see updates only when the app is opened.

---

## 8. Calendars (decision C2)

- **Fitness calendar:** planned and completed workouts, rest days, recovery cooldowns, measurement days and reminders. It can optionally publish to Apple Calendar, per user, and only workout titles go there.
- **Intimacy calendar:** lives only inside the locked couples section, and never goes to Apple Calendar.
- **Combined view:** a toggle inside the locked section that overlays both calendars. It doesn't exist anywhere outside the lock.

---

## 9. Couples section

### Access and privacy
- Off by default. Each user turns it on separately, and it appears only when both have.
- It has its own lock: Face ID, with a separate passcode as fallback. It re-locks when the app goes to the background and after 2 minutes idle.
- It's blurred in the app switcher, and a quick-hide gesture (two-finger swipe down) returns to the home screen.
- Its data is stored encrypted, with a key in the Keychain marked device-only, so the key is never included in backups. A restored backup can't read it without pairing again.
- No notifications, widgets, Spotlight entries, exports or Amy access unless both users turn them on.

### Features
1. **Log:** date and time, the acts (multi-select from the catalogue), and optional duration, location tag and notes. Each user can add a rating and a private note that only they see.
2. **Stats:** count per month and week, trend over time, day-of-week and time-of-day patterns, longest gap, and a monthly summary.
3. **Catalogue:** grouped acts and positions. Each entry has:
   - a short educational description in plain, non-graphic language
   - a diagram drawn with jointed mannequin figures (head, torso, arms and legs bent at the joints) and no anatomical detail, shown from above or from the side. Her and Him are colour-coded and labelled (Her in her theme gold, Him in steel blue), with an arrow showing which way each person faces. A "swap who's in front" control flips the roles.
   - numbered "How to" steps for getting into position, written using the Her and Him labels
   - practical tips (comfort, communication, adjustments that are easy on knees, back or hips)
   - the main muscles worked, linking to the fitness side
   - a calorie estimate from MET values, labelled as an estimate with its source
   - user-created custom entries with free text and an optional private photo
   - favourites, and "want to try"
   The starter catalogue content is written at a sex-education level. Custom entries are entirely the users'.
4. **Wish list:** a yes/no/maybe list each user answers privately. Only items both marked yes or maybe are shown to both.
5. **Date-night planner:** plans and ideas, linked to the intimacy calendar.
6. **Connection prompts:** optional questions and check-ins.
7. **Cycle overlay:** only if the wife turns it on. It reads cycle data from Apple Health on her phone and shares only what she picks.

---

## 10. Fitness extras and phasing

| # | Feature | Phase |
|---|---|---|
| 1 | Goals with target, deadline and metric, updated automatically | 1 |
| 3 | Exercise library with form cues and muscle map | 1 |
| 4 | Rest and workout timers on the lock screen (Live Activity) | 1 (risk: see 12) |
| 6 | Apple Health import: steps, sleep, resting HR, Watch workouts | 1 |
| 8 | Weekly review card | 1 |
| 11 | Recovery body map | 1 |
| 7 | Couple challenges | 2 |
| 2 | Progression suggestions (rule-based) and deload weeks | 3 |
| 5 | Encrypted progress photos with side-by-side view | 3 |
| 10 | Injury log that adjusts suggestions | 3 |
| 9 | Offline route maps and GPX export | 3 |
| – | Nutrition logging | 4 |

### Phases
- **Phase 0, checks (before any feature work):**
  - Build pipeline: an unsigned IPA from a GitHub Actions macOS runner, installed through A.M.Y loader.
  - Confirm HealthKit works with free signing.
  - Confirm background GPS and Live Activities work with free signing.
  - Confirm the on-device text-recognition module builds.
- **Phase 1, solo core:**
  - profiles, themes and app lock
  - workouts, timers and rotational programmes
  - cardio with GPS
  - personal records
  - recovery map
  - goals
  - body readings with R3 import
  - fitness calendar
  - weekly review
- **Phase 2, together:** B4 sync and pairing, buddy view and comparisons, couple challenges, the couples section, the intimacy calendar and combined view.
- **Phase 3, smarter:** progression suggestions, progress photos, injury log, offline maps and GPX export.
- **Phase 4:** nutrition, then the Amy hook.

---

## 11. Amy hook (designed now, built in phase 4)

- One local, read-only interface with a permission toggle per category: workouts, goals, readings, calendar, and couples.
- The couples category is off and needs both users to agree, and either user can turn it off again.
- Amy reads through this interface only and never reads the database directly. Writes, if ever added, go through a confirm-before-saving step.
- Every access is logged on the device, and the user can see the log.

---

## 12. Build and install

- **Stack:** React Native (Expo, prebuild / bare workflow), TypeScript, local database with expo-sqlite (with encryption for the couples tables), libsodium for sync encryption.
- **Native modules:** HealthKit, background location, text recognition, Live Activities, Keychain.
- **Build:** Codemagic (`codemagic.yaml`, the same approach as amy-ios-build). A manually started `mac_mini_m2` build runs `expo prebuild`, pod install, then `xcodebuild` with code signing off, and packages an unsigned `.ipa`. A build uses about 15–25 of the 500 free macOS minutes a month. Billing stays off. No Mac and no paid Apple account are needed.
- **Install:** drag the IPA onto A.M.Y Loader (Con's iloader fork), which signs it with a free Apple ID, installs it, and re-signs it over Wi-Fi before the 7 days run out. **Confirmed: it takes an unsigned IPA.**
- **HealthKit gap (found 20 Nov 2026):** A.M.Y Loader's signing engine (isideload 0.5.2) uses only the entitlements in the free provisioning profile. The only capability it switches on for the app is increased memory. HealthKit is allowed for free Apple IDs, but it must be enabled for the app before the profile is downloaded. Until A.M.Y Loader does that, Health import won't work. Fix: a small change in A.M.Y Loader, the HealthKit counterpart of its increased-memory request. The phase 0 check app confirms it on the phone.
- **Testing in the Linux environment:** unit tests for the data model, sync, crypto, parsers and calculations, plus a web/simulator build of the UI where possible.

### Risks
| Risk | Effect | Mitigation |
|---|---|---|
| Free Apple ID limits (7-day expiry, few active apps, few app IDs per week) | App stops opening after 7 days. Each extension (Live Activity widget) uses another app ID | A.M.Y Loader re-signs over Wi-Fi before expiry. Keep extensions to a minimum |
| A.M.Y Loader doesn't enable HealthKit | No automatic readings, steps or sleep | Fix in A.M.Y Loader (section 12). Screenshot and manual import work without it |
| HealthKit or other capabilities unavailable with free signing | No automatic readings, steps or sleep | Phase 0 check. Fallback: screenshot and manual import only |
| Fitdays changes its report layout | Screenshot import fails | Versioned parser, falls back to manual entry |
| iOS limits background sync | Partner sees updates late | Sync when the app opens. Show "last synced" time |
| Losing a phone or reinstalling | Couples data can't be read | Encrypted export to a file, protected by a passphrase, made by the user's explicit choice |

---

## 13. Open items

Approved by Con on 20 Nov 2026, with the theme change above.

1. **A.M.Y Loader input: resolved.** It takes an unsigned IPA.
2. **Which readings Fitdays writes to Apple Health: unknown.** Check 2 of the phase 0 app answers it, once the HealthKit gap above is fixed.
3. Working name: still a placeholder.
