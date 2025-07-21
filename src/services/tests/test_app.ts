import type { NS } from 'netscript';
import {
  ALLOC_ID,
  ALLOC_ID_ARG,
  MEM_TAG_FLAGS,
} from 'services/client/memory_tag';

import { parseAndRegisterAlloc } from 'services/client/memory';

export async function main(ns: NS) {
  const flags = ns.flags([['help', false], ...MEM_TAG_FLAGS]);
  const rest = flags._ as (string | number)[];
  if (
    flags.help
    || typeof flags[ALLOC_ID] !== 'number'
    || rest.length === 0
    || typeof rest[0] !== 'number'
  ) {
    ns.tprint(`Usage: run ${ns.getScriptName()} ${ALLOC_ID_ARG} ID TIME_MS`);
    return;
  }

  const allocationId = await parseAndRegisterAlloc(ns, flags);
  if (allocationId === null) {
    return;
  }

  const sleepTime = rest[0] as number;
  await ns.sleep(sleepTime);
}
