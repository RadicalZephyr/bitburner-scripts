import { setLocalStorage } from "util/localStorage";

let computeROI: typeof import("gang/equipment-manager").computeROI;

beforeAll(() => {
    const store: Record<string, string> = {};
    const ls: Storage = {
        get length() { return Object.keys(store).length; },
        clear: () => { for (const k in store) delete store[k]; },
        key: i => Object.keys(store)[i],
        getItem: k => store[k],
        removeItem: k => { delete store[k]; },
        setItem: (k,v) => { store[k] = v; }
    };
    setLocalStorage(ls);
    return import("gang/equipment-manager").then(mod => {
        computeROI = mod.computeROI;
    });
});

test("computeROI divides cost by gain", () => {
    expect(computeROI({ cost: 100, gainRate: 2 })).toBe(50);
});
