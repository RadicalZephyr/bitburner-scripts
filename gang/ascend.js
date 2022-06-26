export async function main(ns) {
    const members = ns.gang.getMemberNames();
    for (const member of members) {
        const ar = ns.gang.getAscensionResult(member);
        if (ar) {
            ns.gang.ascendMember(member);
        }
    }
}
