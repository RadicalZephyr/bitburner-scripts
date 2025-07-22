import type { AutocompleteData, NS, ScriptArg } from 'netscript';

import { LaunchRunOptions } from 'services/client/launch';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

export function autocomplete(data: AutocompleteData): string[] {
    return data.scripts;
}

export async function main(ns: NS) {
    const args = ns.args;

    let launchedScriptArgs: ScriptArg[] = [];

    const dividerIndex = args.findIndex((arg) => arg === '++');
    if (dividerIndex !== -1) {
        const launchArgStart = dividerIndex + 1;
        launchedScriptArgs = args.splice(
            launchArgStart,
            args.length - launchArgStart,
        );
        // Remove divider from args
        args.pop();
    }

    // TODO: we need to somehow try to reverse engineer the flags that
    // are being passed to the launched script.
    const launchedScriptFlags = launchedScriptArgs.filter(isFlag).map(toFlag);

    const flags = ns.flags([
        ['threads', 1],
        ['itail', null],
        ['ram_override', null],
        ['contiguous', false],
        ['core-dependent', false],
        ['long-running', false],
        ['help', false],
        ...MEM_TAG_FLAGS,
    ]);

    const rest = flags._ as ScriptArg[];

    if (rest.length !== 1 || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} SCRIPT_NAME [--threads num_threads] [--ram_override ram_in_GBs] [--allocation-flag FLAG] [--core-dependent] [--long-running] [++ args...]

Run the script at SCRIPT_NAME, getting an allocation for it from the memory
manager and spawning the script on the returned host. Otherwise, this script
functions exactly like the 'run' command.

Arguments can be passed to the _script being launched_ by separating them from
the arguments to the _launcher_ with a "++" argument.

Examples:

> run ${ns.getScriptName()} script-to-launch.js

> run ${ns.getScriptName()} --threads 4 script-with-4-threads.js

> run ${ns.getScriptName()} script-with-args.js ++ --arg for-script

OPTIONS
  --help             Show this help message
  --threads          Number of threads to run
  --ram_override     Override static RAM calculation
  --core-dependent   Prefer allocations from home when available
  --long-running     Prefer non-home servers when allocating
`);
        return;
    }

    const script = rest.shift();
    if (typeof script !== 'string' || !ns.fileExists(script)) {
        ns.tprint('script must be an existing script');
        return;
    }

    const threads = flags.threads;
    if (typeof threads !== 'number') {
        ns.tprint('--threads must be a number');
        return;
    }

    const ram_override = flags.ram_override;
    if (ram_override !== null && typeof ram_override !== 'number') {
        ns.tprint('--ram_override must be a number');
        return;
    }

    const contiguous = flags['contiguous'];
    if (typeof contiguous !== 'boolean') {
        ns.tprint('--contiguous must be a boolean');
        return;
    }

    const coreDependent = flags['core-dependent'];
    if (typeof coreDependent !== 'boolean') {
        ns.tprint('--core-dependent must be a boolean');
        return;
    }

    const longRunning = flags['long-running'];
    if (typeof longRunning !== 'boolean') {
        ns.tprint('--long-running must be a boolean');
        return;
    }
    const launchOptions: LaunchRunOptions = {
        threads,
        contiguous,
        coreDependent,
        longRunning,
    };

    ns.tprint(`launcher options: ${JSON.stringify(launchOptions, null, 2)}`);
    ns.tprint(`launched script args: ${JSON.stringify(launchedScriptArgs)}`);
}

function isFlag(arg: ScriptArg): boolean {
    return typeof arg === 'string' && arg.startsWith('--');
}

function toFlag(arg: string): string {
    return arg.slice(2);
}
