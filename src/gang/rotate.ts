import type { NS } from "netscript";

export async function main(ns: NS) {
    const jobCheckInterval = 1000 * 10;

    const heatTask = "Identity Theft";
    const coolTask = "Ethical Hacking";

    const members = ns.gang.getMemberNames();

    // TODO: remove members from the list for heating/cooling if their
    // hacking skill is far too low, they should be training!

    let numHeating = 0;
    for (const member of members) {
        const gangInfo = ns.gang.getGangInformation();

        if (gangInfo.wantedLevelGainRate > 0) {
            ns.gang.setMemberTask(member, coolTask);
        } else {
            ns.gang.setMemberTask(member, heatTask);
            ++numHeating;
        }
        await ns.sleep(50);
    }

    // forever
    while (true) {
        // Get current gang member levels
        const memberInfos = members.map(m => ns.gang.getMemberInformation(m));

        // Sort by hack level
        memberInfos.sort((a, b) => a.hack - b.hack);

        // Partition into two groups:

        // The `members.length - numHeating` top should be doing
        // cooling, because that gives less experience.
        memberInfos
            .slice(numHeating)
            .forEach(cooler => ns.gang.setMemberTask(cooler.name, coolTask));

        // The `numHeating` lowest level members should be the ones
        // criming, because that gives more experience.
        memberInfos
            .slice(0, numHeating)
            .forEach(heater => ns.gang.setMemberTask(heater.name, heatTask));

        // Then sleep for a while so we don't change jobs too often.
        await ns.sleep(jobCheckInterval);
    }
}
