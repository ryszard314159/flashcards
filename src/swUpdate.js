/**
 * src/swUpdate.js
 * Service worker update flow helpers.
 */
import { CONFIG } from './config.js';

// Module-level SW state
let isActivatingUpdate = false;
let isRefreshing = false;
let hasPendingUpdate = false;

export function getIsRefreshing() { return isRefreshing; }
export function setIsRefreshing(value) { isRefreshing = value; }
export function getHasPendingUpdate() { return hasPendingUpdate; }

export function markUpdateAvailable(ui) {
    hasPendingUpdate = true;
    if (ui?.versionTag) {
        ui.versionTag.classList.add('is-update-available');
    }
}

export async function fetchLatestVersionFromNetwork() {
    const response = await fetch(`./src/config.js?version-check=${Date.now()}`, {
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error(`Version check failed with status ${response.status}`);
    }

    const source = await response.text();
    const match = source.match(/VERSION:\s*"(\d{4}-\d{2}-\d{2}\.\d{4})"/);

    if (!match) {
        throw new Error('Version check could not parse VERSION from config.js');
    }

    return match[1];
}

export async function hasNewerRemoteVersion() {
    try {
        const latestVersion = await fetchLatestVersionFromNetwork();
        return latestVersion > CONFIG.VERSION;
    } catch {
        return false;
    }
}

export function waitForWaitingWorker(reg, timeoutMs = 8000) {
    if (reg.waiting) {
        return Promise.resolve(reg.waiting);
    }

    return new Promise((resolve) => {
        let resolved = false;

        const finish = (worker) => {
            if (resolved) {
                return;
            }
            resolved = true;
            clearTimeout(timeoutId);
            resolve(worker || null);
        };

        const tryResolveWaiting = () => {
            if (reg.waiting) {
                finish(reg.waiting);
                return true;
            }
            return false;
        };

        const attachInstallingWatcher = (worker) => {
            if (!worker) {
                return;
            }
            worker.addEventListener('statechange', () => {
                if (worker.state === 'installed') {
                    tryResolveWaiting();
                }
            });
        };

        if (tryResolveWaiting()) {
            return;
        }

        attachInstallingWatcher(reg.installing);

        const onUpdateFound = () => {
            attachInstallingWatcher(reg.installing);
            tryResolveWaiting();
        };

        reg.addEventListener('updatefound', onUpdateFound, { once: true });

        const timeoutId = setTimeout(() => {
            finish(reg.waiting || null);
        }, timeoutMs);

        reg.update().catch(() => {
            finish(reg.waiting || null);
        });
    });
}

export async function activatePendingUpdateFromVersionTag(reg, versionTag, options = {}) {
    if (!versionTag?.classList?.contains('is-update-available')) {
        return false;
    }

    if (isActivatingUpdate) {
        return false;
    }

    isActivatingUpdate = true;
    const previousCursor = versionTag.style.cursor;
    versionTag.style.cursor = 'progress';

    const worker = await waitForWaitingWorker(reg);
    if (worker) {
        worker.postMessage({ type: 'SKIP_WAITING' });

        const schedule = options.schedule || setTimeout;
        const reload = options.reload || (() => window.location.reload());

        // Fallback: if oncontrollerchange doesn't fire, reload after a delay.
        schedule(() => {
            if (!isRefreshing) {
                isRefreshing = true;
                reload();
            }
        }, 2000);
    } else if (typeof options.onNoWaitingWorker === 'function') {
        await options.onNoWaitingWorker();
    }

    if (!isRefreshing) {
        isActivatingUpdate = false;
        versionTag.style.cursor = previousCursor || 'pointer';
    }

    return Boolean(worker);
}

export function activateWaitingWorkerImmediately(reg) {
    if (!reg?.waiting) {
        return false;
    }

    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    return true;
}

export function bindVersionTagUpdateHandler(ui, swRegistration, refreshUpdateStatusFn) {
    if (!ui?.versionTag) {
        return;
    }

    ui.versionTag.style.cursor = 'pointer';
    ui.versionTag.onclick = async (e) => {
        if (!ui.versionTag.classList.contains('is-update-available')) {
            return; // Only allow click if update is available
        }

        if (!swRegistration) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        await activatePendingUpdateFromVersionTag(swRegistration, ui.versionTag, {
            onNoWaitingWorker: () => refreshUpdateStatusFn?.(),
        });
    };
}
