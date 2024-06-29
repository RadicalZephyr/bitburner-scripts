import type { NS, NetscriptPort } from "netscript";

import { MONITOR_PORT } from "util/ports";

export async function main(ns: NS) {
    let monitorPort = ns.getPortHandle(MONITOR_PORT);

    let hosts: Hosts = {
        till: new Set(),
        sow: new Set(),
        harvest: new Set(),
    };

    ns.disableLog('ALL');
    ns.clearLog();
    ns.tail();

    while (true) {
        update(monitorPort, hosts);
        ns.clearLog();
        ns.printf("Tilling: %s\n", JSON.stringify([...hosts.till]));
        ns.printf("Sowing: %s\n", JSON.stringify([...hosts.sow]));
        ns.printf("Harvesting: %s\n", JSON.stringify([...hosts.harvest]));
        await ns.sleep(100);
    }
}

type Hosts = {
    till: Set<string>,
    sow: Set<string>,
    harvest: Set<string>,
};

export type MonitorList = "till" | "sow" | "harvest";
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
