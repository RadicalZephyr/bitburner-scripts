import type { GangMemberInfo, NS } from "netscript";

export async function main(ns: NS) {
    const jobCheckInterval = 1000 * 60;

    const trainingTask = "Train Hacking";
    const heatTask = "Identity Theft";
    const coolTask = "Ethical Hacking";

    const memberNames = ns.gang.getMemberNames();

    const [trainingMembers, workingMembers] = splitMembers(ns, memberNames);
    trainingMembers.forEach(m => ns.gang.setMemberTask(m.name, trainingTask));

    workingMembers.sort((a, b) => a.hack_asc_points - b.hack_asc_points);

    // Figure out a rough distribution of members to balance heating
    // and cooling. This could be off by one if the last member in the
    // list gets assigned to heating and this changes our wanted gain
    // to positive.
    let numHeating = 0;
    while (workingMembers.length > 0) {
        const gangInfo = ns.gang.getGangInformation();

        if (gangInfo.wantedLevelGainRate > 0) {
            // Take from the high end if cooling
            const member = workingMembers.pop();
            ns.gang.setMemberTask(member.name, coolTask);
        } else {
            // Take from the low end if heating
            const member = workingMembers.shift();
            ns.gang.setMemberTask(member.name, heatTask);
            ++numHeating;
        }
        await ns.sleep(500);
    }


    // forever
    while (true) {
        const gangInfo = ns.gang.getGangInformation();
        if (gangInfo.wantedPenalty > 0.05 && gangInfo.wantedLevelGainRate > 0) {
            // If we're starting to get some heat and still heating,
            // then cool things off for a bit.
            --numHeating;
        } else if (gangInfo.wantedLevel == 1.0 && gangInfo.wantedLevelGainRate < 0) {
            // If we're totally cool and still cooling, then we can
            // afford to heat for a cycle.
            ++numHeating;
        }

        const [trainingMembers, workingMembers] = splitMembers(ns, memberNames);
        trainingMembers.forEach(m => ns.gang.setMemberTask(m.name, trainingTask));

        // Sort by hack level
        workingMembers.sort((a, b) => a.hack_asc_points - b.hack_asc_points);

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

class Stats {
    iqr: number;
    upper_fence: number;
    upper_quartile: number;
    median: number;
    lower_quartile: number;
    lower_fence: number;

    constructor(values: number[]) {
        values.sort((a, b) => a - b);
        const len = values.length;
        this.median = Math.ceil(len / 2);
        this.lower_quartile = Math.ceil(this.median / 2);
        this.upper_quartile = Math.ceil((len + this.median) / 2);
        this.iqr = this.upper_quartile - this.lower_quartile;
        this.upper_fence = this.upper_quartile + (1.5 * this.iqr);
        this.lower_fence = this.lower_quartile - (1.5 * this.iqr);
    }

    isLowOutlier(val: number): boolean {
        return val < this.lower_fence;
    }
};

function splitMembers(ns: NS, memberNames: string[]): [GangMemberInfo[], GangMemberInfo[]] {
    // Get current gang member levels
    const members = memberNames.map(m => ns.gang.getMemberInformation(m));

    const memberXPStats = new Stats(members.map(m => m.hack_asc_points));

    const trainingMembers = members.filter(m => memberXPStats.isLowOutlier(m.hack_asc_points));
    const workingMembers = members.filter(m => !memberXPStats.isLowOutlier(m.hack_asc_points));

    return [trainingMembers, workingMembers];
}
