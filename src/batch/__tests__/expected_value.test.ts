import type { NS } from 'netscript';
import { describe, expect, test, beforeAll } from '@jest/globals';

let expectedValueForMemory: typeof import('batch/expected_value').expectedValueForMemory;
let maxHackPercentForMemory: typeof import('batch/expected_value').maxHackPercentForMemory;
let CONFIG: typeof import('batch/config').CONFIG;
import type { FreeRam } from 'services/client/memory';
import { setLocalStorage } from 'util/localStorage';

function makeNS(): NS {
    return {
        hackAnalyze: () => 0.1,
        hackAnalyzeChance: () => 1,
        hackAnalyzeSecurity: (t: number) => 0.002 * t,
        growthAnalyze: (_host: string, mult: number) => mult,
        growthAnalyzeSecurity: (t: number) => 0.004 * t,
        getScriptRam: () => 1,
        getHackTime: () => 1,
        getWeakenTime: () => 4,
        getGrowTime: () => 2,
        getServer: () => ({ moneyMax: 1000, moneyAvailable: 1000 }),
        getServerMaxMoney: () => 1000,
        getServerMoneyAvailable: () => 1000,
        fileExists: () => false,
        getPlayer: () => ({}),
        formatRam: (n: number) => `${n}`,
    } as unknown as NS;
}

describe('memory aware expected value', () => {
    beforeAll(async () => {
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
        const mod = await import('batch/expected_value');
        expectedValueForMemory = mod.expectedValueForMemory;
        maxHackPercentForMemory = mod.maxHackPercentForMemory;
        CONFIG = (await import('batch/config')).CONFIG;
    });
    const ns = makeNS();
    const host = 'home';

    test('maxHackPercent adapts to memory limits', () => {
        const ample: FreeRam = {
            freeRam: 10,
            chunks: [{ hostname: 'home', freeRam: 10 }],
        };
        const limited: FreeRam = {
            freeRam: 6,
            chunks: [{ hostname: 'home', freeRam: 6 }],
        };
        const none: FreeRam = {
            freeRam: 4,
            chunks: [{ hostname: 'home', freeRam: 4 }],
        };

        expect(maxHackPercentForMemory(ns, host, ample)).toBeCloseTo(
            CONFIG.maxHackPercent,
            2,
        );
        expect(maxHackPercentForMemory(ns, host, limited)).toBeLessThan(
            CONFIG.maxHackPercent,
        );
        expect(maxHackPercentForMemory(ns, host, none)).toBe(0);
    });

    test('expected value falls with limited memory and zero when no batch fits', () => {
        const ample: FreeRam = {
            freeRam: 10,
            chunks: [{ hostname: 'home', freeRam: 10 }],
        };
        const limited: FreeRam = {
            freeRam: 6,
            chunks: [{ hostname: 'home', freeRam: 6 }],
        };
        const none: FreeRam = {
            freeRam: 4,
            chunks: [{ hostname: 'home', freeRam: 4 }],
        };

        const high = expectedValueForMemory(ns, host, ample);
        const low = expectedValueForMemory(ns, host, limited);
        expect(low).toBeLessThan(high);
        expect(expectedValueForMemory(ns, host, none)).toBe(0);
    });
});
