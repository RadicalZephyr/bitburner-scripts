import {canHack} from "./lib.js";

/** @param {NS} ns */
export async function main(ns) {
  let host = ns.args[0];
  ns.tprint("can hack ", host, ": ", canHack(ns, host));
}
