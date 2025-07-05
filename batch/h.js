export async function main(ns) {
    const args = ns.args;
    const target = args[0];
    if (typeof target != 'string') {
        return;
    }
    let sleepTime = args[1];
    if (typeof sleepTime != 'number') {
        sleepTime = 0;
    }
    await ns.hack(target, { additionalMsec: sleepTime });
    globalThis.performance.mark("hack");
}
