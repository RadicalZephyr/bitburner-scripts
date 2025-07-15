import type { GangMemberInfo } from "netscript";
import { chooseTrainingTask } from "gang/training-focus-manager";

const profiles = {
    bootstrapping: {
        hackWeight: 5,
        strWeight: 0,
        defWeight: 0,
        dexWeight: 0,
        agiWeight: 0,
        chaWeight: 0,
    }
};

const member = {
    name: "Test",
    task: "",
    earnedRespect: 0,
    hack: 1,
    str: 1,
    def: 1,
    dex: 1,
    agi: 1,
    cha: 1,
    hack_exp: 0,
    str_exp: 0,
    def_exp: 0,
    dex_exp: 0,
    agi_exp: 0,
    cha_exp: 0,
    hack_mult: 1,
    str_mult: 1,
    def_mult: 1,
    dex_mult: 1,
    agi_mult: 1,
    cha_mult: 1,
    hack_asc_mult: 1,
    str_asc_mult: 1,
    def_asc_mult: 1,
    dex_asc_mult: 1,
    agi_asc_mult: 1,
    cha_asc_mult: 1,
    hack_asc_points: 0,
    str_asc_points: 0,
    def_asc_points: 0,
    dex_asc_points: 0,
    agi_asc_points: 0,
    cha_asc_points: 0,
    upgrades: [],
    augmentations: [],
    respectGain: 0,
    wantedLevelGain: 0,
    moneyGain: 0,
    expGain: null,
} as GangMemberInfo;

test("chooseTrainingTask returns hacking when profile favors hacking", () => {
    const task = chooseTrainingTask(member, profiles);
    expect(task).toBe("Train Hacking");
});
