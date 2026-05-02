# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-05-02

### Added
- **Deep Performance Optimizations**:
    - **Memory**: Static decoder reuse to prevent GC churn during frequent polling.
    - **CPU**: Content-Change Guard to prevent unnecessary UI redraws when speed is stable.
    - **I/O**: "Dirty check" persistence logic to skip redundant disk writes if data hasn't changed.
    - **Logic**: Throttled menu updates (only recalculates stats when the menu is visible).
    - **Scheduling**: Auto-saves now run at low priority to ensure zero impact on system UI responsiveness.

### Changed
- Optimized the network interface parsing loop for faster execution.
- Improved date key generation in the statistics manager.

## [1.1.0] - 2026-05-02

### Added
- **Native Preferences UI**: Added a professional settings window using Libadwaita.
- **Network Statistics Menu**: Clicking the panel label now reveals a detailed usage menu.
- **Historical Data Persistence**:
    - Tracking for Today, This Month (calendar-based), and Last Month.
    - Session-based usage tracking with a reset option.
    - Auto-saving stats to `~/.cache/internet-speed-meter/stats.json`.
- **Bits vs Bytes Toggle**: Added support for switching between KB/s (Bytes) and Kbps (Bits).
- **Dynamic Refresh Rate**: The polling interval can now be adjusted from 500ms to 5000ms via settings.
- **Visibility Toggles**: Individual switches to show/hide Download and Upload speeds.

### Fixed
- Fixed TypeScript compilation errors for GNOME 45+ `fillPreferencesWindow` signature.
- Resolved type clashes with GNOME Shell's internal `PopupMenu` structures.
- Fixed unit conversion math for bit-rate (bps) display.

## [1.0.0] - 2026-05-02

### Added
- Initial release of Internet Speed Meter.
- Real-time network speed monitoring (upload and download).
- Support for GNOME Shell 45 through 50.
- Asynchronous I/O using `/proc/net/dev` for minimal CPU overhead.
- Production-ready build system using TypeScript and GNU Make.
- Comprehensive documentation (README, CONTRIBUTING, LICENSE).
