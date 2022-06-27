import type { NS } from "netscript";

export async function main(ns: NS) {
    const files = ns.ls('home');
    const scriptFile = /\.(js|script)/;
    for (const file of files) {
        if (scriptFile.test(file)) {
            ns.rm(file);
        }
    }
}
