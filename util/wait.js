export async function waitForExit(ns, pid) {
    while (true) {
        await ns.asleep(100);
        if (!ns.isRunning(pid)) {
            break;
        }
    }
}
