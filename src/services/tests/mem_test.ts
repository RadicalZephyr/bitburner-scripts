import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import {
  AllocationClaim,
  AllocationRelease,
  AllocationRequest,
  MEMORY_PORT,
  MEMORY_RESPONSE_PORT,
  Message,
  MessageType,
} from 'services/client/memory';

import { readAllFromPort } from 'util/ports';

export async function main(ns: NS) {
  ns.flags(MEM_TAG_FLAGS);
  const memPort = ns.getPortHandle(MEMORY_PORT);
  const memResponsePort = ns.getPortHandle(MEMORY_RESPONSE_PORT);

  let memMessageWaiting = true;

  while (true) {
    if (memMessageWaiting) {
      for (const nextMsg of readAllFromPort(ns, memPort)) {
        const msg = nextMsg as Message;
        const requestId = msg[1];
        switch (msg[0]) {
          case MessageType.Request: {
            const request = msg[2] as AllocationRequest;
            ns.tprintf('got mem request: %s', JSON.stringify(request));
            memResponsePort.write([
              requestId,
              {
                allocationId: 12,
                hosts: [],
              },
            ]);
            break;
          }
          case MessageType.Release: {
            const rel = msg[2] as AllocationRelease;
            ns.tprintf(
              'received release message for allocation ID: %d pid:%d host:%s',
              rel.allocationId,
              rel.pid,
              rel.hostname,
            );
            memResponsePort.write([requestId, {}]);
            break;
          }
          case MessageType.Claim: {
            const claim = msg[2] as AllocationClaim;
            ns.tprintf(
              'received claim message for allocation ID: %d -> pid %d host %s',
              claim.allocationId,
              claim.pid,
              claim.hostname,
            );
            memResponsePort.write([requestId, {}]);
            break;
          }
        }
      }
      memMessageWaiting = false;
      await memPort.nextWrite().then(() => {
        memMessageWaiting = true;
      });
    }
  }
}
