// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2025 Mojahid <mojahid@lunecode.com>

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

const PROC_NET_DEV = '/proc/net/dev';
const REFRESH_MS = 1500;
const HEADER_LINES = 2;
const KB = 1024;
const MB = KB * 1024;
const BITS_PER_BYTE = 8;
const Kb = 1000;
const Mb = Kb * 1000;

export default class SpeedMeterExtension extends Extension {
    private _prevRx: number = 0;
    private _prevTx: number = 0;
    private _prevTime: number = 0;
    private _timeoutId: number = 0;
    private _indicator: PanelMenu.Button | null = null;
    private _box: St.BoxLayout | null = null;
    private _label: St.Label | null = null;
    private _procFile: Gio.File | null = null;
    private _settings: Gio.Settings | null = null;
    private _useBits: boolean = false;
    private _showUpload: boolean = true;
    private _showDownload: boolean = true;
    private _settingsChangedId: number = 0;

    enable(): void {
        this._prevRx = 0;
        this._prevTx = 0;
        this._prevTime = GLib.get_monotonic_time();

        this._settings = this.getSettings();
        this._loadSettings();
        this._settingsChangedId = this._settings.connect(
            'changed', (_, key) => {
                this._loadSettings();
                if (key === 'refresh-interval') {
                    this._restartTimer();
                }
            },
        );

        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        this._box = new St.BoxLayout({
            style_class: 'speed-meter-box',
            vertical: false,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._label = new St.Label({
            text: '\u2026',
            style_class: 'speed-meter-label',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._box.add_child(this._label);
        this._indicator.add_child(this._box);
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._procFile = Gio.File.new_for_path(PROC_NET_DEV);
        this._restartTimer();
    }

    private _restartTimer(): void {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = 0;
        }

        const interval = this._settings?.get_int('refresh-interval') ?? REFRESH_MS;
        this._timeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT, interval, () => {
                this._tick();
                return GLib.SOURCE_CONTINUE;
            },
        );
    }

    private _loadSettings(): void {
        if (!this._settings) return;
        this._useBits = this._settings.get_boolean('use-bits');
        this._showUpload = this._settings.get_boolean('show-upload');
        this._showDownload = this._settings.get_boolean('show-download');
    }

    private _tick(): void {
        if (!this._procFile || !this._label) return;

        const lbl = this._label;

        this._procFile.load_contents_async(null, (file, res) => {
            try {
                if (!file) return;
                const [ok, bytes] = file.load_contents_finish(res);
                if (!ok || !bytes) return;

                const text = new TextDecoder('utf-8').decode(bytes);
                const lines = text.split('\n');

                let rx = 0;
                let tx = 0;

                for (let i = HEADER_LINES; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line || line.startsWith('lo:')) continue;

                    const cols = line.split(/\s+/);
                    if (cols.length >= 10) {
                        rx += parseInt(cols[1], 10) || 0;
                        tx += parseInt(cols[9], 10) || 0;
                    }
                }

                const now = GLib.get_monotonic_time();
                const dt = (now - this._prevTime) / 1_000_000;

                if (this._prevRx > 0 && this._prevTx > 0 && dt > 0) {
                    const rxs = (rx - this._prevRx) / dt;
                    const txs = (tx - this._prevTx) / dt;

                    const parts: string[] = [];
                    if (this._showDownload)
                        parts.push(`${this._fmt(rxs)} \u2193`);
                    if (this._showUpload)
                        parts.push(`${this._fmt(txs)} \u2191`);

                    lbl.set_text(parts.join('  ') || '\u2026');
                }

                this._prevRx = rx;
                this._prevTx = tx;
                this._prevTime = now;
            } catch (e) {
                logError(e as Error, 'SpeedMeter');
            }
        });
    }

    private _fmt(bytesPerSec: number): string {
        if (this._useBits) {
            const bps = bytesPerSec * BITS_PER_BYTE;
            if (bps >= Mb) return `${(bps / Mb).toFixed(1)} Mbps`;
            if (bps >= Kb) return `${(bps / Kb).toFixed(1)} Kbps`;
            return `${Math.round(bps)} bps`;
        }
        if (bytesPerSec >= MB) return `${(bytesPerSec / MB).toFixed(1)} MB/s`;
        if (bytesPerSec >= KB) return `${(bytesPerSec / KB).toFixed(1)} KB/s`;
        return `${Math.round(bytesPerSec)} B/s`;
    }

    disable(): void {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = 0;
        }

        if (this._settings && this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = 0;
        }

        this._indicator?.destroy();
        this._indicator = null;
        this._box = null;
        this._label = null;
        this._procFile = null;
        this._settings = null;
    }
}
