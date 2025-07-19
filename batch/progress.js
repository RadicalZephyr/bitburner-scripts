import { CONFIG } from "batch/config";
/**
 * Compute batch round timing information.
 *
 * @param ns              - Netscript API instance
 * @param target          - Host being attacked
 * @param round           - Current round number
 * @param totalRounds     - Total number of expected rounds
 * @param roundsRemaining - Remaining rounds including the current one
 * @returns Calculated round data
 */
export function calculateRoundInfo(ns, target, round, totalRounds, roundsRemaining) {
    const roundTime = ns.getWeakenTime(target);
    const roundStart = ns.self().onlineRunningTime * 1000;
    const roundEnd = roundStart + roundTime;
    const totalExpectedEnd = roundStart + roundsRemaining * roundTime;
    return { round, totalRounds, roundEnd, totalExpectedEnd };
}
/**
 * Wait for all provided processes to finish while displaying progress.
 *
 * A heartbeat callback is invoked whenever {@link CONFIG.heartbeatCadence}
 * milliseconds have elapsed. The callback result controls whether the
 * heartbeat timestamp is updated.
 *
 * @param ns            - Netscript API instance
 * @param pids          - List of running process ids
 * @param info          - Round progress details
 * @param nextHeartbeat - Timestamp when the next heartbeat should be sent
 * @param sendHeartbeat - Callback to send a heartbeat message
 * @returns The timestamp for the subsequent heartbeat
 */
export async function awaitRound(ns, pids, info, nextHeartbeat, sendHeartbeat) {
    for (const pid of pids) {
        while (ns.isRunning(pid)) {
            printRoundProgress(ns, info);
            if (Date.now() >= nextHeartbeat) {
                const result = await sendHeartbeat();
                if (result !== false) {
                    nextHeartbeat = Date.now() + CONFIG.heartbeatCadence + Math.random() * 500;
                }
            }
            await ns.sleep(1000);
        }
    }
    return nextHeartbeat;
}
/**
 * Print out the current round progress message.
 *
 * @param ns   - Netscript API instance
 * @param info - Round info
 */
export function printRoundProgress(ns, info) {
    const elapsed = ns.self().onlineRunningTime * 1000;
    ns.clearLog();
    ns.print(`
Round ${info.round} of ${info.totalRounds}
Elapsed time:    ${ns.tFormat(elapsed)}
Round ends:      ${ns.tFormat(info.roundEnd)}
Total expected:  ${ns.tFormat(info.totalExpectedEnd)}
`);
}
