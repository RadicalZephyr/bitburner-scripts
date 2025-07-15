import type { NS } from "netscript";
import { NAMES } from "gang/new-manage";

const MAX_MEMBERS = 12;

/**
 * Recruit and train gang members up to the maximum allowed.
 *
 * @param ns - Netscript API
 */
export async function main(ns: NS) {
    const flags = ns.flags([
        ["help", false],
    ]);

    if (typeof flags.help !== "boolean" || flags.help) {
        ns.tprint(`USAGE: run ${ns.getScriptName()}

Automatically recruit gang members and assign them all to training.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help  Show this help message`);
        return;
    }

    if (!ns.gang.inGang()) {
        ns.tprint("No gang to manage.");
        return;
    }

    const currentNames = new Set(ns.gang.getMemberNames());
    const availableNames = NAMES.filter(n => !currentNames.has(n));
    let nameIndex = 0;

    const trainingTask = ns.gang.getGangInformation().isHacking ?
        "Train Hacking" : "Train Combat";

    while (true) {
        if (
            ns.gang.canRecruitMember() &&
            ns.gang.getGangInformation().respect >= ns.gang.respectForNextRecruit() &&
            ns.gang.getMemberNames().length < MAX_MEMBERS &&
            nameIndex < availableNames.length
        ) {
            const name = availableNames[nameIndex++];
            if (ns.gang.recruitMember(name)) {
                currentNames.add(name);
            }
        }

        for (const name of ns.gang.getMemberNames()) {
            ns.gang.setMemberTask(name, trainingTask);
        }

        await ns.gang.nextUpdate();
    }
}
