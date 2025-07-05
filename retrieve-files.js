import { walkNetworkBFS } from "util/walk";
export async function main(ns) {
    let network = walkNetworkBFS(ns);
    let allHosts = Array.from(network.keys());
    let scriptFile = /\.(js|script)/;
    let textFile = /\.txt/;
    let litFile = /\.lit/;
    for (const host of allHosts) {
        if (host == "home") {
            continue;
        }
        let files = ns.ls(host).filter(file => !scriptFile.test(file));
        let qualifiedNames = [];
        for (const file of files) {
            if (textFile.test(file)) {
                let qualifiedName = "/" + host + "/" + file;
                ns.mv(host, file, qualifiedName);
                qualifiedNames.push(qualifiedName);
            }
            else if (litFile.test(file)) {
                qualifiedNames.push(file);
            }
            else {
                // Must be a contract, this script doesn't handle
                // those files anymore.
            }
        }
        if (qualifiedNames.length > 0) {
            ns.scp(qualifiedNames, "home", host);
        }
    }
}
