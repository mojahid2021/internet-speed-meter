# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-02

### Added
- Initial release of Internet Speed Meter.
- Real-time network speed monitoring (upload and download).
- Support for GNOME Shell 45 through 50.
- Asynchronous I/O using `/proc/net/dev` for minimal CPU overhead.
- GSettings support for:
    - Refresh interval.
    - Toggle upload/download visibility.
    - Toggle between bits (Kbps/Mbps) and bytes (KB/s/MB/s).
- Production-ready build system using TypeScript and GNU Make.
- Comprehensive documentation (README, CONTRIBUTING, LICENSE).
- Monospace font stack and subtle text shadow for panel readability.
