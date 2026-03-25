Steps to enable persistent foreground Pomodoro notification (Notifee)

1) Install native dependency

  npm install @notifee/react-native

2) Android manifest permission

  Add this to `android/app/src/main/AndroidManifest.xml` (inside <manifest> but outside <application>):

  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />

3) Icons

  Ensure a `smallIcon` resource exists (e.g. `ic_launcher`) in `android/app/src/main/res/mipmap-*/`.

4) Gradle / SDK

  - Notifee may require minSdkVersion >= 21. Check `android/app/build.gradle` and update `minSdkVersion` if necessary.
  - Sync Gradle in Android Studio after adding the dependency.

5) Build

  Use Android Studio or Gradle to assemble the APK. For Expo-managed projects use EAS build.

6) Notes

  - Notifee offers `createForegroundService` and action handling; handling of action presses should be wired to your app state.
  - If you prefer I can add exact code edits to `android/` for you to apply; but you requested not to touch `android/` automatically, so these steps are provided for manual application.
