# Memory Index

- [Expo package version pinning](expo-package-version-pinning.md) — always install Expo SDK-matched package versions (e.g., `expo-document-picker@14.0.8` for Expo 54) to avoid Metro bundler errors.
- [Gemini file upload via File API](gemini-file-upload.md) — prefer the Gemini File API (`@google/generative-ai/server`) for PDF/TXT over parsing libraries like `pdf-parse`, which break Metro's file watcher.
- [Gemini model availability](gemini-model-availability.md) — the configured API key may not support older model aliases (e.g., `gemini-1.5-flash-latest`); check available models and use a supported one (e.g., `gemini-2.5-flash`).
- [Native build API configuration](native-build-api-config.md) — standalone mobile builds require a build-time HTTPS API URL; provider keys must remain on the backend, never in EXPO_PUBLIC client code.
- [AdMob platform IDs](admob-platform-ids.md) — Android and iOS AdMob App IDs are platform-specific; never reuse an Android ID for iOS.
- [Workspace Expo dependency installs](expo-workspace-dependency-installs.md) — install native Expo packages from the artifact workspace and verify versions with Expo’s compatibility check.
