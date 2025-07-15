import { setLocalStorage } from "util/localStorage";
import { describe, expect, test, beforeAll } from "@jest/globals";

let computeROI: typeof import("gang/equipment-manager").computeROI;

beforeAll(() => {
    const store: Record<string, string> = {};
    const ls: Storage = {
        get length() { return Object.keys(store).length; },
        clear: () => { for (const k in store) delete store[k]; },
        key: i => Object.keys(store)[i],
        getItem: k => store[k],
        removeItem: k => { delete store[k]; },
        setItem: (k, v) => { store[k] = v; }
    };
    setLocalStorage(ls);
    return import("gang/equipment-manager").then(mod => {
        computeROI = mod.computeROI;
    });
});

describe("equipment ROI", () => {
    test("returns cost over gain", () => {
        expect(computeROI(100, 10)).toBe(10);
    });

    test("handles zero gain", () => {
        expect(computeROI(50, 0)).toBe(Infinity);
    });
});
