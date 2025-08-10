import type { NS } from 'netscript';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';

jest.mock('batch/expected_value', () => ({
    expectedValueForMemory: jest.fn(),
    maxHackPercentForMemory: jest.fn(),
    calculateBatchLogistics: jest.fn(),
    availableBatchCount: jest.fn(),
}));

import type { HarvestClient } from '../client/harvest';
import type { MonitorClient } from '../client/monitor';
import type { LaunchClient } from '../../services/client/launch';
import type { FreeRam } from '../../services/client/memory';
import { setLocalStorage } from '../../util/localStorage';

const {
    expectedValueForMemory,
    maxHackPercentForMemory,
    calculateBatchLogistics,
    availableBatchCount,
} = jest.requireMock('batch/expected_value') as Record<string, jest.Mock>;

function makeNS(): NS {
    return {
        getHackingLevel: () => 100,
        getServerRequiredHackingLevel: () => 0,
        getScriptRam: () => 1,
        print: () => undefined,
    } as unknown as NS;
}

describe('TaskSelector rebalancing', () => {
    let TaskSelector: typeof import('../task_selector').TaskSelector;
    let selector: import('../task_selector').TaskSelector;
    let CONFIG: typeof import('../config').CONFIG;
    const shutdownA = jest.fn();
    const shutdownB = jest.fn();
    const memCalls: number[] = [];
    const candidateMem: number[] = [];

    beforeEach(async () => {
        jest.clearAllMocks();
        const store: Record<string, string> = {};
        const ls: Storage = {
            get length() {
                return Object.keys(store).length;
            },
            clear: () => {
                for (const k in store) delete store[k];
            },
            key: (i) => Object.keys(store)[i],
            getItem: (k) => store[k],
            removeItem: (k) => {
                delete store[k];
            },
            setItem: (k, v) => {
                store[k] = v;
            },
        };
        setLocalStorage(ls);
        ({ CONFIG } = await import('../config'));
        TaskSelector = (await import('../task_selector')).TaskSelector;
        const ns = makeNS();
        selector = new TaskSelector(
            ns,
            {} as unknown as MonitorClient,
            {} as unknown as LaunchClient,
        );
        CONFIG.expectedValueThreshold = 0;
        CONFIG.harvestGainThreshold = 0;
        const sel = selector as unknown as {
            pushTarget: (host: string) => Promise<void>;
            launchHarvest: jest.Mock;
        };
        sel.pushTarget = jest.fn(async () => undefined);
        sel.launchHarvest = jest.fn(async () => undefined);

        selector.launchedHarvestTasks.set('a', {
            target: 'a',
            host: 'a',
            hackPercent: 0.1,
            profit: 0,
            value: 1,
            requiredRam: 10,
            batchRam: 10,
            overlap: 1,
            endingPeriod: 1000,
            phases: [],
            client: { shutdown: shutdownA } as unknown as HarvestClient,
        });
        selector.launchedHarvestTasks.set('b', {
            target: 'b',
            host: 'b',
            hackPercent: 0.1,
            profit: 0,
            value: 2,
            requiredRam: 20,
            batchRam: 10,
            overlap: 1,
            endingPeriod: 1000,
            phases: [],
            client: { shutdown: shutdownB } as unknown as HarvestClient,
        });
        selector.harvestTargets = new Set(['a', 'b']);
        selector.pendingHarvestTargets = ['c'];

        expectedValueForMemory.mockImplementation(
            (ns: NS, host: string, mem: FreeRam) => {
                if (host === 'a')
                    return {
                        hackPercent: 0.1,
                        profit: 0,
                        expectedValue: 1,
                        requiredRam: 10,
                    };
                if (host === 'b')
                    return {
                        hackPercent: 0.1,
                        profit: 0,
                        expectedValue: 2,
                        requiredRam: 20,
                    };
                candidateMem.push(mem.freeRam);
                return {
                    hackPercent: 0.5,
                    profit: 0,
                    expectedValue: 3,
                    requiredRam: 40,
                };
            },
        );
        maxHackPercentForMemory.mockImplementation(
            (ns: NS, _h: string, mem: FreeRam) => {
                memCalls.push(mem.freeRam);
                return 0.5;
            },
        );
        calculateBatchLogistics.mockReturnValue({
            target: 'c',
            batchRam: 10,
            overlap: 1,
            endingPeriod: 1000,
            requiredRam: 40,
            phases: [],
        });
        availableBatchCount.mockReturnValue(1);
    });

    test('stops weaker harvests and launches new target', async () => {
        const memInfo: FreeRam = {
            freeRam: 20,
            chunks: [{ hostname: 'home', freeRam: 20 }],
        };
        await selector.launchPendingTasks(memInfo);
        expect(shutdownA).toHaveBeenCalled();
        expect(shutdownB).toHaveBeenCalled();
        const sel = selector as unknown as {
            launchHarvest: jest.Mock;
        };
        expect(sel.launchHarvest).toHaveBeenCalledTimes(1);
        const args = sel.launchHarvest.mock.calls[0][0] as { host: string };
        expect(args.host).toBe('c');
        expect(memCalls).toContain(50);
        expect(candidateMem).toEqual([20, 50]);
    });
});
