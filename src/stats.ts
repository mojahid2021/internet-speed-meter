// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2025 Mojahid <mojahid@lunecode.com>

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export interface TrafficData {
    rx: number;
    tx: number;
}

export interface StatsHistory {
    daily: Record<string, TrafficData>; // "YYYY-MM-DD"
    monthly: Record<string, TrafficData>; // "YYYY-MM"
}

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

export class StatsManager {
    private _file: Gio.File;
    private _history: StatsHistory = { daily: {}, monthly: {} };
    private _lastSavedJson: string = '';

    constructor(cacheDir: string) {
        const path = GLib.build_filenamev([cacheDir, 'stats.json']);
        this._file = Gio.File.new_for_path(path);
        this._load();
    }

    private _load(): void {
        try {
            if (!this._file.query_exists(null)) return;
            const [ok, contents] = this._file.load_contents(null);
            if (ok) {
                const text = UTF8_DECODER.decode(contents);
                this._history = JSON.parse(text);
                this._lastSavedJson = text;
            }
        } catch (e) {
            logError(e as Error, 'SpeedMeter: Failed to load stats');
        }
    }

    save(): void {
        try {
            const json = JSON.stringify(this._history);
            
            // Optimization: Skip disk I/O if data hasn't changed since last save
            if (json === this._lastSavedJson) return;

            const parent = this._file.get_parent();
            if (parent && !parent.query_exists(null)) {
                parent.make_directory_with_parents(null);
            }

            this._file.replace_contents(
                UTF8_ENCODER.encode(json),
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
            
            this._lastSavedJson = json;
        } catch (e) {
            logError(e as Error, 'SpeedMeter: Failed to save stats');
        }
    }

    update(rxBytes: number, txBytes: number): void {
        if (rxBytes === 0 && txBytes === 0) return;

        const now = new Date();
        const dayKey = this._getDayKey(now);
        const monthKey = dayKey.substring(0, 7);

        this._updateKey(this._history.daily, dayKey, rxBytes, txBytes);
        this._updateKey(this._history.monthly, monthKey, rxBytes, txBytes);
    }

    private _updateKey(dict: Record<string, TrafficData>, key: string, rx: number, tx: number): void {
        const entry = dict[key];
        if (!entry) {
            dict[key] = { rx, tx };
        } else {
            entry.rx += rx;
            entry.tx += tx;
        }
    }

    private _getDayKey(date: Date): string {
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        const d = date.getDate();
        
        // Manual string building is faster than toISOString for keys
        return `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
    }

    getToday(): TrafficData {
        return this._history.daily[this._getDayKey(new Date())] || { rx: 0, tx: 0 };
    }

    getThisMonth(): TrafficData {
        return this._history.monthly[this._getDayKey(new Date()).substring(0, 7)] || { rx: 0, tx: 0 };
    }

    getLastMonth(): TrafficData {
        const now = new Date();
        let y = now.getFullYear();
        let m = now.getMonth(); 
        
        if (m === 0) { 
            m = 12;
            y -= 1;
        }
        
        const key = `${y}-${m < 10 ? '0' + m : m}`;
        return this._history.monthly[key] || { rx: 0, tx: 0 };
    }
}
