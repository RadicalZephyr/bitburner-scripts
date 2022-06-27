import type { NS } from "netscript";

export async function main(ns: NS) {
    const flags = ns.flags([
        ['refreshrate', 200],
        ['help', false],
    ]);

    const isHacking = ns.gang.getGangInformation().isHacking;

    if (flags.help) {
        ns.tprint("This script helps visualize what's going on with your gang.");
        ns.tprint(`USAGE: run ${ns.getScriptName()}`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()}`);
        return;
    }
    ns.tail();
    ns.disableLog('ALL');

    while (true) {
        ns.clearLog();

        const memberNames = ns.gang.getMemberNames();
        const members = memberNames.map(name => ns.gang.getMemberInformation(name));

        const nameTaskFormat = ' %s\n task: %s';
        const baseFormatString = ' %4s | %5s %5s %9s %7s %10s';
        const dividerFormatString = baseFormatString.replaceAll(' ', '-').replaceAll('%', "%'-");

        const gangType = isHacking ? 'Hacking' : 'Combat';
        ns.print(`Member ${gangType} Info\n`);

        const headings = ['stat', 'lvl', 'mul', 'asc_bonus', 'xp', 'asc_points'];
        const blanks = Array(headings.length).fill('');

        ns.printf(baseFormatString, 'member', 'task', ...headings);
        for (const member of members) {
            ns.printf(nameTaskFormat, member.name, member.task);
            ns.printf(baseFormatString, ...headings);
            ns.printf(dividerFormatString, ...blanks);

            const ascResult = ns.gang.getAscensionResult(member.name);

            const stats = isHacking ? ['hack', 'cha'] : ['str', 'def', 'dex', 'agi'];
            for (const stat of stats) {
                const memberAny: any = member;
                const ascResultAny: any = ascResult;
                const memberStatDetails = [
                    stat,
                    memberAny[stat].toFixed(0),
                    memberAny[stat + '_asc_mult'].toFixed(2),
                    ascResult ? ascResultAny[stat].toFixed(6) : '',
                    memberAny[stat + '_exp'].toFixed(0),
                    memberAny[stat + '_asc_points'].toFixed(0)
                ];

                ns.printf(
                    baseFormatString,
                    ...memberStatDetails
                );
            }
            ns.print('');
        }
        await ns.sleep(flags.refreshrate);
    }
}
