/**
 * __tests__/sw-update-regression.test.js
 * Regression tests for service-worker update flow and remote version checks.
 */

import { jest } from '@jest/globals';

import {
  waitForWaitingWorker,
  fetchLatestVersionFromNetwork,
  hasNewerRemoteVersion,
  activatePendingUpdateFromVersionTag,
} from '../src/app.js';

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, handler, options = {}) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push({ handler, once: Boolean(options.once) });
  }

  dispatchEvent(type) {
    const entries = this.listeners.get(type) || [];
    const remaining = [];

    for (const entry of entries) {
      entry.handler();
      if (!entry.once) {
        remaining.push(entry);
      }
    }

    this.listeners.set(type, remaining);
  }
}

class FakeWorker extends FakeEventTarget {
  constructor() {
    super();
    this.state = 'installing';
  }

  setState(state) {
    this.state = state;
    this.dispatchEvent('statechange');
  }
}

class FakeRegistration extends FakeEventTarget {
  constructor() {
    super();
    this.waiting = null;
    this.installing = null;
    this.update = jest.fn().mockResolvedValue(undefined);
  }

  setInstalling(worker) {
    this.installing = worker;
    this.dispatchEvent('updatefound');
  }
}

describe('SW update regression helpers', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  test('waitForWaitingWorker resolves immediately when waiting worker exists', async () => {
    const reg = new FakeRegistration();
    const waitingWorker = { id: 'waiting-worker' };
    reg.waiting = waitingWorker;

    const result = await waitForWaitingWorker(reg, 50);

    expect(result).toBe(waitingWorker);
    expect(reg.update).not.toHaveBeenCalled();
  });

  test('waitForWaitingWorker resolves after installing worker reaches installed', async () => {
    const reg = new FakeRegistration();
    const worker = new FakeWorker();

    const promise = waitForWaitingWorker(reg, 200);

    reg.setInstalling(worker);
    reg.waiting = worker;
    worker.setState('installed');

    const result = await promise;

    expect(result).toBe(worker);
    expect(reg.update).toHaveBeenCalled();
  });

  test('waitForWaitingWorker resolves null on timeout with no waiting worker', async () => {
    const reg = new FakeRegistration();

    const result = await waitForWaitingWorker(reg, 10);

    expect(result).toBeNull();
    expect(reg.update).toHaveBeenCalled();
  });

  test('fetchLatestVersionFromNetwork parses semantic timestamp from config.js', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'export const CONFIG = { VERSION: "2026-03-12.1800" };',
    });

    const result = await fetchLatestVersionFromNetwork();

    expect(result).toBe('2026-03-12.1800');
  });

  test('hasNewerRemoteVersion returns false on network/parse failures', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));

    await expect(hasNewerRemoteVersion()).resolves.toBe(false);
  });

  test('activatePendingUpdateFromVersionTag sends SKIP_WAITING on first click', async () => {
    const reg = new FakeRegistration();
    const waitingWorker = {
      postMessage: jest.fn(),
    };
    reg.waiting = waitingWorker;

    const versionTag = document.createElement('span');
    versionTag.classList.add('is-update-available');
    versionTag.style.cursor = 'pointer';

    const didActivate = await activatePendingUpdateFromVersionTag(reg, versionTag, {
      schedule: jest.fn(),
    });

    expect(didActivate).toBe(true);
    expect(waitingWorker.postMessage).toHaveBeenCalledTimes(1);
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  test('activatePendingUpdateFromVersionTag ignores click when update flag is missing', async () => {
    const reg = new FakeRegistration();
    const waitingWorker = {
      postMessage: jest.fn(),
    };
    reg.waiting = waitingWorker;

    const versionTag = document.createElement('span');

    const didActivate = await activatePendingUpdateFromVersionTag(reg, versionTag, {
      schedule: jest.fn(),
    });

    expect(didActivate).toBe(false);
    expect(waitingWorker.postMessage).not.toHaveBeenCalled();
  });
});
