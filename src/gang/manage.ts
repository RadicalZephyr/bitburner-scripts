import type { GangMemberAscension, GangMemberInfo, MoneySource, NS } from "netscript";
import { ALLOC_ID, MEM_TAG_FLAGS } from "services/client/memory_tag";
import { registerAllocationOwnership } from "services/client/memory";
import { CONFIG } from "gang/config";
import { purchaseBestGear } from "gang/equipment-manager";
import { TaskAnalyzer } from "gang/task-analyzer";
import { StatTracker } from "util/stat-tracker";

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
        ...MEM_TAG_FLAGS
    ]);

    if (flags.help) {
        ns.tprint(`USAGE: run ${ns.getScriptName()}

Automate gang recruitment and task assignments.

Example:
  > run ${ns.getScriptName()}

CONFIG VALUES
  GANG_ascendThreshold   Ascension multiplier required to ascend
  GANG_trainingPercent   Fraction of members training
  GANG_maxWantedPenalty  Maximum wanted penalty before switching members to cooling tasks
  GANG_minWantedLevel    Wanted level where heating resumes
  GANG_jobCheckInterval  Delay between evaluations`);
        return;
    }

    let allocationId = flags[ALLOC_ID];
    if (allocationId !== -1) {
        if (typeof allocationId !== 'number') {
            ns.tprint('--allocation-id must be a number');
            return;
        }
        await registerAllocationOwnership(ns, allocationId, "self");
    }

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

    const moneyTracker = new StatTracker<MoneySource>();

    while (true) {
        moneyTracker.update(ns.getMoneySources().sinceInstall);

        const analyzer = new TaskAnalyzer(ns);
        analyzer.refresh();
        const profiles = analyzer.roleProfiles();

        if (ns.gang.canRecruitMember() && nameIndex < availableNames.length) {
            const name = availableNames[nameIndex++];
            if (ns.gang.recruitMember(name)) {
                memberNames.push(name);
            }
        }

        const info = ns.gang.getGangInformation();
        if (info.wantedPenalty > CONFIG.maxWantedPenalty && info.wantedLevelGainRate > 0) {
            numHeating--;
        } else if (info.wantedLevel < CONFIG.minWantedLevel && info.wantedLevelGainRate < 0) {
            numHeating++;
        }

        const [ascend, training, working] = splitMembers(ns, memberNames);

        if (ascend) {
            ns.gang.setMemberTask(ascend.name, trainingTask);
            ns.gang.ascendMember(ascend.name);
        }

        for (const m of training) {
            purchaseBestGear(ns, m.name, "bootstrapping", moneyTracker, profiles.bootstrapping)
            ns.gang.setMemberTask(m.name, trainingTask);
        }

        numHeating = Math.min(working.length, numHeating);

        for (const m of working.slice(numHeating)) ns.gang.setMemberTask(m.name, coolTask);
        for (const m of working.slice(0, numHeating)) ns.gang.setMemberTask(m.name, heatTask);

        await ns.gang.nextUpdate();
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
