import {getRootAccess} from "./lib.js";

/** @param {NS} ns */
export async function main(ns) {
  let host = ns.args[0];
  ns.tprint("trying to crack ", host);
  if (getRootAccess(ns, host)) {
    ns.tprint("successfully cracked ", host);
  } else {
    ns.tprint("could not crack ", host);
  }
}
