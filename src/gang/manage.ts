import type { GangMemberAscension, GangMemberInfo, NS } from "netscript";

const ascendThreshold = 1.01;
const trainingPercent = 4 / 12;

const maxPenalty = 0.05;
const minWantedLevel = 10.0;
const jobCheckInterval = 1000 * 5;

const names = new Set([
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
    "Hel"
]);

export async function main(ns: NS) {
    if (!ns.gang.inGang()) {
        ns.tprint("No gang to manage.");
        return;
    }

    const currentNames = new Set(ns.gang.getMemberNames());
    const unusedNames = new Array(...(difference(names, currentNames).keys()));
    let nameIndex = 0;

    const isHacking = ns.gang.getGangInformation().isHacking;

    const trainingTask = isHacking ? "Train Hacking" : "Train Combat";
    const heatTask = isHacking ? "Money Laundering" : "Strongarm Civilians";
    const coolTask = isHacking ? "Ethical Hacking" : "Vigilante Justice";

    let memberNames = ns.gang.getMemberNames();

    // Start with everyone making money
    let numHeating = memberNames.length;

    // forever
    while (true) {
        if (ns.gang.canRecruitMember()) {
            const name = unusedNames[nameIndex++];

            if (ns.gang.recruitMember(name)) {
                memberNames.push(name);
            }
        }

        const gangInfo = ns.gang.getGangInformation();
        if (gangInfo.wantedPenalty > maxPenalty && gangInfo.wantedLevelGainRate > 0) {
            // If we're starting to get some heat and still heating,
            // then cool things off for a bit.
            --numHeating;
        } else if (gangInfo.wantedLevel < minWantedLevel && gangInfo.wantedLevelGainRate < 0) {
            // If we're totally cool and still cooling, then we can
            // afford to heat for a cycle.
            ++numHeating;
        }

        const [ascendingMember, trainingMembers, workingMembers] = splitMembers(ns, memberNames);

        if (ascendingMember) {
            ns.gang.setMemberTask(ascendingMember.name, trainingTask);
            ns.gang.ascendMember(ascendingMember.name);
        }

        trainingMembers.forEach(m => ns.gang.setMemberTask(m.name, trainingTask));

        // Cap the number of heaters to not be more than the total
        // number of workers.
        numHeating = Math.min(workingMembers.length, numHeating);

        // Partition into two groups:

        // The `members.length - numHeating` top should be doing
        // cooling, because that gives less experience.
        workingMembers
            .slice(numHeating)
            .forEach(cooler => ns.gang.setMemberTask(cooler.name, coolTask));

        // The `numHeating` lowest level members should be the ones
        // criming, because that gives more experience.
        workingMembers
            .slice(0, numHeating)
            .forEach(heater => ns.gang.setMemberTask(heater.name, heatTask));

        // Then sleep for a while so we don't change jobs too often.
        await ns.sleep(jobCheckInterval);
    }
}

function splitMembers(ns: NS, memberNames: string[]): [GangMemberInfo, GangMemberInfo[], GangMemberInfo[]] {
    const isHacking = ns.gang.getGangInformation().isHacking;

    let ascMult = isHacking ? hackAscMult : combatAscMult;
    let lvl = isHacking ? hackLevel : combatLevel;
    let ascResultMult = isHacking ? hackResultMult : combatResultMult;

    // Get current gang member levels
    let members = memberNames.map(m => ns.gang.getMemberInformation(m));

    // Sort by highest ascension multiplier
    members.sort((a, b) => ascMult(a) - ascMult(b));

    // Lowest multiplier member gets ascended if they will gain enough bonus
    let ascendingMember;
    const ascResult = ns.gang.getAscensionResult(members[0].name);
    if (ascResult && ascResultMult(ascResult) > ascendThreshold) {
        ascendingMember = members.shift();
    }

    members.sort((a, b) => lvl(a) - lvl(b));

    const numberToTrain = Math.max(0, Math.floor(members.length * trainingPercent));

    const trainingMembers = members.slice(0, numberToTrain);
    const workingMembers = members.slice(numberToTrain);

    return [ascendingMember, trainingMembers, workingMembers];
}

function hackAscMult(m: GangMemberInfo): number {
    return m.hack_asc_mult;
}

function hackLevel(m: GangMemberInfo): number {
    return m.hack;
}

function hackResultMult(r: GangMemberAscension): number {
    return r.hack;
}

function combatAscMult(m: GangMemberInfo): number {
    return m.agi_asc_mult + m.def_asc_mult + m.dex_asc_mult + m.str_asc_mult;
}

function combatLevel(m: GangMemberInfo): number {
    return m.agi + m.def + m.dex + m.str;
}

function combatResultMult(r: GangMemberAscension): number {
    return (r.agi + r.def + r.dex + r.str) / 4;
}

function difference<T>(setA: Set<T>, setB: Set<T>): Set<T> {
    let _difference = new Set(setA)
    for (let elem of setB) {
        _difference.delete(elem)
    }
    return _difference
}
