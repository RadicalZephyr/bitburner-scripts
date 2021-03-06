import type { NS } from "netscript";

export async function main(ns: NS) {
    const members = ns.gang.getMemberNames();

    for (const member of members) {
        const ar = ns.gang.getAscensionResult(member);

        if (ar) {
            ns.gang.ascendMember(member);
        }
    }
}
