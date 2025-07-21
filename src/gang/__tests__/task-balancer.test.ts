import { describe, expect, test, beforeAll } from '@jest/globals';
import { setLocalStorage } from 'util/localStorage';
import type { NS } from 'netscript';
import type { TaskAnalyzer } from 'gang/task-analyzer';

let distributeTasks: typeof import('gang/task-balancer').distributeTasks;
const analyzer = {
  bestCoolingTasks: [{ name: 'cool' }],
  bestWarTasks: [{ name: 'war' }],
  bestRespectTasks: [{ name: 'respect' }],
  bestMoneyTasks: [{ name: 'money' }],
} as unknown as TaskAnalyzer;

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
  ({ distributeTasks } = await import('gang/task-balancer'));
});

function makeNS(penalty: number, territory: number, chance: number): NS {
  return {
    gang: {
      getGangInformation: () => ({
        respectForNextRecruit: 100,
        respect: 0,
        respectGainRate: 1,
        wantedPenalty: penalty,
        territory,
      }),
      getOtherGangInformation: () => ({ a: {}, b: {} }),
      getChanceToWinClash: () => chance,
      setMemberTask: () => {},
    },
  } as unknown as NS;
}

describe('distributeTasks', () => {
  test('assigns cooling and warfare members', () => {
    const ns = makeNS(0.04, 0.5, 0.4);
    const members = Array.from({ length: 10 }, (_, i) => `m${i}`);
    const result = distributeTasks(ns, members, analyzer);
    expect(result.cooling.length).toBe(0);
    expect(result.territoryWarfare.length).toBeGreaterThan(0);
  });
});
