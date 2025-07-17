import { computeTerritoryBonus } from "gang/territory-manager";
import { describe, expect, test } from "@jest/globals";

describe("territory bonus", () => {
    test("increases with territory", () => {
        expect(computeTerritoryBonus(0.5)).toBeCloseTo(1.5);
    });
});
