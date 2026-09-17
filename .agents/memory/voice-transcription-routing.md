---
name: Voice transcription routing
description: The security and fallback boundary for mobile voice transcription.
---

Mobile voice recording uploads to the backend. The backend owns all provider credentials and tries the configured remote transcription providers in product order before using `LOCAL_TRANSCRIPTION_URL` as the local fallback.

**Why:** Bundling provider credentials into an Expo client would expose them, while the repository has no built-in offline speech model to use as an implicit local fallback.

**How to apply:** Keep provider keys out of mobile code. When changing transcription, preserve the ordered remote rotation and only invoke the configured local endpoint after every remote provider/model attempt fails.