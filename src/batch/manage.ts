import type { NS } from "netscript";

import { HostMsg, WorkerType, TargetType, HOSTS_PORT, HOSTS_DONE, EMPTY_SENTINEL } from "util/ports";

declare const React: any;

export async function main(ns: NS) {
    ns.disableLog('sleep');

    let hostsPort = ns.getPortHandle(HOSTS_PORT);

    let workers = [];

    let targets = [];

    while (true) {
        let nextMsg = hostsPort.read();
        // Check for empty value
        if (typeof nextMsg === "string" && nextMsg === EMPTY_SENTINEL) {
            await hostsPort.nextWrite();
            continue;
        }

        // Check for the done sentinel value
        if (nextMsg === HOSTS_DONE) {
            break;
        }

        if (typeof nextMsg === "object") {
            let nextHostMsg = nextMsg as HostMsg;
            ns.printf("new %s: %s", nextHostMsg.type, nextHostMsg.host);
            switch (nextHostMsg.type) {
                case WorkerType:
                    workers.push(nextHostMsg.host);
                    break;
                case TargetType:
                    targets.push(nextHostMsg.host);
                    break;
            }
        }

        await ns.sleep(100);
    }
}
