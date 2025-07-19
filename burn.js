import { MEM_TAG_FLAGS } from "services/client/memory_tag";
import { walkNetworkBFS } from 'util/walk';
export async function main(ns) {
    const flags = ns.flags(MEM_TAG_FLAGS);
    ns.disableLog("ALL");
    let network = walkNetworkBFS(ns);
    let allHosts = new Set(network.keys());
    for (const host of allHosts) {
        let files = ns.ls(host, ".js");
        for (const file of files) {
            if (!ns.rm(file, host)) {
                ns.print(`failed to delete ${file} on ${host}`);
            }
        }
    }
}
