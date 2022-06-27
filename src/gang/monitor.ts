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
        const maxNameLength = Math.max(...memberNames.map(n => n.length));
        const members = memberNames.map(name => ns.gang.getMemberInformation(name));
        const maxTaskLength = Math.max(...members.map(m => m.task.length));

        const nameTaskFormatPrefix = ` %-${maxNameLength}s | %${maxTaskLength}s `;
        const baseFormatString = isHacking ?
            nameTaskFormatPrefix + '%6s %7s %9s %9s' :
            '\n' + nameTaskFormatPrefix +
            '\n' + nameTaskFormatPrefix + '%6s %7s %9s %9s' +
            '\n' + nameTaskFormatPrefix + '%6s %7s %9s %9s' +
            '\n' + nameTaskFormatPrefix + '%6s %7s %9s %9s'
            ;
        const dividerFormatString = baseFormatString.replaceAll(' ', '-').replaceAll('%', "%'-");

        const gangType = isHacking ? 'Hacking' : 'Combat';
        ns.print(`Member ${gangType} Info\n`);

        const headings = isHacking ?
            ['hack', 'hack_xp', 'hack_mul', 'hack_asc'] :
            [
                '', '', 'str', 'def', 'dex', 'agi',
                '', '', 'str_xp', 'def_xp', 'dex_xp', 'agi_xp',
                '', '', 'str_mul', 'def_mul', 'dex_mul', 'agi_mul',
                '', '', 'str_asc', 'def_asc', 'dex_asc', 'agi_asc'
            ];
        const blanks = Array(headings.length).fill('');

        ns.printf(baseFormatString, 'member', 'task', ...headings);
        ns.printf(dividerFormatString, ...blanks);
        for (const member of members) {
            const ascResult = ns.gang.getAscensionResult(member.name);
            const stats = isHacking ?
                [
                    member.hack.toFixed(0),
                    member.hack_exp.toFixed(0),
                    member.hack_asc_mult.toFixed(2),
                    ascResult ? ascResult.hack.toFixed(6) : ''
                ] :
                [
                    '', '',
                    member.str.toFixed(0),
                    member.str_exp.toFixed(0),
                    member.str_asc_mult.toFixed(2),
                    ascResult ? ascResult.str.toFixed(6) : '',

                    '', '',
                    member.def.toFixed(0),
                    member.def_exp.toFixed(0),
                    member.def_asc_mult.toFixed(2),
                    ascResult ? ascResult.def.toFixed(6) : '',

                    '', '',
                    member.dex.toFixed(0),
                    member.dex_exp.toFixed(0),
                    member.dex_asc_mult.toFixed(2),
                    ascResult ? ascResult.dex.toFixed(6) : '',

                    '', '',
                    member.agi.toFixed(0),
                    member.agi_exp.toFixed(0),
                    member.agi_asc_mult.toFixed(2),
                    ascResult ? ascResult.agi.toFixed(6) : ''
                ];
            ns.printf(
                baseFormatString,
                member.name,
                member.task,
                ...stats
            );
        }
        ns.print('');
        await ns.sleep(flags.refreshrate);
    }
}
