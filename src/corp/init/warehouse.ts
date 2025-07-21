import type { NS } from 'netscript';

import { AGRI_DIVISION, CITIES } from 'corp/constants';

export async function main(ns: NS) {
  const corp = ns.corporation;

  if (!corp.hasCorporation()) {
    ns.tprint('you must start a corporation first!');
    return;
  }

  for (const city of CITIES) {
    if (corp.hasWarehouse(AGRI_DIVISION, city)) continue;

    corp.purchaseWarehouse(AGRI_DIVISION, city);
    ns.tprint(`purchased a warehouse for ${AGRI_DIVISION} in ${city}`);
  }
  ns.tprint('now run corp/init/hire.js');
}
