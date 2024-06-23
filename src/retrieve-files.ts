import type { NS } from "netscript";

import { walkNetworkBFS } from "./util/walk";

export async function main(ns: NS) {
    let network = walkNetworkBFS(ns);
    let allHosts = Array.from(network.keys());

    let contractFileLocations = "contract-locations.js";
    ns.write(contractFileLocations, "", "w");

    let scriptFile = /\.(js|script)/;
    let textFile = /\.txt/;
    let litFile = /\.lit/;

    let contracts = [];

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
                contracts.push({ file: file, host: host });
            }
        }
        if (qualifiedNames.length > 0) {
            ns.scp(qualifiedNames, "home", host);
        }
    }
    ns.tprintf('%s', JSON.stringify(contracts));
    ns.write(contractFileLocations, CONTRACTS_PREFIX + JSON.stringify(contracts) + ';', "w");
}

const CONTRACTS_PREFIX = 'export let CONTRACTS = ';
