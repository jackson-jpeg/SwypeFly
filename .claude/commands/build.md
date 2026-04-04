# build — build SoGoJet iOS app

## Target: $ARGUMENTS (default: build)

1. Push code to Mac: `xpush`
2. Build:
   - `build` → `xpush build`
   - `run` → `xpush run` (build + launch in simulator)
   - `open` → `xpush open` (open in Xcode)
3. If build fails, parse errors and fix them. Rebuild up to 5 times.
4. If target was `run`, screenshot the simulator: `mac screenshot sim`
