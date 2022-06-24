import type { NS } from "netscript";
import type { BatchSpec, HostSpec, TargetSpec } from "./types";

export async function main(ns: NS) {

}

/** Utilize all available threads across all hosts to minimize the
 * number of iterations needed to achieve the desired amount of change.
 *
 *
 */
export function packThreads(_hosts: HostSpec[], _targets: TargetSpec[]): BatchSpec[] {
    return [];
}
