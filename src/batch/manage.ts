import type { NetscriptPort, NS, ProcessInfo } from "netscript";

import { HostMsg, WorkerType, TargetType, HOSTS_PORT, HOSTS_DONE, EMPTY_SENTINEL } from "util/ports";

import { StreamSink, Transaction } from "sodium";

export async function main(ns: NS) {
    ns.tail();

    let hostsPort = ns.getPortHandle(HOSTS_PORT);

    const tickSink: StreamSink<void> = new StreamSink();

    const pauseHostMsgSink: StreamSink<void> = new StreamSink();
    const hostMsgSink: StreamSink<HostMsg> = new StreamSink();
    const hostMsgStream = hostMsgSink;

    let hostsMessagesWaiting = true;

    Transaction.run(() => {
        let emptyWorkerList: Worker[] = [];
        let workerStream = hostMsgStream
            .filter((msg: HostMsg) => msg.type === WorkerType)
            .map((msg: HostMsg) => new Worker(ns, msg.host));
        let workersCell = workerStream.accum(emptyWorkerList, (w: Worker, workers: Worker[]) => [...workers, w]);

        let emptyTargetList: Target[] = [];
        let targetStream = hostMsgStream
            .filter((msg: HostMsg) => msg.type === TargetType)
            .map((msg: HostMsg) => new Target(ns, msg.host));
        let targetsCell = targetStream.accum(emptyTargetList, (t: Target, targets: Target[]) => [...targets, t]);

        tickSink.listen(() => ns.printf("management tick"));
        workerStream.listen((w: Worker) => ns.printf("new worker: %s", w.name));
        targetStream.listen((t: Target) => ns.printf("new target: %s", t.name));

        pauseHostMsgSink.listen(() => {
            hostsPort.nextWrite().then(_ => {
                hostsMessagesWaiting = true;
            });
        });
    });

    let streamHostsToSink = makeStreamHostsToSink(hostsPort, hostMsgSink, pauseHostMsgSink);

    while (true) {
        if (hostsMessagesWaiting) {
            streamHostsToSink();
            hostsMessagesWaiting = false;
        }
        tickSink.send(null);
        await ns.sleep(100);
    }
}

function makeStreamHostsToSink(hostsPort: NetscriptPort, hostMsgSink: StreamSink<HostMsg>, pauseHostMsgSink: StreamSink<void>) {
    return function() {
        // Read everything from the port until empty or getting the done signal.
        while (true) {
            let nextMsg = hostsPort.read();
            if (typeof nextMsg === "string" && (nextMsg === EMPTY_SENTINEL || nextMsg === HOSTS_DONE)) {
                break;
            }

            if (typeof nextMsg === "object") {
                let nextHostMsg = nextMsg as HostMsg;
                hostMsgSink.send(nextHostMsg);
            }
        }
        pauseHostMsgSink.send(null);
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
