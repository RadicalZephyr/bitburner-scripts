import type { NS } from '@ns';

const PORT_DATA = 99; // channel under test

export async function main(ns: NS) {
    const data = ns.getPortHandle(PORT_DATA);
    data.write(1);
}
