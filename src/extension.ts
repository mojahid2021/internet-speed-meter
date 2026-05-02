// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2025 Mojahid <mojahid@lunecode.com>

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { StatsManager } from './stats.js';

const PROC_NET_DEV = '/proc/net/dev';
const REFRESH_MS = 1500;
const SAVE_INTERVAL_MS = 60000;
const HEADER_LINES = 2;
const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;
const BITS_PER_BYTE = 8;
const Kb = 1000;
const Mb = Kb * 1000;

/** Optimized decoder instance reused across ticks to prevent GC churn */
const UTF8_DECODER = new TextDecoder('utf-8');

export default class SpeedMeterExtension extends Extension {
    private _prevRx: number = 0;
    private _prevTx: number = 0;
    private _prevTime: number = 0;
    private _timeoutId: number = 0;
    private _saveTimeoutId: number = 0;
    private _indicator: PanelMenu.Button | null = null;
    private _box: St.BoxLayout | null = null;
    private _label: St.Label | null = null;
    private _procFile: Gio.File | null = null;
    private _settings: Gio.Settings | null = null;
    private _statsManager: StatsManager | null = null;

    private _sessionRx: number = 0;
    private _sessionTx: number = 0;

    private _useBits: boolean = false;
    private _showUpload: boolean = true;
    private _showDownload: boolean = true;
    private _settingsChangedId: number = 0;
    private _lastLabelText: string = '';

    private _menuToday: PopupMenu.PopupSubMenuMenuItem | null = null;
    private _menuThisMonth: PopupMenu.PopupSubMenuMenuItem | null = null;
    private _menuLastMonth: PopupMenu.PopupSubMenuMenuItem | null = null;
    private _menuSession: PopupMenu.PopupSubMenuMenuItem | null = null;

