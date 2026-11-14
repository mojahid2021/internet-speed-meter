// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 MD Mojahid <aammojahid@gmail.com>

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { VERTICAL } from './compat.js';
import { N_ } from './format.js';
import { isCancelled } from './network.js';
import { Direction, SpeedTest } from './speedtest.js';

const DOWNLOAD_DURATION_MS = 7000;
const UPLOAD_DURATION_MS = 6000;

// Anchors for speedtest.net server selection; null coordinates let the server list use GeoIP.
const LOCATIONS: { label: string; lat: number | null; lon: number | null }[] = [
    { label: N_('Auto · Nearest'), lat: null, lon: null },
    { label: N_('New York, US'), lat: 40.7128, lon: -74.0060 },
    { label: N_('San Francisco, US'), lat: 37.7749, lon: -122.4194 },
    { label: N_('Toronto, CA'), lat: 43.6532, lon: -79.3832 },
    { label: N_('São Paulo, BR'), lat: -23.5505, lon: -46.6333 },
    { label: N_('London, UK'), lat: 51.5074, lon: -0.1278 },
    { label: N_('Frankfurt, DE'), lat: 50.1109, lon: 8.6821 },
    { label: N_('Dubai, AE'), lat: 25.2048, lon: 55.2708 },
    { label: N_('Mumbai, IN'), lat: 19.0760, lon: 72.8777 },
    { label: N_('Singapore, SG'), lat: 1.3521, lon: 103.8198 },
    { label: N_('Tokyo, JP'), lat: 35.6762, lon: 139.6503 },
    { label: N_('Sydney, AU'), lat: -33.8688, lon: 151.2093 },
];

const PHASES = [N_('Resolve'), N_('Latency'), N_('Download'), N_('Upload')];

function createMetric(title: string, initial: string): { box: St.BoxLayout; value: St.Label } {
    const box = new St.BoxLayout({
        ...VERTICAL,
        x_expand: true,
        style_class: 'speed-meter-st-ping-item',
    });
    const value = new St.Label({ text: initial, style_class: 'speed-meter-st-ping-val', x_align: Clutter.ActorAlign.CENTER });
    box.add_child(new St.Label({ text: title, style_class: 'speed-meter-st-ping-lbl', x_align: Clutter.ActorAlign.CENTER }));
    box.add_child(value);
    return { box, value };
}

function createGauge(direction: Direction): { card: St.BoxLayout; value: St.Label } {
    const kind = direction === 'download' ? 'down' : 'up';
    const card = new St.BoxLayout({
        ...VERTICAL,
        x_expand: true,
        style_class: `speed-meter-st-gauge-card speed-meter-${kind}-card`,
    });
    const title = new St.BoxLayout({ style_class: 'speed-meter-gauge-title-row' });
    title.add_child(new St.Label({
        text: direction === 'download' ? '↓' : '↑',
        style_class: `speed-meter-st-gauge-arrow speed-meter-${kind}-arrow`,
    }));
    title.add_child(new St.Label({
        text: direction === 'download' ? _('DOWNLOAD') : _('UPLOAD'),
        style_class: `speed-meter-st-gauge-title speed-meter-${kind}-title`,
    }));
    const value = new St.Label({ text: '--', style_class: `speed-meter-st-gauge-value speed-meter-${kind}-value` });
    card.add_child(title);
    card.add_child(value);
    card.add_child(new St.Label({ text: 'Mbps', style_class: 'speed-meter-st-gauge-unit' }));
    return { card, value };
}

function describeServer(sponsor: string, name: string, location: string): string {
    if (sponsor && name && sponsor !== name)
        return `${sponsor} • ${name}`;
    if (sponsor || name)
        return `${sponsor || name} • ${location}`;
    return location;
}

function rating(downMbps: number): string {
    if (downMbps <= 0)
        return _('TEST FAILED — CHECK CONNECTION');
    if (downMbps < 15)
        return _('TEST COMPLETE — BASIC BROADBAND');
    if (downMbps < 40)
        return _('TEST COMPLETE — FAST HIGH-SPEED');
    return _('TEST COMPLETE — OPTIMAL FOR 4K STREAMING');
}

export class SpeedTestPanel extends PopupMenu.PopupBaseMenuItem {
    static {
        GObject.registerClass({ GTypeName: 'SpeedMeterSpeedTestPanel' }, this);
    }

