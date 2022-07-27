import type { NS } from "netscript";

import { walkNetworkBFS } from "./lib";

export async function main(ns: NS) {
    let network = walkNetworkBFS(ns);
    let allHosts = Array.from(network.keys());

    let contractFileLocations = "contract-locations.txt";
    await ns.write(contractFileLocations, "", "w");

    let scriptFile = /\.(js|script)/;
    let textFile = /\.txt/;
    let litFile = /\.lit/;
    for (const host of allHosts) {
        if (host == "home") { continue; }

        let files = ns.ls(host).filter(file => !scriptFile.test(file));
        let qualifiedNames = [];
        for (const file of files) {
            if (textFile.test(file)) {
                let qualifiedName = "/" + host + "/" + file;
                ns.mv(host, file, qualifiedName);
                qualifiedNames.push(qualifiedName);
            } else if (litFile.test(file)) {
                qualifiedNames.push(file);
            } else {
                await ns.write(contractFileLocations, `${file} on ${host}\n`, "a");
            }
        }
        if (qualifiedNames.length > 0) {
            await ns.scp(qualifiedNames, host, "home");
        }
    }
}
