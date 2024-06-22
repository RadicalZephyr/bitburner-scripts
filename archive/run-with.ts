import type { NS, AutocompleteData } from "netscript";

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const options = ns.flags([
        ['help', false],
        ['refreshrate', 150]
    ]);

    if (options.help || options._.length < 1) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} SCRIPT_NAME SERVER_NAME...

This script prints the path between two servers in the network.

Example:
  > run ${ns.getScriptName()} n00dles

OPTIONS
  --help    Show this help message
  --delay   How long to sleep between running the script
`);
        return;
    }

    const script = options._.shift();
    if (!(ns.fileExists(script) && ns.getScriptRam(script) !== 0)) {
        ns.tprint(`ERROR: ${script} is not a valid script.`);
    }

    for (const target of options._) {
        ns.run(script, 1, target);
    }
}
