import type { NS } from "netscript";

/**
 * Calculate the expected monetary value generated per RAM-second for a full
 * hacking batch using built-in Netscript analysis functions.
 *
 * @param ns      - Netscript API instance
 * @param host    - Hostname of the target server
 * @param spacing - Delay (ms) between batch phases
 * @returns Expected value per RAM-second
 */
export function expectedValuePerRamSecond(
    ns: NS,
    host: string,
    spacing: number,
): number {
    const maxMoney = ns.getServerMaxMoney(host);

    const expectedHackValue =
        maxMoney * ns.hackAnalyze(host) * ns.hackAnalyzeChance(host);

    const afterHackMoney = Math.max(0, maxMoney - expectedHackValue);
    const growMultiplier = maxMoney / Math.max(1, afterHackMoney);
    const growThreads = ns.growthAnalyze(host, growMultiplier);

    const hackSecInc = ns.hackAnalyzeSecurity(1, host);
    const growSecInc = ns.growthAnalyzeSecurity(growThreads, host);
    const weakenThreads = (hackSecInc + growSecInc) / ns.weakenAnalyze(1);

    const ramUse =
        ns.getScriptRam("/batch/h.js") +
        growThreads * ns.getScriptRam("/batch/g.js") +
        weakenThreads * ns.getScriptRam("/batch/w.js");

    const batchTime = ns.getWeakenTime(host) + 2 * spacing;

    return expectedHackValue / (batchTime * ramUse);
}
