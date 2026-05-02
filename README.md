<p align="center">
  <img src="https://img.shields.io/badge/GNOME_Shell-45--50-4A86CF?style=for-the-badge&logo=gnome&logoColor=white" alt="GNOME Shell 45–50" />
  <img src="https://img.shields.io/badge/TypeScript-5.4+-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-blue?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/Platform-Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux" />
</p>

<h1 align="center">🌐 Internet Speed Meter</h1>

<p align="center">
  <strong>A professional, high-performance network speed monitor and statistics tracker for the GNOME Shell top panel.</strong>
  <br />
  Authored in TypeScript with a focus on zero-impact resource usage and deep system integration.
  <br />
  <br />
  <a href="https://github.com/mojahid2021/internet-speed-meter/issues">Report Bug</a>
  ·
  <a href="https://github.com/mojahid2021/internet-speed-meter/issues">Request Feature</a>
</p>

---

## ✨ Features

- **🚀 Real-Time Monitoring** — Live download (↓) and upload (↑) speeds in the top panel.
- **📊 Usage Statistics** — Click the speed to view detailed traffic stats for **Today**, **This Month**, and **Last Month** (calendar-based).
- **⚙️ Native Preferences** — Full configuration window (Libadwaita) to toggle bits/bytes, refresh rate, and visibility.
- **⚡ Deeply Optimized** — Asynchronous I/O, static object reuse, and UI redraw guards ensure ~0% CPU and minimal memory impact.
- **🔄 Auto-Aggregation** — Automatically sums traffic across Wi-Fi, Ethernet, VPN, and other active interfaces.
- **💾 Persistent History** — Automatically tracks and saves your data usage to `~/.cache/internet-speed-meter/stats.json`.
- **🖥️ GNOME 50+ Ready** — Pure ESM architecture fully compatible with GNOME 45 through 50+.

## 📦 Requirements

| Dependency | Version | Notes |
|------------|---------|-------|
| GNOME Shell | 45 – 50 | Ubuntu, Fedora, Arch, Debian, openSUSE, etc. |
| Node.js | 18+ | Build-time only (npm install) |
| libglib2.0-dev | System | Provides `glib-compile-schemas` |

## 🚀 Quick Start

### Install from Source

```bash
# Clone the repository
git clone https://github.com/mojahid2021/internet-speed-meter.git
cd internet-speed-meter

# Build and install
make install

# Enable the extension
gnome-extensions enable speed-meter@mojahid.lunecode.com
```

> **Note:** On Wayland (default on most distros), you must **Log Out and Log Back In** for the extension and its settings button to appear for the first time.

## 🏗️ Project Structure

```
internet-speed-meter/
├── src/
│   ├── extension.ts          # Panel indicator logic
│   ├── prefs.ts              # Settings UI (Libadwaita)
│   ├── stats.ts              # Traffic persistence engine
│   ├── stylesheet.css         # Panel styling
│   ├── metadata.json          # Extension manifest
│   └── schemas/              # GSettings configuration
├── Makefile                   # Build & deployment automation
├── LICENSE                    # GNU GPL v3.0
├── CHANGELOG.md               # Version history
└── CONTRIBUTING.md            # Community guidelines
```

## ⚙️ How It Works (Optimized Pipeline)

```
┌──────────────┐    async read     ┌──────────────────┐
│ /proc/net/dev│ ───────────────►  │ Delta Calculation│
│  (kernel)    │   low-priority    │ (reused decoder) │
└──────────────┘                   └────────┬─────────┘
                                            │
        ┌───────────────────────────────────┴────────────────┐
        ▼                                                    ▼
┌──────────────────┐     dirty check       ┌──────────────────┐
│  Update Label    │ ◄──────────────────── │  Update Stats    │
│  (Change Guard)  │      60s save         │  (Disk I/O Sync) │
└──────────────────┘                       └──────────────────┘
```

1. **Smart Reading** — Uses `load_contents_async` to fetch data without blocking the UI thread.
2. **Object Reuse** — Uses static `TextDecoder` and `TextEncoder` to prevent Memory/GC churn.
3. **Change Guard** — Only requests a UI redraw if the speed text has actually changed.
4. **Stats Logic** — Calculates deltas between ticks and pushes them to a local cache for daily/monthly tracking.

## 🛠️ Build Commands

| Command | Description |
|---------|-------------|
| `make install` | Build, compile schemas, and install to GNOME |
| `make pack` | Generate `.zip` for extensions.gnome.org |
| `make test` | Launch a nested Wayland shell for safe testing |
| `make logs` | Stream GNOME Shell logs filtered for this extension |

## 📄 License

Licensed under the **GNU General Public License v3.0 or later**.

## 👤 Author

**Mojahid** — [@mojahid2021](https://github.com/mojahid2021)
- Website: [mojahid.lunecode.com](https://mojahid.lunecode.com)

---

<p align="center">
  Made with ❤️ for the Linux community.
</p>
