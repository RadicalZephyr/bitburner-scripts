import type { NS } from "netscript";

export async function main(ns: NS) {
    const flags = ns.flags([
        ['refreshrate', 200],
        ['help', false],
    ]);

    if (flags.help) {
        ns.tprint("This script helps visualize what's going on with your gang.");
        ns.tprint(`USAGE: run ${ns.getScriptName()}`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()}`);
        return;
    }
    ns.tail();
    ns.disableLog('ALL');

    const memberNames = ns.gang.getMemberNames();

    while (true) {
        const members = memberNames.map(name => ns.gang.getMemberInformation(name));

        ns.clearLog();
        ns.print('Member Hacking Info');
        ns.printf("  %-9s | %9s %9s %9s %9s %9s %9s %9s", 'member', 'task', 'lvl', 'exp', 'aexp', 'mult', 'amult', 'abonus');
        ns.printf("--%'--9s-|-%'-9s-%'-9s-%'-9s-%'-9s-%'-9s-%'-9s-%'-9s", '', '', '', '', '', '', '', '');
        for (const member of members) {
            const ascResult = ns.gang.getAscensionResult(member.name);
            ns.printf(
                '  %-9s | %9s %9s %9s %9s %9s %9s %9s',
                member.name,
                member.task,
                member.hack.toFixed(0),
                member.hack_exp.toFixed(0),
                member.hack_asc_points.toFixed(0),
                member.hack_mult.toFixed(2),
                member.hack_asc_mult.toFixed(2),
                ascResult ? ascResult.hack.toFixed(6) : ''
            );
        }
        ns.print('\n');
        await ns.sleep(flags.refreshrate);
    }
}
