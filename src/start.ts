import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import { collectDependencies } from 'util/dependencies';

export async function main(ns: NS) {
  ns.flags(MEM_TAG_FLAGS);
  ns.disableLog('sleep');

  const script = '/bootstrap.js';
  const dependencies = collectDependencies(ns, script);
  const files = [script, ...dependencies];
  const hostname = 'foodnstuff';

  if (!ns.scp(files, hostname, 'home')) {
    reportError(ns, `failed to send files to ${hostname}`);
    return;
  }

  if (!ns.nuke(hostname)) {
    reportError(ns, `failed to nuke ${hostname}`);
    return;
  }

  const pid = ns.exec(script, hostname);
  if (pid === 0) {
    reportError(ns, `failed to launch ${script} on ${hostname}`);
    return;
  }
}

function reportError(ns: NS, error: string) {
  ns.toast(error, 'error');
  ns.print(`ERROR: ${error}`);
  ns.ui.openTail();
}
