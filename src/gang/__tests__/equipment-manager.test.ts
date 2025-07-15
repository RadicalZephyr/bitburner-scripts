import { setLocalStorage } from "util/localStorage";
import { describe, expect, test, beforeAll } from "@jest/globals";

let calculateROI: (c: number, g: number) => number;

beforeAll(async () => {
    const memoryStorage: Storage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
    };
    setLocalStorage(memoryStorage);
    ({ calculateROI } = await import("gang/equipment-manager"));
});

describe("equipment ROI", () => {
    test("returns cost over gain", () => {
        expect(calculateROI(100, 10)).toBe(10);
    });

    test("handles zero gain", () => {
        expect(calculateROI(50, 0)).toBe(Infinity);
    });
});
