import type { MoneySource, NS } from 'netscript';
import { StatTracker } from 'util/stat-tracker';

export type MoneyTracker = StatTracker<MoneySource>;

/**
 * Create a MoneyTracker and populate it with initial samples.
 *
 * @param ns - Netscript API
 * @param historyLen - Number of samples to track
 * @param cadence - Delay between samples in milliseconds
 * @returns A MoneyTracker that is automatically updated
 */
export async function primedMoneyTracker(
    ns: NS,
    historyLen = 3,
    cadence = 10_000,
): Promise<MoneyTracker> {
    const tracker = new StatTracker<MoneySource>(historyLen);

    for (let i = 0; i < historyLen; i++) {
        await updateMoneyTracker(ns, tracker, cadence);
    }
    tickMoneyTrackerUpdates(ns, tracker, cadence);

    return tracker;
}

/**
 * Continuously update a MoneyTracker until the script exits.
 *
 * @param ns - Netscript API
 * @param tracker - Tracker to update
 * @param cadence - Delay between updates in milliseconds
 */
export async function tickMoneyTrackerUpdates(
    ns: NS,
    tracker: MoneyTracker,
    cadence = 10_000,
) {
    let running = true;
    ns.atExit(() => {
        running = false;
    }, 'moneyTracker-tickUpdates');

    while (running) {
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
export async function updateMoneyTracker(
    ns: NS,
    tracker: MoneyTracker,
    cadence = 10_000,
) {
    tracker.update(ns.getMoneySources().sinceInstall);
    await ns.asleep(cadence);
}
