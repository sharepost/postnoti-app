# Postnoti Project Status & Handover Report
**Date:** 2026-01-15
**Version:** 1.2 (Android Native Push Implemented)

## 1. Project Overview
- **Name:** Postnoti (Smart Mail Management for Shared Offices)
- **Tech Stack:** 
  - Frontend: React Native (Expo SDK 50+), TypeScript
  - Backend/DB: Supabase (Auth, DB, Realtime)
  - Notifications: Expo Push API
- **Target Platforms:** Android (Native), Web (PWA - Partial Support)

## 2. Current Implementation Status (✅ Completed)

### 📲 Mobile App (Android)
- **Native Build:** Configured with `expo-dev-client`.
  - Command: `npx expo run:android`
  - Fixed Issues: `AsyncStorage`, `ExpoDevice` native module linking errors resolved.
- **Push Notifications:** 
  - Admin triggers notification upon mail registration.
  - Tenant receives background push (via Expo Push API).
  - *Note:* Valid only on Native App (APK), not PWA yet.

### 🏢 Tenant Dashboard (입주사)
- **Auto Login:** Implemented using `AsyncStorage`. Branded links (`/branch/:slug`) auto-login if previously identified.
- **Direct Access:** Branded links redirect immediately to `TenantDashboard`, skipping the landing page.
- **UI/UX:**
  - **Tabs:** [All | Unread] filtering tabs added.
  - **Badge:** Unread count badge on header.
  - **Settings:** Toggle for "In-App Notification Sound" (Saved locally).
  - **Real-time:** Foreground sound effect & list update via Supabase Realtime subscription.
  - **Design:** Premium business aesthetic applied (ionic icons, clean layout).

### 👨‍💼 Admin Dashboard (관리자)
- **Mail Registration:** OCR-based sender/type detection.
- **Notification Trigger:** Sends Expo Push Notification to tenants instantly on registration.

## 3. Special Notes & Technical Context (⚠️ Important)

### A. PWA vs Native App
- **Current Issue:** User was testing on **PWA (Web Add-to-Homescreen)** expecting push notifications.
- **Reality:** Current implementation uses `expo-notifications` which works out-of-the-box for **Native Apps**.
- **Requirement for PWA:** Web Push requires **Firebase (FCM) VAPID Key** configuration. This is currently **NOT** implemented.
- **Immediate Guide:** Test using the app installed via `npx expo run:android` (USB Debugging), not the web URL.

### B. Missing Assets
- **Notification Sound:** The code tries to load `require('../../../assets/notification_sound.mp3')`.
- **Action Required:** Please add a valid `.mp3` file to `assets/` or the app will log a silent error (it won't crash).

### C. Build & Run
- Changes to `package.json` (native modules like `expo-device`, `expo-av`) require a **Rebuild**.
- **Command:** `npx expo run:android` (Do not just use `npx expo start`).

### D. Web Compatibility
- Fixed bundling error (`Entypo`/`Ionicons`) in `App.tsx` by optimizing imports.
- `start --web` works, but native features (Push, Device info) will gracefully fail or mock values.

## 4. Next Action Items (ToDo)

1.  **Generate Release APK**:
    - Build a standalone APK for distribution to tenants.
    - Command: `eas build -p android --profile preview` (or production).
2.  **Implement Web Push (FCM)**:
    - If PWA support is critical, configure Firebase VAPID credentials in `App.tsx`.
3.  **Add Sound File**:
    - Place `notification_sound.mp3` in the assets folder.
4.  **Database Migration (Optional)**:
    - Consider adding `notification_preferences` column to `profiles` table for cross-device setting sync.

## 5. File Structure Highlights
- `App.tsx`: Main entry, routing logic, Deep link handling (`handleDeepLink`), Push Notification sending logic.
- `src/components/tenant/TenantDashboard.tsx`: Tenant UI, Auto-login, Realtime subscription, Sound toggle.
- `src/services/`: `mailService`, `profilesService` (Supabase interactions).

---
**Summary for Next Agent:**
The environment is set up for **Android Native Development**. The user has just finished fixing build errors and implementing local/push notifications. The immediate next step is likely **creating an installable APK** or **setting up Firebase for Web Push**. Ensure to clarify whether they are testing on PWA or Native App.



정리할 핵심 내용
프로젝트 개요: 공유오피스 우편 관리 앱 (React Native + Supabase).
현재 구현 상태: 관리자용 OCR 등록, 입주사용 대시보드(자동로그인, 알림, 탭 필터).
금일 작업 요약: 안드로이드 빌드 에러 해결, 네이티브 모듈(expo-device, async-storage) 연동, 푸시 알림 로직 구현.
특이 사항 (중요):
PWA vs Native: 현재 푸시는 네이티브 앱에서만 작동함. 웹 푸시(PWA)는 Firebase 설정 필요.
알림음: 코드는 구현됐으나 mp3 파일 필요함.
빌드 필수: 네이티브 모듈 변경 시 npx expo run:android 필수.
다음 작업 추천: APK 배포 파일 생성, 웹 푸시 연동.