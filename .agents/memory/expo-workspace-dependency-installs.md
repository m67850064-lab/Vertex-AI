---
name: Workspace Expo dependency installs
description: How to keep native Expo dependencies scoped to the mobile artifact and aligned with the installed SDK.
---

Install Expo native packages from the mobile artifact directory, not the monorepo root. The generic package installer defaults to the workspace root and can refuse or place dependencies in the wrong package. After installation, run Expo’s compatibility check and use the versions it reports for the installed Expo SDK.

**Why:** The mobile project is a pnpm workspace, and native module version mismatches can compile successfully but fail in Metro or standalone builds.

**How to apply:** For every new Expo native module, pin the SDK-compatible version in `artifacts/mobile/package.json`, restart the mobile workflow once, and verify Metro logs plus TypeScript.