import type { AutocompleteData, NS } from "netscript";
import { MEM_TAG_FLAGS } from "services/client/memory_tag";
import { CONFIG } from "batch/config";

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
    const flags = ns.flags(MEM_TAG_FLAGS);
    let target = ns.args[0];
    if (typeof target !== 'string' || !ns.serverExists(target)) {
        ns.tprintf("target %s does not exist", target);
        return;
    }

    let eValue = expectedValuePerRamSecond(ns, target, CONFIG.maxHackPercent);
    ns.tprint(`${target} ${eValue}`);
}

/**
 * Calculate the expected profit per GB-second for a standard hacking batch.
 *
 * @param ns          - Netscript API instance
 * @param host        - Hostname of the target server
 * @param hackPercent - Fraction of money to hack each batch (0-1)
 * @returns Expected value per GB-second
 */
export function expectedValuePerRamSecond(
    ns: NS,
    host: string,
    hackPercent: number = CONFIG.maxHackPercent,
): number {
    const hackThreads = hackThreadsForPercent(ns, host, hackPercent);
    const threads = analyzeBatchThreads(ns, host, hackThreads);

    const hRam = ns.getScriptRam("/batch/h.js", "home") * threads.hackThreads;
    const gRam = ns.getScriptRam("/batch/g.js", "home") * threads.growThreads;
    const wRam = ns.getScriptRam("/batch/w.js", "home") *
        (threads.postHackWeakenThreads + threads.postGrowWeakenThreads);
    const batchRam = hRam + gRam + wRam;

    const batchTime = fullBatchTime(ns, host);
    const endingPeriod = CONFIG.batchInterval * 4;
    const overlap = Math.ceil(batchTime / endingPeriod);
    const requiredRam = batchRam * overlap;

    const hackValue = successfulHackValue(ns, host, hackThreads);
    const expectedHackValue = hackValue * ns.hackAnalyzeChance(host);

    const earningsPerSecond = (expectedHackValue / endingPeriod) * 1000;

    return earningsPerSecond / requiredRam;
}

/** Calculate the total runtime for a full hack-weaken-grow-weaken batch.
 *
 * @param ns   - Netscript API instance
 * @param host - Hostname of the target server
 * @returns Time in milliseconds for one batch to finish, adjusted for
 * the player's hacking speed multiplier
 */
export function fullBatchTime(ns: NS, host: string): number {
    return ns.getWeakenTime(host) + 2 * CONFIG.batchInterval;
}

function successfulHackValue(
    ns: NS,
    host: string,
    threads: number,
): number {
    const maxMoney = ns.getServerMaxMoney(host);

    if (canUseFormulas(ns)) {
        const server = ns.getServer(host);
        const player = ns.getPlayer();
        const percent = ns.formulas.hacking.hackPercent(server, player);
        return threads * server.moneyMax * percent;
    }

    return threads * maxMoney * ns.hackAnalyze(host);
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

    const hackSecInc = ns.hackAnalyzeSecurity(hackThreads);
    const growSecInc = ns.growthAnalyzeSecurity(growThreads);

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
    if (canUseFormulas(ns)) {
        let server = ns.getServer(hostname);
        let player = ns.getPlayer();
        server.moneyAvailable = afterHackMoney;
        return Math.ceil(
            ns.formulas.hacking.growThreads(server, player, server.moneyMax)
        );
    } else {
        // N.B. from testing this calculation tracks very closely with
        // the formulas value, _except_ as the afterHackMoney
        // approaches zero the error grows super-linearly
        const maxMoney = ns.getServerMaxMoney(hostname);
        const growMultiplier = maxMoney / Math.max(1, afterHackMoney);
        return Math.ceil(ns.growthAnalyze(hostname, growMultiplier));
    }
}

/** Calculate the number of hack threads needed to steal the given
 *  percentage of the target server's max money.
 *
 * @param ns      - Netscript API instance
 * @param host    - Hostname of the target server
 * @param percent - Desired money percentage to hack (0-1)
 * @returns Required hack thread count, adjusted for player hacking multipliers
 */
export function hackThreadsForPercent(
    ns: NS,
    host: string,
    percent: number,
): number {
    if (percent <= 0) return 0;

    let hackPercent: number;
    if (canUseFormulas(ns)) {
        const server = ns.getServer(host);
        const player = ns.getPlayer();
        hackPercent = ns.formulas.hacking.hackPercent(server, player);
    } else {
        hackPercent = ns.hackAnalyze(host);
    }

    if (hackPercent <= 0) return 0;

    return Math.ceil(percent / hackPercent);
}


function weakenThreadsNeeded(securityDecrease: number): number {
    // N.B. this function cannot be substited with the ns function
    // weaken analyze because they do opposite things!
    return Math.max(1, Math.ceil(securityDecrease * 20));
}

function canUseFormulas(ns: NS): boolean {
    return ns.fileExists("Formulas.exe", "home");
}
