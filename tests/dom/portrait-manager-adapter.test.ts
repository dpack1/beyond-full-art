import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  findPortraitManagementTargets,
  observePortraitManagementTargets,
} from '../../src/platform/dndbeyond/portrait-manager-adapter';
import {PORTRAIT_MANAGER_FIXTURE} from '../fixtures/portrait-manager';

describe('portrait manager adapter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('finds portrait-management upload surfaces', () => {
    document.body.innerHTML = PORTRAIT_MANAGER_FIXTURE;

    const targets = findPortraitManagementTargets(document);

    expect(targets).toHaveLength(1);
    expect(targets[0]?.uploadInput.type).toBe('file');
  });

  it('observes lazily rendered portrait-management surfaces', async () => {
    let callbackCount = 0;
    const stopObserving = observePortraitManagementTargets(() => {
      callbackCount += 1;
    });

    document.body.innerHTML = PORTRAIT_MANAGER_FIXTURE;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callbackCount).toBe(1);

    stopObserving();
  });
});