    enable(): void {
        this._prevRx = 0;
        this._prevTx = 0;
        this._sessionRx = 0;
        this._sessionTx = 0;
        this._prevTime = GLib.get_monotonic_time();
        this._lastLabelText = '';

        this._statsManager = new StatsManager(this.path);
        this._settings = this.getSettings();
        this._loadSettings();
        
        this._settingsChangedId = this._settings.connect(
            'changed', (_, key) => {
                this._loadSettings();
                if (key === 'refresh-interval') this._restartTimer();
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

        this._buildMenu();

        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._procFile = Gio.File.new_for_path(PROC_NET_DEV);
        this._restartTimer();

        this._saveTimeoutId = GLib.timeout_add(GLib.PRIORITY_LOW, SAVE_INTERVAL_MS, () => {
            this._statsManager?.save();
            return GLib.SOURCE_CONTINUE;
        });
    }

    private _buildMenu(): void {
        if (!this._indicator) return;

        const header = new PopupMenu.PopupMenuItem('Network Statistics', { reactive: false });
        (this._indicator.menu as any).addMenuItem(header);
        (this._indicator.menu as any).addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._menuToday = new PopupMenu.PopupSubMenuMenuItem('Today', true);
        (this._indicator.menu as any).addMenuItem(this._menuToday);

        this._menuThisMonth = new PopupMenu.PopupSubMenuMenuItem('This Month', true);
        (this._indicator.menu as any).addMenuItem(this._menuThisMonth);

        this._menuLastMonth = new PopupMenu.PopupSubMenuMenuItem('Last Month', true);
        (this._indicator.menu as any).addMenuItem(this._menuLastMonth);

        this._menuSession = new PopupMenu.PopupSubMenuMenuItem('Current Session', true);
        (this._indicator.menu as any).addMenuItem(this._menuSession);

        (this._indicator.menu as any).addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const resetItem = new PopupMenu.PopupMenuItem('Reset Session');
        (resetItem as any).connect('activate', () => {
            this._sessionRx = 0;
            this._sessionTx = 0;
            this._updateMenu();
        });
        (this._indicator.menu as any).addMenuItem(resetItem);

        this._updateMenu();
    }

    /** Optimized menu update - only called when menu is visible or data changes */
    private _updateMenu(): void {
        if (!this._statsManager || (this._indicator && !(this._indicator.menu as any).isOpen)) return;

        const today = this._statsManager.getToday();
        const thisMonth = this._statsManager.getThisMonth();
        const lastMonth = this._statsManager.getLastMonth();

        this._updateSubMenu(this._menuToday, today.rx, today.tx);
        this._updateSubMenu(this._menuThisMonth, thisMonth.rx, thisMonth.tx);
        this._updateSubMenu(this._menuLastMonth, lastMonth.rx, lastMonth.tx);
        this._updateSubMenu(this._menuSession, this._sessionRx, this._sessionTx);
    }

    private _updateSubMenu(menu: PopupMenu.PopupSubMenuMenuItem | null, rx: number, tx: number): void {
        if (!menu) return;
        const total = rx + tx;
        const labelText = `${menu.label.get_text().split(':')[0]}: ${this._fmtSize(total)}`;
        
        // Prevent unnecessary actor updates
        if (menu.label.get_text() !== labelText) {
            menu.label.set_text(labelText);
            menu.menu.removeAll();
            menu.menu.addMenuItem(new PopupMenu.PopupMenuItem(`Download: ${this._fmtSize(rx)}`, { reactive: false }));
            menu.menu.addMenuItem(new PopupMenu.PopupMenuItem(`Upload: ${this._fmtSize(tx)}`, { reactive: false }));
        }
    }

    private _fmtSize(bytes: number): string {
        if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
        if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`;
        if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`;
        return `${Math.round(bytes)} B`;
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
        this._lastLabelText = ''; // Force redraw
    }

    private _tick(): void {
        if (!this._procFile || !this._label) return;

        this._procFile.load_contents_async(null, (file, res) => {
            try {
                if (!file) return;
                const [ok, bytes] = file.load_contents_finish(res);
                if (!ok || !bytes) return;

                // Use the static decoder to save memory
                const text = UTF8_DECODER.decode(bytes);
                const lines = text.split('\n');

                let rx = 0;
                let tx = 0;

                // Core parser loop - optimized for speed
                for (let i = HEADER_LINES; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line || line[0] === 'l') continue; // Fast check for 'lo:'

                    const cols = line.split(/\s+/);
                    if (cols.length >= 10) {
                        rx += parseInt(cols[1], 10) || 0;
                        tx += parseInt(cols[9], 10) || 0;
                    }
                }

                const now = GLib.get_monotonic_time();
                const dt = (now - this._prevTime) / 1_000_000;

                if (this._prevRx > 0 && this._prevTx > 0 && dt > 0) {
                    const deltaRx = rx - this._prevRx;
                    const deltaTx = tx - this._prevTx;

                    this._sessionRx += deltaRx;
                    this._sessionTx += deltaTx;
                    this._statsManager?.update(deltaRx, deltaTx);
                    
                    // Only update menu if user is actually looking at it
                    if (this._indicator && (this._indicator.menu as any).isOpen) {
                        this._updateMenu();
                    }

                    const rxs = deltaRx / dt;
                    const txs = deltaTx / dt;

                    // Build string only if needed
                    let labelParts = [];
                    if (this._showDownload) labelParts.push(`${this._fmt(rxs)} \u2193`);
                    if (this._showUpload) labelParts.push(`${this._fmt(txs)} \u2191`);
                    const finalLabel = labelParts.join('  ') || '\u2026';

                    // UI optimization: Only update the label if the text changed
                    if (this._label && this._lastLabelText !== finalLabel) {
                        this._label.set_text(finalLabel);
                        this._lastLabelText = finalLabel;
                    }
                }

                this._prevRx = rx;
                this._prevTx = tx;
                this._prevTime = now;
            } catch (e) {
                logError(e as Error, 'SpeedMeter');
            }
        });
    }

    private _fmt(bps: number): string {
        if (this._useBits) {
            const val = bps * BITS_PER_BYTE;
            if (val >= Mb) return `${(val / Mb).toFixed(1)} Mbps`;
            if (val >= Kb) return `${(val / Kb).toFixed(1)} Kbps`;
            return `${Math.round(val)} bps`;
        }
        if (bps >= MB) return `${(bps / MB).toFixed(1)} MB/s`;
        if (bps >= KB) return `${(bps / KB).toFixed(1)} KB/s`;
        return `${Math.round(bps)} B/s`;
    }

    disable(): void {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._saveTimeoutId) {
            GLib.Source.remove(this._saveTimeoutId);
            this._saveTimeoutId = 0;
        }

        if (this._settings && this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = 0;
        }

        this._statsManager?.save();

        this._indicator?.destroy();
        this._indicator = null;
        this._box = null;
        this._label = null;
        this._procFile = null;
        this._settings = null;
        this._statsManager = null;
        this._lastLabelText = '';
    }
}
