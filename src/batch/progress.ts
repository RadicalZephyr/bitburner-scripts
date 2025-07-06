import type { NS } from "netscript";

import { CONFIG } from "batch/config";

/**
 * Wait for all provided processes to finish while displaying progress.
 *
 * A heartbeat callback is invoked whenever {@link CONFIG.heartbeatCadence}
 * milliseconds have elapsed. The callback result controls whether the
 * heartbeat timestamp is updated.
 *
 * @param ns                - Netscript API instance
 * @param pids              - List of running process ids
 * @param round             - Current round number
 * @param totalRounds       - Total number of expected rounds
 * @param roundEnd          - Timestamp when this round is expected to end
 * @param totalExpectedEnd  - Expected finish time of all remaining rounds
 * @param lastHeartbeat     - Timestamp of the previous heartbeat
 * @param sendHeartbeat     - Callback to send a heartbeat message
 * @returns Updated timestamp of the last heartbeat
 */
export async function awaitRound(
    ns: NS,
    pids: number[],
    round: number,
    totalRounds: number,
    roundEnd: number,
    totalExpectedEnd: number,
    lastHeartbeat: number,
    sendHeartbeat: () => Promise<boolean | void>,
): Promise<number> {
    for (const pid of pids) {
        while (ns.isRunning(pid)) {
            ns.clearLog();
            const elapsed = ns.self().onlineRunningTime * 1000;
            ns.print(`
Round ${round} of ${totalRounds}
Round ends:      ${ns.tFormat(roundEnd)}
Total expected:  ${ns.tFormat(totalExpectedEnd)}
Elapsed time:    ${ns.tFormat(elapsed)}
`);
            if (Date.now() >= lastHeartbeat + CONFIG.heartbeatCadence + (Math.random() * 500)) {
                const result = await sendHeartbeat();
                if (result !== false) {
                    lastHeartbeat = Date.now();
                }
            }
            await ns.sleep(1000);
        }
    }

    return lastHeartbeat;
}
