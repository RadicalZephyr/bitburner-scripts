import type { NS } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { TargetSource, WorkerSource } from 'services/client/discover';
import { MemoryClient } from 'services/client/memory';

import { makeFuid } from 'util/fuid';
import { walkNetworkBFS } from 'util/walk';

import { StreamSink, Transaction } from 'lib/sodium';

import { CONFIG } from 'services/config';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Daemon that discovers hosts and notifies subscribers.

OPTIONS
  --help   Show this help message

CONFIGURATION
  SERVICE_discoverWalkIntervalMs  Delay between network scans
  SERVICE_subscriptionMaxRetries  Failed notifications tolerated
`);
        return;
    }

    ns.disableLog('sleep');

    const cracked = new Set<string>();

    const discovery = new Discovery(ns);
    discovery.pushHosts(['home']);

    const memClient = new MemoryClient(ns);

    const self = ns.self();
    void memClient.registerAllocation(self.server, self.ramUsage, 1);

    while (true) {
        const network = walkNetworkBFS(ns);
        const newHosts: string[] = [];
        for (const host of network.keys()) {
            if (host === 'home') continue;

            if (cracked.has(host)) continue;

            if (ns.hasRootAccess(host)) {
                newHosts.push(host);
                cracked.add(host);
                continue;
            }

            const portsNeeded = ns.getServerNumPortsRequired(host);
            if (countPortCrackers(ns) < portsNeeded) continue;

            attemptCrack(ns, host);
            if (!ns.hasRootAccess(host)) continue;

            newHosts.push(host);
            cracked.add(host);
        }

        if (newHosts.length > 0) {
            discovery.pushHosts(newHosts);
        }

        await ns.asleep(CONFIG.discoverWalkIntervalMs);
    }
}

type CrackProgramFn = (host: string) => void;

type CrackProgram = {
    file: string;
    fn: CrackProgramFn;
};

function portOpeningProgramFns(ns: NS): CrackProgram[] {
    return [
        {
            file: 'BruteSSH.exe',
            fn: ns.brutessh.bind(ns) as (host: string) => boolean,
        },
        {
            file: 'FTPCrack.exe',
            fn: ns.ftpcrack.bind(ns) as (host: string) => boolean,
        },
        {
            file: 'relaySMTP.exe',
            fn: ns.relaysmtp.bind(ns) as (host: string) => boolean,
        },
        {
            file: 'HTTPWorm.exe',
            fn: ns.httpworm.bind(ns) as (host: string) => boolean,
        },
        {
            file: 'SQLInject.exe',
            fn: ns.sqlinject.bind(ns) as (host: string) => boolean,
        },
    ];
}

function countPortCrackers(ns: NS): number {
    return portOpeningProgramFns(ns).filter((p) =>
        ns.fileExists(p.file, 'home'),
    ).length;
}

function attemptCrack(ns: NS, host: string) {
    for (const prog of portOpeningProgramFns(ns)) {
        if (ns.fileExists(prog.file, 'home')) {
            prog.fn(host);
        }
    }
    ns.nuke(host);
}

type Hostname = string;

class Discovery {
    ns: NS;

    #newHosts: StreamSink<Hostname> = new StreamSink();

    constructor(ns: NS) {
        this.ns = ns;

        Transaction.execute(() => {
            WorkerSource.reset();
            const newWorkers = this.#newHosts.filter((host) => {
                const workers = WorkerSource.hosts.sample();
                return this.ns.getServerMaxRam(host) > 0 && !workers.has(host);
            });
            const unlistenWorkers =
                WorkerSource.registerNewHostsSource(newWorkers);

            TargetSource.reset();
            const newTargets = this.#newHosts.filter((host) => {
                const targets = TargetSource.hosts.sample();
                return (
                    this.ns.getServerMaxMoney(host) > 0 && !targets.has(host)
                );
            });
            const unlistenTargets =
                TargetSource.registerNewHostsSource(newTargets);

            ns.atExit(() => {
                unlistenTargets();
                unlistenWorkers();
            }, makeFuid(ns));
        });
    }

    pushHosts(hosts: Hostname[]) {
        for (const host of hosts) {
            this.#newHosts.send(host);
        }
    }
}
