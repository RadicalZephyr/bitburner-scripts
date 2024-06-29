import type { NS, NetscriptPort } from "netscript";

import { MONITOR_PORT } from "util/ports";

export async function main(ns: NS) {
    let monitorPort = ns.getPortHandle(MONITOR_PORT);

    let hosts: Hosts = {
        soften: new Set(),
        build: new Set(),
        steal: new Set(),
    };

    ns.disableLog('ALL');
    ns.clearLog();
    ns.tail();

    while (true) {
        update(monitorPort, hosts);
        ns.clearLog();
        ns.printf("Softening: %s\n", JSON.stringify([...hosts.soften]));
        ns.printf("Building: %s\n", JSON.stringify([...hosts.build]));
        ns.printf("Stealing: %s\n", JSON.stringify([...hosts.steal]));
        await ns.sleep(100);
    }
}

type Hosts = {
    soften: Set<string>,
    build: Set<string>,
    steal: Set<string>,
};

export type MonitorList = "soften" | "build" | "steal";
export type MonitorAction = "add" | "remove";

export type MonitorMessage = {
    list: MonitorList,
    host: string,
    action: MonitorAction,
};

function update(monitorPort: NetscriptPort, hosts: Hosts) {
    let nextMsg = monitorPort.read() as any;
    while (nextMsg !== "NULL PORT DATA") {
        let msg = nextMsg as MonitorMessage;

        let hostsList = hosts[msg.list];
        if (msg.action === "add") {
            hostsList.add(msg.host);
        } else if (msg.action === "remove") {
            hostsList.delete(msg.host);
        }

        nextMsg = monitorPort.read() as any;
    }

}
