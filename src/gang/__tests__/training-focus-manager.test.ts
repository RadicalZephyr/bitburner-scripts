import { selectTrainingTask } from "gang/training-focus-manager";
import type { RoleProfiles } from "gang/task-analyzer";
import { describe, expect, test } from "@jest/globals";
import type { GangMemberInfo } from "netscript";

const profiles: RoleProfiles = {
    bootstrapping: { hackWeight: 1, strWeight: 1, defWeight: 1, dexWeight: 1, agiWeight: 1, chaWeight: 1 },
    respectGrind: { hackWeight: 0, strWeight: 5, defWeight: 5, dexWeight: 5, agiWeight: 5, chaWeight: 1 },
    moneyGrind: { hackWeight: 5, strWeight: 1, defWeight: 1, dexWeight: 1, agiWeight: 1, chaWeight: 0 },
    warfare: { hackWeight: 0, strWeight: 3, defWeight: 3, dexWeight: 3, agiWeight: 3, chaWeight: 0 },
    cooling: { hackWeight: 0, strWeight: 0, defWeight: 0, dexWeight: 0, agiWeight: 0, chaWeight: 1 }
};

const member: GangMemberInfo = {
    name: "A", task: "", earnedRespect: 0,
    hack: 1, str: 10, def: 10, dex: 10, agi: 10, cha: 1,
    hack_exp: 0, str_exp: 0, def_exp: 0, dex_exp: 0, agi_exp: 0, cha_exp: 0,
    hack_mult: 1, str_mult: 1, def_mult: 1, dex_mult: 1, agi_mult: 1, cha_mult: 1,
    hack_asc_mult: 1, str_asc_mult: 1, def_asc_mult: 1, dex_asc_mult: 1, agi_asc_mult: 1, cha_asc_mult: 1,
    hack_asc_points: 0, str_asc_points: 0, def_asc_points: 0, dex_asc_points: 0, agi_asc_points: 0, cha_asc_points: 0,
    upgrades: [], augmentations: [],
    respectGain: 0, wantedLevelGain: 0, moneyGain: 0, expGain: null
};

describe("training focus", () => {
    test("select combat training", () => {
        expect(selectTrainingTask(member, profiles)).toBe("Train Combat");
    });
});
