import type { NS } from "netscript";

export async function main(ns: NS) {
    ns.tprint(ns.args.join(' '));
}
