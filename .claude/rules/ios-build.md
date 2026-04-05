---
description: iOS build rules — dual-machine VPS/Mac setup
globs: ["**/*.swift", "**/*.tsx", "**/*.ts"]
---

# Build Rules

You are on a Linux VPS. You CANNOT run swift, xcodebuild, or xcrun directly.

- Build iOS: `xpush build`
- Build + run: `xpush run`
- Screenshot simulator: `mac screenshot sim`

Files auto-sync to Mac when you Edit/Write them. xpush also syncs via git.
