import type { NS } from "netscript";
import { CONFIG } from "gang/config";

const MAX_MEMBERS = 12;

function makeName(id: number): string {
    return `GangMember${id}`;
}

export async function main(ns: NS) {
    const flags = ns.flags([
        ["help", false],
    ]);

    if (typeof flags.help !== "boolean" || flags.help) {
        ns.tprint(`USAGE: run ${ns.getScriptName()}

Automatically recruit gang members and assign them all to the configured training task.

Example:
  > run ${ns.getScriptName()}

CONFIG VALUES
  GANG_trainingTask  Name of the task used for training
`);
        return;
    }

    if (!ns.gang.inGang()) {
        ns.tprint("No gang to manage.");
        return;
    }

    let nextId = ns.gang.getMemberNames().length + 1;

    while (true) {
        if (ns.gang.canRecruitMember() && ns.gang.getGangInformation().respect >= ns.gang.respectForNextRecruit() && ns.gang.getMemberNames().length < MAX_MEMBERS) {
            const name = makeName(nextId++);
            ns.gang.recruitMember(name);
        }

        for (const name of ns.gang.getMemberNames()) {
            ns.gang.setMemberTask(name, CONFIG.trainingTask);
        }

        await ns.gang.nextUpdate();
    }
}
