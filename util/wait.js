export async function waitForExit(ns, pid) {
    while (true) {
        await ns.sleep(100);
        if (!ns.isRunning(pid)) {
            break;
        }
    }
}
