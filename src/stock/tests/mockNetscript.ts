import type { NS, NetscriptPort } from "netscript";
import { TickData } from "stock/indicators";

declare function setTimeout(
    handler: (...args: any[]) => void,
    timeout?: number
): any;

export interface TradeOrder {
    action: "BUY" | "SELL";
    sym: string;
    shares: number;
    price: number;
}

class MockPort implements NetscriptPort {
    private queue: any[] = [];
    private waiters: (() => void)[] = [];

    write(value: any): any {
        this.queue.push(JSON.parse(JSON.stringify(value)));
        this.waiters.forEach((w) => w());
        this.waiters = [];
        return null;
    }

    tryWrite(value: any): boolean {
        this.write(value);
        return true;
    }

    nextWrite(): Promise<void> {
        if (!this.queue.length) {
            return new Promise((res) => this.waiters.push(res));
        }
        return Promise.resolve();
    }

    read(): any {
        return this.queue.length ? this.queue.shift() : "NULL PORT DATA";
    }

    peek(): any {
        return this.queue.length ? this.queue[0] : "NULL PORT DATA";
    }

    full(): boolean {
        return false;
    }

    empty(): boolean {
        return this.queue.length === 0;
    }

    clear(): void {
        this.queue = [];
    }
}

class StockMock {
    private ticks: TickData[];
    index = -1;
    holdings: Record<string, number> = {};
    orders: TradeOrder[] = [];
    private updateWaiters: ((v: number) => void)[] = [];
    symbols: string[];

    constructor(symbol: string, ticks: TickData[]) {
        this.symbols = [symbol];
        this.ticks = ticks;
    }

    getSymbols() {
        return this.symbols;
    }

    private currentTick(): TickData {
        const idx = Math.max(0, Math.min(this.index, this.ticks.length - 1));
        return this.ticks[idx];
    }

    getAskPrice(sym: string) {
        return this.currentTick().askPrice;
    }

    getBidPrice(sym: string) {
        return this.currentTick().bidPrice;
    }

    getVolatility(sym: string) {
        return this.currentTick().volatility;
    }

    getForecast(sym: string) {
        return this.currentTick().forecast;
    }

    getPosition(sym: string) {
        return [this.holdings[sym] ?? 0, 0, 0, 0];
    }

    getMaxShares(sym: string) {
        return 10;
    }

    buyStock(sym: string, shares: number) {
        const price = this.getAskPrice(sym);
        this.holdings[sym] = (this.holdings[sym] ?? 0) + shares;
        this.orders.push({ action: "BUY", sym, shares, price });
        return price;
    }

    sellStock(sym: string, shares: number) {
        const price = this.getBidPrice(sym);
        this.holdings[sym] = (this.holdings[sym] ?? 0) - shares;
        this.orders.push({ action: "SELL", sym, shares, price });
        return price;
    }

    nextUpdate(): Promise<number> {
        return new Promise((res) => this.updateWaiters.push(res));
    }

    advanceTick() {
        if (this.index < this.ticks.length - 1) {
            this.index++;
        }
        const waiters = [...this.updateWaiters];
        this.updateWaiters = [];
        waiters.forEach((w) => w(6000));
    }
}

/**
 * Test environment for running Netscript scripts in Jest.
 */
export class NetscriptTestEnvironment {
    readonly stock: StockMock;
    private ports = new Map<number, MockPort>();
    private files = new Map<string, string>();
    running = true;

    constructor(symbol: string, ticks: TickData[]) {
        this.stock = new StockMock(symbol, ticks);
    }

    createNS(pid: number): NS {
        const env = this;
        return {
            pid,
            getHostname() {
                return "home";
            },
            flags(defs: [string, any][]) {
                const res: any = {};
                for (const [k, v] of defs) res[k] = v;
                return res;
            },
            disableLog() {},
            print() {},
            tprint() {},
            formatNumber(n: number) { return String(n); },
            formatPercent(n: number) { return String(n); },
            ui: { openTail() {}, getTheme() { return {}; } },
            getPortHandle(n: number) {
                if (!env.ports.has(n)) env.ports.set(n, new MockPort());
                return env.ports.get(n)!;
            },
            fileExists(path: string) {
                return env.files.has(path);
            },
            read(path: string) {
                return env.files.get(path) ?? "";
            },
            write(path: string, data: string, mode?: string) {
                if (mode === "w") env.files.set(path, data);
                else env.files.set(path, (env.files.get(path) ?? "") + data);
                return true;
            },
            rm(path: string) {
                env.files.delete(path);
            },
            sleep: async (ms: number) => {
                if (!env.running) throw new Error("stopped");
                await new Promise((r) => (setTimeout as any)(r, 0));
            },
            stock: env.stock,
        } as unknown as NS;
    }

    advanceTick() {
        this.stock.advanceTick();
    }

    stop() {
        this.running = false;
        this.stock.advanceTick();
    }
}
