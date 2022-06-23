import type { NS } from "netscript";
import type { BatchSpec } from "../types";

export async function main(ns: NS) {
    const specJSON = ns.args[0];
    if (typeof specJSON != 'string') {
        ns.printf('invalid batch spec %s', specJSON);
        return;
    }
    const batchSpecs: BatchSpec[] = JSON.parse(specJSON);
    for (const spec of batchSpecs) {
        ns.run(spec.script, spec.threads, spec.target, spec.delay);
    }
}