    private _test: SpeedTest | null = null;
    private _locationIndex = 0;
    private _locationChecks: St.Icon[] = [];
    private _locationButtons: St.Button[] = [];
    private _phaseLabels: St.Label[] = [];

    private _serverLabel: St.Label;
    private _dropdownButton: St.Button;
    private _dropdownArrow: St.Icon;
    private _dropdownList: St.ScrollView;
    private _pingValue: St.Label;
    private _jitterValue: St.Label;
    private _lossValue: St.Label;
    private _downValue: St.Label;
    private _upValue: St.Label;
    private _progressFill: St.Widget;
    private _statusLabel: St.Label;
    private _runLabel: St.Label;

    constructor(onClose: () => void) {
        super({ reactive: false, can_focus: false, style_class: 'speed-meter-st-panel' });
        this.connect('destroy', () => this._test?.cancel());

        const box = new St.BoxLayout({
            ...VERTICAL,
            x_expand: true,
            style_class: 'speed-meter-st-box',
        });
        this.add_child(box);

        const header = new St.BoxLayout({ x_expand: true, style_class: 'speed-meter-st-header' });
        const titles = new St.BoxLayout({
            ...VERTICAL,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        titles.add_child(new St.Label({ text: _('SPEED TEST'), style_class: 'speed-meter-st-brand' }));
        titles.add_child(new St.Label({ text: _('via public speedtest.net servers'), style_class: 'speed-meter-st-brand-sub' }));
        const closeButton = new St.Button({
            style_class: 'speed-meter-button speed-meter-close-btn',
            child: new St.Icon({ icon_name: 'window-close-symbolic', style_class: 'speed-meter-button-icon' }),
            y_align: Clutter.ActorAlign.CENTER,
            accessible_name: _('Close'),
        });
        closeButton.connect('clicked', () => {
            this._setDropdownOpen(false);
            onClose();
        });
        header.add_child(titles);
        header.add_child(closeButton);
        box.add_child(header);

        this._serverLabel = new St.Label({
            text: _(LOCATIONS[0].label),
            style_class: 'speed-meter-server-dropdown-label',
            x_expand: true,
        });
        this._dropdownArrow = new St.Icon({
            icon_name: 'pan-down-symbolic',
            style_class: 'speed-meter-server-dropdown-arrow',
            y_align: Clutter.ActorAlign.CENTER,
        });
        const serverText = new St.BoxLayout({
            ...VERTICAL,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        serverText.add_child(new St.Label({ text: _('SERVER'), style_class: 'speed-meter-server-caption' }));
        serverText.add_child(this._serverLabel);
        const serverRow = new St.BoxLayout({ x_expand: true, style_class: 'speed-meter-server-dropdown-row' });
        serverRow.add_child(new St.Icon({
            icon_name: 'network-wireless-symbolic',
            style_class: 'speed-meter-server-dropdown-icon',
            y_align: Clutter.ActorAlign.CENTER,
        }));
        serverRow.add_child(serverText);
        serverRow.add_child(this._dropdownArrow);
        this._dropdownButton = new St.Button({
            style_class: 'speed-meter-server-dropdown-btn',
            child: serverRow,
            x_expand: true,
            can_focus: true,
        });
        this._dropdownButton.connect('clicked', () => {
            if (!this._test)
                this._setDropdownOpen(!this._dropdownList.visible);
        });
        box.add_child(this._dropdownButton);

        const list = new St.BoxLayout({
            ...VERTICAL,
            x_expand: true,
            style_class: 'speed-meter-server-dropdown-list',
        });
        LOCATIONS.forEach((location, index) => {
            const check = new St.Icon({
                icon_name: 'object-select-symbolic',
                style_class: 'speed-meter-server-item-check',
                y_align: Clutter.ActorAlign.CENTER,
            });
            const row = new St.BoxLayout({ x_expand: true, style_class: 'speed-meter-server-item-box' });
            row.add_child(new St.Icon({
                icon_name: index === 0 ? 'network-wireless-symbolic' : 'mark-location-symbolic',
                style_class: 'speed-meter-server-item-icon',
                y_align: Clutter.ActorAlign.CENTER,
            }));
            row.add_child(new St.Label({
                text: _(location.label),
                style_class: 'speed-meter-server-item-label',
                x_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
            }));
            row.add_child(check);
            const button = new St.Button({
                style_class: 'speed-meter-server-dropdown-item',
                child: row,
                x_expand: true,
                can_focus: true,
            });
            button.connect('clicked', () => this._selectLocation(index));
            this._locationButtons.push(button);
            this._locationChecks.push(check);
            list.add_child(button);
        });
        this._dropdownList = new St.ScrollView({
            style_class: 'speed-meter-server-dropdown-scroll',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true,
            x_expand: true,
            visible: false,
            child: list,
        });
        box.add_child(this._dropdownList);
        this._updateLocationChecks();

        const phases = new St.BoxLayout({ x_expand: true, style_class: 'speed-meter-st-phase-row' });
        PHASES.forEach((phase, index) => {
            if (index > 0) {
                phases.add_child(new St.Label({
                    text: '·',
                    style_class: 'speed-meter-st-phase-sep',
                    x_expand: true,
                    x_align: Clutter.ActorAlign.CENTER,
                }));
            }
            const label = new St.Label({ text: _(phase), style_class: 'speed-meter-st-phase-step speed-meter-st-phase-pending' });
            this._phaseLabels.push(label);
            phases.add_child(label);
        });
        box.add_child(phases);

        const ping = createMetric(_('PING'), '--');
        const jitter = createMetric(_('JITTER'), '--');
        const loss = createMetric(_('LOSS'), '--');
        this._pingValue = ping.value;
        this._jitterValue = jitter.value;
        this._lossValue = loss.value;
        const metrics = new St.BoxLayout({ x_expand: true, style_class: 'speed-meter-st-ping-strip' });
        metrics.add_child(ping.box);
        metrics.add_child(jitter.box);
        metrics.add_child(loss.box);
        box.add_child(metrics);

        const down = createGauge('download');
        const up = createGauge('upload');
        this._downValue = down.value;
        this._upValue = up.value;
        const gauges = new St.BoxLayout({ x_expand: true, style_class: 'speed-meter-st-gauges-row' });
        gauges.add_child(down.card);
        gauges.add_child(up.card);
        box.add_child(gauges);

        const progressTrack = new St.Widget({
            style_class: 'speed-meter-st-progress-track',
            x_expand: true,
            clip_to_allocation: true,
        });
        this._progressFill = new St.Widget({ style_class: 'speed-meter-st-progress-fill', x_expand: true, scale_x: 0 });
        progressTrack.add_child(this._progressFill);
        box.add_child(progressTrack);

        this._statusLabel = new St.Label({
            text: _('Tap START TEST to measure your connection'),
            style_class: 'speed-meter-st-status-text',
            x_align: Clutter.ActorAlign.CENTER,
        });
        const status = new St.BoxLayout({ x_expand: true, style_class: 'speed-meter-st-status-box' });
        status.add_child(this._statusLabel);
        box.add_child(status);

        this._runLabel = new St.Label({
            text: _('START TEST'),
            style_class: 'speed-meter-st-go-label',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        const runContent = new St.BoxLayout({ x_expand: true, style_class: 'speed-meter-st-go-inner' });
        runContent.add_child(new St.Icon({
            icon_name: 'network-transmit-receive-symbolic',
            style_class: 'speed-meter-st-go-icon',
            y_align: Clutter.ActorAlign.CENTER,
        }));
        runContent.add_child(this._runLabel);
        const runButton = new St.Button({
            style_class: 'speed-meter-st-go-button',
            child: runContent,
            x_expand: true,
            can_focus: true,
        });
        runButton.connect('clicked', () => {
            if (this._test)
                this._cancel();
            else
                this.start();
        });
        box.add_child(runButton);
    }

    async start(): Promise<void> {
        if (this._test)
            return;
        const test = new SpeedTest();
        this._test = test;
        const location = LOCATIONS[this._locationIndex];

        this._setDropdownOpen(false);
        this._runLabel.text = _('CANCEL');
        for (const label of [this._pingValue, this._jitterValue, this._lossValue, this._downValue, this._upValue])
            label.text = '--';

        try {
            this._setPhase(0, _('RESOLVING SERVER...'));
            const server = await test.findServer(location.lat, location.lon);
            if (!server) {
                this._finish(0, 0, null);
                return;
            }
            this._serverLabel.text = describeServer(server.sponsor, server.name, _(location.label));

            this._setPhase(1, _('TESTING LATENCY...'));
            const latency = await test.measureLatency(server.host);
            this._pingValue.text = latency ? `${Math.round(latency.pingMs)} ms` : _('N/A');
            this._jitterValue.text = latency ? `${latency.jitterMs.toFixed(1)} ms` : _('N/A');
            this._lossValue.text = latency ? `${Math.round(latency.lossPct)}%` : _('N/A');

            this._setPhase(2, _('TESTING DOWNLOAD SPEED...'));
            const downMbps = await this._measure(test, server.host, 'download', DOWNLOAD_DURATION_MS, this._downValue);

            this._setPhase(3, _('TESTING UPLOAD SPEED...'));
            const upMbps = await this._measure(test, server.host, 'upload', UPLOAD_DURATION_MS, this._upValue);

            this._finish(downMbps, upMbps, latency ? `${Math.round(latency.pingMs)} ms` : _('N/A'));
        } catch (e) {
            // A cancelled test was already reset by _cancel() or by destroying the panel.
            if (isCancelled(e))
                return;
            logError(e as Error, 'SpeedMeter: Speed test failed');
            this._finish(0, 0, null);
        } finally {
            if (this._test === test)
                this._test = null;
        }
    }

    private async _measure(test: SpeedTest, host: string, direction: Direction, durationMs: number, label: St.Label): Promise<number> {
        this._progressFill.remove_all_transitions();
        this._progressFill.scale_x = 0;
        this._progressFill.style_class = `speed-meter-st-progress-fill progress-${direction}`;
        this._progressFill.ease({ scaleX: 1, duration: durationMs, mode: Clutter.AnimationMode.LINEAR });

        const mbps = await test.measureThroughput(host, direction, durationMs, value => {
            label.text = value.toFixed(1);
        });
        label.text = mbps > 0 ? mbps.toFixed(1) : '--';
        return mbps;
    }

    private _cancel(): void {
        this._test?.cancel();
        this._test = null;
        this._resetProgress();
        this._setPhase(-1, _('Test cancelled — press START TEST to try again'));
        this._runLabel.text = _('START TEST');
    }

    private _finish(downMbps: number, upMbps: number, ping: string | null): void {
        this._resetProgress();
        this._setPhase(PHASES.length, rating(downMbps));
        this._runLabel.text = _('RUN AGAIN');
        if (downMbps > 0) {
            Main.notify(_('Speedtest Complete'),
                _('Download: %s Mbps | Upload: %s Mbps | Ping: %s').format(downMbps.toFixed(1), upMbps.toFixed(1), ping ?? _('N/A')));
        }
    }

    private _resetProgress(): void {
        this._progressFill.remove_all_transitions();
        this._progressFill.scale_x = 0;
    }

    // Marks phases before `current` done, `current` active and the rest pending; -1 resets all.
    private _setPhase(current: number, status: string): void {
        this._statusLabel.text = status;
        this._phaseLabels.forEach((label, index) => {
            let state = 'pending';
            if (current >= 0 && index < current)
                state = 'done';
            else if (index === current)
                state = 'active';
            label.style_class = `speed-meter-st-phase-step speed-meter-st-phase-${state}`;
        });
    }

    private _setDropdownOpen(open: boolean): void {
        this._dropdownList.visible = open;
        this._dropdownArrow.icon_name = open ? 'pan-up-symbolic' : 'pan-down-symbolic';
        if (open)
            this._dropdownButton.add_style_class_name('active');
        else
            this._dropdownButton.remove_style_class_name('active');
    }

    private _selectLocation(index: number): void {
        if (this._test)
            return;
        this._locationIndex = index;
        this._serverLabel.text = _(LOCATIONS[index].label);
        this._statusLabel.text = _('Press START TEST to begin');
        this._updateLocationChecks();
        this._setDropdownOpen(false);
    }

    private _updateLocationChecks(): void {
        this._locationButtons.forEach((button, index) => {
            const selected = index === this._locationIndex;
            this._locationChecks[index].visible = selected;
            if (selected)
                button.add_style_class_name('selected');
            else
                button.remove_style_class_name('selected');
        });
    }
}

