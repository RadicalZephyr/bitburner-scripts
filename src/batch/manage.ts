import type { NetscriptPort, NS, ProcessInfo } from "netscript";

import { HostMsg, WorkerType, TargetType, HOSTS_PORT, HOSTS_DONE, EMPTY_SENTINEL } from "util/ports";

import { Stream, StreamSink, Transaction } from "sodium";

export async function main(ns: NS) {
    ns.tail();

    let hostsPort = ns.getPortHandle(HOSTS_PORT);

    const tickSink: StreamSink<void> = new StreamSink();

    const workerSink: StreamSink<Worker> = new StreamSink();
    const targetSink: StreamSink<Target> = new StreamSink();

    let hostsMessagesWaiting = true;

    setup(workerSink, targetSink, tickSink, ns);

    let streamHostsToSink = makeStreamHostsToSink(ns, hostsPort, workerSink, targetSink);

    while (true) {
        if (hostsMessagesWaiting) {
            streamHostsToSink();
            hostsMessagesWaiting = false;

            hostsPort.nextWrite().then(_ => {
                hostsMessagesWaiting = true;
            });
        }
        tickSink.send(null);
        await ns.sleep(100);
    }
}

/** Configure the Sodium event graph.
 *
 * DO NOT add a `ns: NS` parameter. Using `ns` APIs inside Sodium
 * callbacks is likely to result in "failed concurrency" errors if
 * they happen to run at the same time as `ns.sleep` in the main loop.
 */
function setup(workerStream: Stream<Worker>, targetStream: Stream<Target>, tickStream: Stream<void>, ns: NS): void {
    Transaction.run(() => {
        let emptyWorkerList: Worker[] = [];
        let workersCell = workerStream.accum(emptyWorkerList, (w: Worker, workers: Worker[]) => [...workers, w]);

        let emptyTargetList: Target[] = [];
        let targetsCell = targetStream.accum(emptyTargetList, (t: Target, targets: Target[]) => [...targets, t]);


        // ########################################################
        // ## Listeners
        // ########################################################

        tickStream.listen(() => ns.printf("management tick"));
        workerStream.listen((w: Worker) => ns.printf("new worker: %s", w.name));
        targetStream.listen((t: Target) => ns.printf("new target: %s", t.name));
    });
}

function makeStreamHostsToSink(
    ns: NS,
    hostsPort: NetscriptPort,
    workerSink: StreamSink<Worker>,
    targetSink: StreamSink<Target>,
) {
    return function() {
        // Read everything from the port until empty or getting the done signal.
        while (true) {
            let nextMsg = hostsPort.read();
            if (typeof nextMsg === "string" && (nextMsg === EMPTY_SENTINEL || nextMsg === HOSTS_DONE)) {
                break;
            }

            if (typeof nextMsg === "object") {
                let nextHostMsg = nextMsg as HostMsg;
                switch (nextHostMsg.type) {
                    case WorkerType:
                        workerSink.send(new Worker(ns, nextHostMsg.host));
                        break;
                    case TargetType:
                        targetSink.send(new Target(ns, nextHostMsg.host));
                        break;
                }
            }
        }
    };
}

class Worker {
    ns: NS;
    name: string;
    maxRam: number;
    scripts: ProcessInfo[];

    constructor(ns: NS, host: string) {
        this.ns = ns;
        this.name = host;
        this.maxRam = ns.getServerMaxRam(host);
        this.scripts = ns.ps(host);
    }
}

class Target {
    ns: NS;
    name: string;
    maxMoney: number;
    minSec: number;

    constructor(ns: NS, host: string) {
        this.ns = ns;
        this.name = host;
        this.maxMoney = ns.getServerMaxMoney(host);
        this.minSec = ns.getServerMinSecurityLevel(host);
    }
}
