import type { NS } from 'netscript';

export async function main(ns: NS) {
    const args = ns.args;

    const dividerIndex = args.findIndex((arg) => arg === '++');
    const launchedScriptArgs = args.splice(
        dividerIndex + 1,
        args.length - dividerIndex,
    );
    // Remove divider
    args.pop();

    ns.tprint(`this script args: ${JSON.stringify(args)}`);
    ns.tprint(`launched script args: ${JSON.stringify(launchedScriptArgs)}`);
}
