export async function main(ns) {
    const args = ns.args;
    const target = args[0];
    if (typeof target != 'string') {
        return;
    }
    let sleepTime = args[1];
    if (typeof sleepTime != 'number') {
        sleepTime = 1;
    }
    let donePortId = args[2];
    await ns.weaken(target, { additionalMsec: sleepTime });
    globalThis.performance.mark("weaken");
    if (typeof donePortId === 'number' && donePortId !== -1) {
        ns.writePort(donePortId, ns.pid);
    }
}
