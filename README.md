<p align="center">
  <img src="https://img.shields.io/badge/GNOME_Shell-45--50-4A86CF?style=for-the-badge&logo=gnome&logoColor=white" alt="GNOME Shell 45–50" />
  <img src="https://img.shields.io/badge/TypeScript-5.4+-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-blue?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/Platform-Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux" />
</p>

<h1 align="center">🌐 Internet Speed Meter</h1>

<p align="center">
  <strong>A lightweight, real-time network speed monitor for the GNOME Shell top panel.</strong>
  <br />
  Displays upload and download speeds with minimal CPU overhead.
  <br />
  <br />
  <a href="https://github.com/mojahid2021/internet-speed-meter/issues">Report Bug</a>
  ·
  <a href="https://github.com/mojahid2021/internet-speed-meter/issues">Request Feature</a>
</p>

---

## ✨ Features

- **Real-Time Monitoring** — Displays live download (↓) and upload (↑) speeds directly in the GNOME top panel
- **Minimal Footprint** — Asynchronous I/O reads from `/proc/net/dev` with ~0% idle CPU impact
- **Auto-Aggregation** — Sums traffic across all active network interfaces (Wi-Fi, Ethernet, VPN)
- **Smart Formatting** — Automatically scales units between B/s → KB/s → MB/s
- **GNOME 50 Native** — Pure ESM architecture built for the latest GNOME Shell runtime
- **Type-Safe** — Authored in TypeScript with full `@girs` type coverage for GNOME APIs

## 📦 Requirements

| Dependency | Version | Notes |
|------------|---------|-------|
| GNOME Shell | 45 – 50 | Any distro running GNOME (Ubuntu, Fedora, Arch, openSUSE, Debian, etc.) |
| Node.js | 18+ | Build-time only |
| TypeScript | 5.4+ | Installed via npm |
| GLib | System package | Provides `glib-compile-schemas` |

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

### Enable / Disable

```bash
# Enable
gnome-extensions enable speed-meter@mojahid.lunecode.com

# Disable
gnome-extensions disable speed-meter@mojahid.lunecode.com
```

> **Note:** On Wayland, you may need to log out and back in for the extension to appear. On X11, press `Alt+F2` → type `r` → `Enter` to restart GNOME Shell.

## 🏗️ Project Structure

```
internet-speed-meter/
├── src/
│   ├── extension.ts          # Main extension logic (TypeScript)
│   ├── stylesheet.css         # GNOME Shell panel styles
│   ├── ambient.d.ts           # GJS/GNOME type declarations
│   ├── metadata.json          # Extension manifest
│   └── schemas/
│       └── org.gnome.shell.extensions.speed-meter.gschema.xml
├── package.json               # Node.js dependencies & scripts
├── tsconfig.json              # TypeScript compiler configuration
├── Makefile                   # Build automation
├── LICENSE                    # GPL-3.0-or-later
├── CHANGELOG.md               # Version history
├── CONTRIBUTING.md            # Contribution guidelines
└── .editorconfig              # Editor formatting rules
```

## 🔧 Development

### Prerequisites

```bash
# Install the GLib schema compiler for your distribution:
sudo apt install libglib2.0-dev          # Ubuntu / Debian / Pop!_OS / Zorin
sudo dnf install glib2-devel             # Fedora / RHEL / CentOS Stream
sudo pacman -S glib2                     # Arch / Manjaro / EndeavourOS
sudo zypper install glib2-devel          # openSUSE
sudo emerge dev-libs/glib                # Gentoo
```

### Build Commands

| Command | Description |
|---------|-------------|
| `make` | Clean + compile TypeScript + assemble dist/ |
| `make install` | Build + install to `~/.local/share/gnome-shell/extensions/` |
| `make pack` | Build + create `.zip` for [extensions.gnome.org](https://extensions.gnome.org) |
| `make test` | Install + launch nested GNOME Shell for testing |
| `make uninstall` | Remove the extension |
| `make clean` | Remove build artifacts |

### Testing in a Nested Shell

```bash
make test
```

This launches a sandboxed GNOME Shell session via `dbus-run-session gnome-shell --nested --wayland`, so you can test without affecting your live desktop.

### Viewing Logs

```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep -i speed
```

## ⚙️ How It Works

```
┌──────────────┐    async read     ┌──────────────────┐
│ /proc/net/dev│ ───────────────►  │  Parse RX/TX     │
│  (kernel)    │   every 1.5s      │  per interface   │
└──────────────┘                   └────────┬─────────┘
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │  Calculate Δ     │
                                   │  bytes/sec       │
                                   └────────┬─────────┘
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │  Format & render │
                                   │  to St.Label     │
                                   └──────────────────┘
```

1. **Read** — Asynchronously reads `/proc/net/dev` via `Gio.File.load_contents_async()`
2. **Parse** — Extracts RX (received) and TX (transmitted) byte counters for all non-loopback interfaces
3. **Calculate** — Computes bytes/second using monotonic time delta between polls
4. **Render** — Updates the `St.Label` in the GNOME Shell panel with human-readable speeds

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5+ → ES2023 ESM |
| Runtime | GJS (SpiderMonkey 128+) |
| UI Toolkit | St (Shell Toolkit) + Clutter |
| System I/O | Gio (GLib I/O) |
| Build | tsc + GNU Make |
| Types | @girs/gjs + @girs/gnome-shell |

## 📄 License

This project is licensed under the **GNU General Public License v3.0 or later** — see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 👤 Author

**Mojahid** — [@mojahid2021](https://github.com/mojahid2021)

- Website: [mojahid.lunecode.com](https://mojahid.lunecode.com)

---

<p align="center">
  Made with ❤️ for the GNOME Desktop
</p>
