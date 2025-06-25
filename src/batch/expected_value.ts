import type { AutocompleteData, NS } from "netscript";
import { CONFIG } from "./config";

export interface BatchThreadAnalysis {
    hackThreads: number;
    postHackWeakenThreads: number;
    growThreads: number;
    postGrowWeakenThreads: number;
}

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    let target = ns.args[0];
    if (typeof target !== 'string' || !ns.serverExists(target)) {
        ns.tprintf("target %s does not exist", target);
        return;
    }

    let eValue = expectedValuePerRamSecond(ns, target, CONFIG.batchInterval);
    ns.tprint(`${target} ${eValue}`);
}

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

    const successfulHackValue =
        maxMoney * ns.hackAnalyze(host);

    const expectedHackValue =
        successfulHackValue * ns.hackAnalyzeChance(host);

    const {
        hackThreads,
        growThreads,
        postHackWeakenThreads,
        postGrowWeakenThreads,
    } = analyzeBatchThreads(ns, host, maxMoney, successfulHackValue);

    const weakenThreads = postHackWeakenThreads + postGrowWeakenThreads;

    const ramUse =
        hackThreads * ns.getScriptRam("/batch/h.js") +
        growThreads * ns.getScriptRam("/batch/g.js") +
        weakenThreads * ns.getScriptRam("/batch/w.js");

    const batchTime = ns.getWeakenTime(host) + 2 * spacing;

    return expectedHackValue / (batchTime * ramUse);
}

function analyzeBatchThreads(
    ns: NS,
    host: string,
    maxMoney: number,
    successfulHackValue: number,
): BatchThreadAnalysis {
    const afterHackMoney = Math.max(0, maxMoney - successfulHackValue);
    const growMultiplier = maxMoney / Math.max(1, afterHackMoney);
    const growThreads = growthAnalyze(ns, host, afterHackMoney, growMultiplier);

    const hackSecInc = ns.hackAnalyzeSecurity(1, host);
    const growSecInc = ns.growthAnalyzeSecurity(growThreads, host);

    return {
        hackThreads: 1,
        postHackWeakenThreads: weakenThreadsNeeded(hackSecInc),
        growThreads,
        postGrowWeakenThreads: weakenThreadsNeeded(growSecInc),
    };
}

function canUseFormulas(ns): boolean {
    return ns.fileExists("Formulas.exe", "home");
}

function growthAnalyze(ns: NS, hostname: string, afterHackMoney: number, growMultiplier: number): number {
    if (canUseFormulas(ns)) {
        let server = ns.getServer(hostname);
        let player = ns.getPlayer();
        server.moneyAvailable = afterHackMoney;
        return ns.formulas.hacking.growThreads(server, player, server.moneyMax);
    } else {
        // N.B. from testing this calculation tracks very closely with
        // the formulas value, _except_ as the afterHackMoney
        // approaches zero the error grows super-linearly
        return Math.ceil(ns.growthAnalyze(hostname, growMultiplier));
    }
}


function weakenThreadsNeeded(securityDecrease: number): number {
    // N.B. this function cannot be substited with the ns function
    // weaken analyze because they do opposite things!
    return Math.ceil(securityDecrease / 0.05)
}
