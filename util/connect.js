import { shortestPath } from 'util/shortest-path';
import { sendTerminalCommand } from 'util/terminal';
/**
 * Traverse the network to connect to a specific host by the shortest
 * path.
 *
 * @remarks
 * Uses direct terminal interaction instead of Singularity APIs.
 *
 * @param ns          - Netscript API Instance
 * @param destination - Host to connect to
 */
export async function connectTo(ns, destination) {
    const path = await shortestPath(ns, ns.self().server, destination);
    const connectCommand = `connect ${path.join(' ; connect ')}`;
    await sendTerminalCommand(ns, connectCommand);
}
