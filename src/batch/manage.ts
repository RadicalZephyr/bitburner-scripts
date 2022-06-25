import type { NS } from "netscript";

export async function main(ns: NS) {
    const hostsJSON = ns.args[0];
    if (typeof hostsJSON != 'string') {
        ns.printf('invalid hosts list');
        return;
    }
    const hosts: string[] = JSON.parse(hostsJSON);
    ns.tail();
    ns.printf('hosts: %s', JSON.stringify(hosts));
}
