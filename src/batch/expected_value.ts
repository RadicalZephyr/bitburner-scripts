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

    let eValue = expectedValuePerRamSecond(ns, target);
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
): number {
    const {
        hackThreads,
        growThreads,
        postHackWeakenThreads,
        postGrowWeakenThreads,
    } = analyzeBatchThreads(ns, host);

    const weakenThreads = postHackWeakenThreads + postGrowWeakenThreads;

    const ramUse =
        hackThreads * ns.getScriptRam("/batch/h.js", "home") +
        growThreads * ns.getScriptRam("/batch/g.js", "home") +
        weakenThreads * ns.getScriptRam("/batch/w.js", "home");

    const batchTime = fullBatchTime(ns, host);

    const hackValue = successfulHackValue(ns, host, hackThreads);
    const expectedHackValue = hackValue * ns.hackAnalyzeChance(host);

    // Scale by 1000 to get human readable values and convert units
    // from $/GB*ms to $/GB*s
    return 1000 * expectedHackValue / (batchTime * ramUse);
}

/** Calculate the total runtime for a full hack-weaken-grow-weaken batch.
 *
 * @param ns   - Netscript API instance
 * @param host - Hostname of the target server
 * @returns Time in milliseconds for one batch to finish, adjusted for
 * the player's hacking speed multiplier
 */
export function fullBatchTime(ns: NS, host: string): number {
    const speedMult = ns.getHackingMultipliers().speed;
    return ns.getWeakenTime(host) / speedMult + 2 * CONFIG.batchInterval;
}

function successfulHackValue(
    ns: NS,
    host: string,
    threads: number,
): number {
    const maxMoney = ns.getServerMaxMoney(host);
    const mults = ns.getHackingMultipliers();

    if (canUseFormulas(ns)) {
        const server = ns.getServer(host);
        const player = ns.getPlayer();
        const percent = ns.formulas.hacking.hackPercent(server, player);
        return threads * server.moneyMax * percent * mults.money;
    }

    return threads * maxMoney * ns.hackAnalyze(host) * mults.money;
}

/**
 * Calculate the minimal thread distribution for a HWGW batch.
 *
 * @param ns - Netscript API instance
 * @param host - Hostname of the target server
 * @param hackThreads - Number of hack threads to execute
 * @returns Calculated thread allocation
 */
export function analyzeBatchThreads(
    ns: NS,
    host: string,
    hackThreads: number = 1,
): BatchThreadAnalysis {
    const stolen = successfulHackValue(ns, host, hackThreads);
    const maxMoney = ns.getServerMaxMoney(host);
    const afterHackMoney = Math.max(1, maxMoney - stolen);

    const growThreads = growthAnalyze(ns, host, afterHackMoney);

    const hackSecInc = ns.hackAnalyzeSecurity(hackThreads, host);
    const growSecInc = ns.growthAnalyzeSecurity(growThreads, host);

    return {
        hackThreads,
        postHackWeakenThreads: weakenThreadsNeeded(hackSecInc),
        growThreads,
        postGrowWeakenThreads: weakenThreadsNeeded(growSecInc),
    };
}

/** Calculate the number of grow threads needed for a given multiplicative growth factor.
 *
 * @remarks
 * This function returns the total decimal number of grow threads
 * needed in order to multiply the money available on the specified
 * server by a given multiplier, if all threads are executed at the
 * server's current security level, regardless of how many threads are
 * assigned to each call. The result is normalized for the player's
 * grow thread multiplier.
 *
 * @param ns - Netscript API instance
 * @param hostname - Hostname of the target server
 * @param afterHackMoney - Remaining money after the hack completes
 */
export function growthAnalyze(ns: NS, hostname: string, afterHackMoney: number): number {
    const mults = ns.getHackingMultipliers();
    if (canUseFormulas(ns)) {
        let server = ns.getServer(hostname);
        let player = ns.getPlayer();
        server.moneyAvailable = afterHackMoney;
        return Math.ceil(
            ns.formulas.hacking.growThreads(server, player, server.moneyMax) /
            mults.growth,
        );
    } else {
        // N.B. from testing this calculation tracks very closely with
        // the formulas value, _except_ as the afterHackMoney
        // approaches zero the error grows super-linearly
        const maxMoney = ns.getServerMaxMoney(hostname);
        const growMultiplier = maxMoney / Math.max(1, afterHackMoney);
        return Math.ceil(ns.growthAnalyze(hostname, growMultiplier) / mults.growth);
    }
}


function weakenThreadsNeeded(securityDecrease: number): number {
    // N.B. this function cannot be substited with the ns function
    // weaken analyze because they do opposite things!
    return Math.max(1, Math.ceil(securityDecrease * 20));
}

function canUseFormulas(ns: NS): boolean {
    return ns.fileExists("Formulas.exe", "home");
}
