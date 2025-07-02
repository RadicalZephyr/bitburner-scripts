import type { GangMemberAscension, GangMemberInfo, NS } from "netscript";
import { CONFIG } from "gang/config";

const NAMES = [
    "Freya",
    "Frigg",
    "Gefion",
    "Idun",
    "Sif",
    "Sigyn",
    "Eir",
    "Fulla",
    "Gna",
    "Hlin",
    "Ilmrxs",
    "Hel",
];

export async function main(ns: NS) {
    const flags = ns.flags([
        ["help", false],
    ]);

    if (flags.help) {
        ns.tprint(`USAGE: run ${ns.getScriptName()}

Automate gang recruitment and task assignments.

Example:
  > run ${ns.getScriptName()}

CONFIG VALUES
  GANG_ASCEND_THRESHOLD   Ascension multiplier required to ascend
  GANG_TRAINING_PERCENT   Fraction of members training
  GANG_MAX_WANTED_PENALTY Maximum wanted penalty before cooling
  GANG_MIN_WANTED_LEVEL   Wanted level where heating resumes
  GANG_JOB_CHECK_INTERVAL Delay between evaluations`);
        return;
    }

    CONFIG.setDefaults();

    if (!ns.gang.inGang()) {
        ns.tprint("No gang to manage.");
        return;
    }

    const currentNames = new Set(ns.gang.getMemberNames());
    const availableNames = NAMES.filter(n => !currentNames.has(n));
    let nameIndex = 0;

    const isHackingGang = ns.gang.getGangInformation().isHacking;
    const trainingTask = isHackingGang ? "Train Hacking" : "Train Combat";
    const heatTask = isHackingGang ? "Money Laundering" : "Strongarm Civilians";
    const coolTask = isHackingGang ? "Ethical Hacking" : "Vigilante Justice";

    const memberNames = ns.gang.getMemberNames();

    let numHeating = memberNames.length;

    while (true) {
        if (ns.gang.canRecruitMember() && nameIndex < availableNames.length) {
            const name = availableNames[nameIndex++];
            if (ns.gang.recruitMember(name)) {
                memberNames.push(name);
            }
        }

        const info = ns.gang.getGangInformation();
        if (info.wantedPenalty > CONFIG.maxPenalty && info.wantedLevelGainRate > 0) {
            numHeating--;
        } else if (info.wantedLevel < CONFIG.minWantedLevel && info.wantedLevelGainRate < 0) {
            numHeating++;
        }

        const [ascend, training, working] = splitMembers(ns, memberNames);

        if (ascend) {
            ns.gang.setMemberTask(ascend.name, trainingTask);
            ns.gang.ascendMember(ascend.name);
        }

        for (const m of training) ns.gang.setMemberTask(m.name, trainingTask);

        numHeating = Math.min(working.length, numHeating);

        for (const m of working.slice(numHeating)) ns.gang.setMemberTask(m.name, coolTask);
        for (const m of working.slice(0, numHeating)) ns.gang.setMemberTask(m.name, heatTask);

        await ns.sleep(CONFIG.jobCheckInterval);
    }
}

function splitMembers(ns: NS, memberNames: string[]): [GangMemberInfo | null, GangMemberInfo[], GangMemberInfo[]] {
    const isHackingGang = ns.gang.getGangInformation().isHacking;
    const ascMult = isHackingGang ? hackAscMult : combatAscMult;
    const lvl = isHackingGang ? hackLevel : combatLevel;
    const ascResultMult = isHackingGang ? hackResultMult : combatResultMult;

    let members = memberNames.map(m => ns.gang.getMemberInformation(m));
    members.sort((a, b) => ascMult(a) - ascMult(b));

    let ascendingMember: GangMemberInfo | null = null;
    const result = ns.gang.getAscensionResult(members[0].name);
    if (result && ascResultMult(result) > CONFIG.ascendThreshold) {
        ascendingMember = members.shift() || null;
    }

    members.sort((a, b) => lvl(a) - lvl(b));

    const numTrain = Math.max(0, Math.floor(members.length * CONFIG.trainingPercent));
    const trainingMembers = members.slice(0, numTrain);
    const workingMembers = members.slice(numTrain);

    return [ascendingMember, trainingMembers, workingMembers];
}

function hackAscMult(m: GangMemberInfo): number { return m.hack_asc_mult; }
function hackLevel(m: GangMemberInfo): number { return m.hack; }
function hackResultMult(r: GangMemberAscension): number { return r.hack; }
function combatAscMult(m: GangMemberInfo): number { return m.agi_asc_mult + m.def_asc_mult + m.dex_asc_mult + m.str_asc_mult; }
function combatLevel(m: GangMemberInfo): number { return m.agi + m.def + m.dex + m.str; }
function combatResultMult(r: GangMemberAscension): number { return (r.agi + r.def + r.dex + r.str) / 4; }
