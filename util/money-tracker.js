import { withPlugins } from 'ns/extend';
import { alivePlugin } from 'ns/plugins/alive';
import { StatTracker } from 'util/stat-tracker';
/**
 * Create a MoneyTracker and populate it with initial samples.
 *
 * @param ns - Netscript API
 * @param historyLen - Number of samples to track
 * @param cadence - Delay between samples in milliseconds
 * @returns A MoneyTracker that is automatically updated
 */
export async function primedMoneyTracker(ns, historyLen = 3, cadence = 10_000) {
    const tracker = new StatTracker(historyLen);
    for (let i = 0; i < historyLen; i++) {
        await updateMoneyTracker(ns, tracker, cadence);
    }
    void tickMoneyTrackerUpdates(ns, tracker, cadence);
    return tracker;
}
/**
 * Continuously update a MoneyTracker until the script exits.
 *
 * @param ns - Netscript API
 * @param tracker - Tracker to update
 * @param cadence - Delay between updates in milliseconds
 */
export async function tickMoneyTrackerUpdates(ns, tracker, cadence = 10_000) {
    const nsx = withPlugins(ns, alivePlugin());
    while (nsx.alive.isAlive()) {
        await updateMoneyTracker(ns, tracker, cadence);
    }
}
/**
 * Record a new money sample in the tracker.
 *
 * @param ns - Netscript API
 * @param tracker - Tracker to update
 * @param cadence - Delay before returning, in milliseconds
 */
export async function updateMoneyTracker(ns, tracker, cadence = 10_000) {
    tracker.update(ns.getMoneySources().sinceInstall);
    await ns.asleep(cadence);
}
