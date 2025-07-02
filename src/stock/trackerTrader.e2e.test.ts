import { NetscriptTestEnvironment } from "./tests/mockNetscript";
import { TickData } from "stock/indicators";

declare function setTimeout(
    handler: (...args: any[]) => void,
    timeout?: number
): any;

/** Simple integration test of tracker and trader scripts. */
test("tracker and trader perform trades", async () => {
    const ticks: TickData[] = [
        { ts: 0, askPrice: 100, bidPrice: 100, volatility: 0, forecast: 0 },
        { ts: 1, askPrice: 100, bidPrice: 100, volatility: 0, forecast: 0 },
        { ts: 2, askPrice: 100, bidPrice: 100, volatility: 0, forecast: 0 },
        { ts: 3, askPrice: 100, bidPrice: 100, volatility: 0, forecast: 0 },
        { ts: 4, askPrice: 100, bidPrice: 100, volatility: 0, forecast: 0 },
        { ts: 5, askPrice: 70, bidPrice: 70, volatility: 0, forecast: 0 },
        { ts: 6, askPrice: 150, bidPrice: 150, volatility: 0, forecast: 0 },
    ];

    // reduce cooldown to allow immediate sell after buy
    globalThis.localStorage = {
        store: {} as Record<string, string>,
        getItem(key: string) { return this.store[key]; },
        setItem(key: string, val: string) { this.store[key] = val; },
        removeItem(key: string) { delete this.store[key]; }
    } as any;
    globalThis.localStorage.setItem("STOCK_COOLDOWN_MS", "0");

    const env = new NetscriptTestEnvironment("AAA", ticks);
    const trackerNS = env.createNS(1);
    const traderNS = env.createNS(2);

    const { main: trackerMain } = await import("./tracker");
    const { main: traderMain } = await import("./trader");

    let trackerErr: any = null;
    let traderErr: any = null;
    const trackerP = trackerMain(trackerNS).catch((e) => { trackerErr = e; });
    const traderP = traderMain(traderNS).catch((e) => { traderErr = e; });

    for (let i = 0; i < ticks.length; i++) {
        env.advanceTick();
        await new Promise((r) => setTimeout(r, 20));
    }

    env.stop();
    await Promise.allSettled([trackerP, traderP]);

    if (trackerErr && trackerErr.message !== "stopped") throw trackerErr;
    if (traderErr && traderErr.message !== "stopped") throw traderErr;

    expect(env.stock.orders[0].action).toBe("BUY");
    expect(env.stock.orders[env.stock.orders.length - 1].action).toBe("SELL");
    expect(env.stock.holdings["AAA"]).toBe(0);
}, 10000);
