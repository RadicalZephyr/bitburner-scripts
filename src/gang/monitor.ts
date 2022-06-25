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

    while (true) {
        const memberNames = ns.gang.getMemberNames();
        const maxNameLength = Math.max(...memberNames.map(n => n.length));
        const members = memberNames.map(name => ns.gang.getMemberInformation(name));
        const maxTaskLength = Math.max(...members.map(m => m.task.length));

        ns.clearLog();
        ns.print('Member Hacking Info\n');

        ns.printf(` %-${maxNameLength}s | %${maxTaskLength}s %6s %7s %9s %9s`, 'member', 'task', 'hack', 'hack_exp', 'hack_mul', 'hack_asc');
        ns.printf(`-%'--${maxNameLength}s-|-%'-${maxTaskLength}s-%'-6s-%'-7s-%'-9s-%'-9s`, '', '', '', '', '', '');
        for (const member of members) {
            const ascResult = ns.gang.getAscensionResult(member.name);
            ns.printf(
                ` %-${maxNameLength}s | %${maxTaskLength}s %6s %7s %9s %9s`,
                member.name,
                member.task,
                member.hack.toFixed(0),
                member.hack_exp.toFixed(0),
                member.hack_asc_mult.toFixed(2),
                ascResult ? ascResult.hack.toFixed(6) : ''
            );
        }
        ns.print('');
        await ns.sleep(flags.refreshrate);
    }
}
