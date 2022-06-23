import type { NS } from "netscript";

export async function main(ns: NS) {
    const specJSON = ns.args[0];
    if (typeof specJSON != 'string') {
        ns.printf('invalid batch spec %s', specJSON);
        return;
    }
    const batchSpec = JSON.parse(specJSON);

}
