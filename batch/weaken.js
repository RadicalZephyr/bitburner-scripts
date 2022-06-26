export async function main(ns) {
    const target = ns.args[0];
    if (typeof target != 'string') {
        ns.print('invalid target: %s', target);
        return;
    }
    const sleepTime = ns.args[1];
    if (typeof sleepTime != 'number') {
        ns.print('invalid sleep time: %s', sleepTime);
        return;
    }
    await ns.sleep(sleepTime);
    await ns.weaken(target);
    ns.tprint(`weakening ${target} done`);
}
