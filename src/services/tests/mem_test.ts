import type { NS } from "netscript";

import {
    AllocationClaim,
    AllocationRelease,
    AllocationRequest,
    MEMORY_PORT,
    Message,
    MessageType,
} from "services/client/memory";

import { readAllFromPort } from "/util/ports";

export async function main(ns: NS) {
    let memPort = ns.getPortHandle(MEMORY_PORT);
    let memMessageWaiting = true;

    while (true) {
        if (memMessageWaiting) {
            for (const nextMsg of readAllFromPort(ns, memPort)) {
                let msg = nextMsg as Message;
                const responsePort = msg[1];
                switch (msg[0]) {
                    case MessageType.Request:
                        let request = msg[2] as AllocationRequest;
                        ns.tprintf("got mem request: %s", JSON.stringify(request));
                        ns.writePort(responsePort, {
                            allocationId: 12,
                            hosts: [],
                        });
                        break;
                    case MessageType.Release:
                        const rel = msg[2] as AllocationRelease;
                        ns.tprintf(
                            "received release message for allocation ID: %d pid:%d host:%s",
                            rel.allocationId,
                            rel.pid,
                            rel.hostname,
                        );
                        break;
                    case MessageType.Claim:
                        const claim = msg[2] as AllocationClaim;
                        ns.tprintf(
                            "received claim message for allocation ID: %d -> pid %d host %s",
                            claim.allocationId,
                            claim.pid,
                            claim.hostname,
                        );
                        break;

                }
            }
            memMessageWaiting = false;
            await memPort.nextWrite().then(_ => {
                memMessageWaiting = true;
            });
        }
    }
}
