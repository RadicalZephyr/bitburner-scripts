## Project: Bitburner Stock Tracker & Trader

### 1. Overview
A new suite of Netscript 2.0 scripts for the Bitburner game:
- **stock/tracker.ts**: Collects raw price ticks for a configurable set of
  symbols into a rolling window and persists them to the Bitburner
  filesystem. Provides a client API for requesting both raw data and
  computed indicators.
- **stock/trader.ts**: Requests indicators from the tracker script and
  makes buy/sell decisions based on configurable thresholds and risk
  controls. Provides a client API for directing trader daemon to
  invest more funds or sell all holdings.

### 2. Architectural Components

#### 2.1 Data Storage (Bitburner FS)

After considering several options for data persistence (LocalStorage,
IndexedDB and Bitburner FS), we've chosen to use the Bitburner FS for
the following reasons.

* We are storing very simple JSON objects in relatively small amounts.
* We want stored historical stock data to be saved in the Bitburner
  save file so restoring an old save or moving it to a new browser
  will contain relevant historical stock data.

We will store the data as follows:

- **Directory**: `/stocks/`
- **Files per symbol**: `SYMBOL.json`
  - Stores an array of `{ ts: number, askPrice: number, bidPrice: number, volatility: number, forecast: number }` entries.
  - Rolling window length (N ticks) is configurable.

##### 2.1.1 Consequences

One complication of storing our data in the Bitburner FS is that the
data will be local to the machine where the `tracker` script is
running. In order to safeguard this data we need to regularly copy
the entire stocks folder to the home server:
`ns.scp(ns.ls("/stocks"), "home")`.

The tracker daemon may be launched on a remote worker through the
memory manager and `services/launch.ts`. When running remotely, ensure
the `/stocks/SYMBOL.json` files are copied to that host before the
tracker starts and synced back to `home` periodically or when the
daemon exits. Otherwise the data will be lost if the remote worker is
reset.

#### 2.2 Configuration Module (`src/stock/config.ts`)

Persist and load configuration values from `LocalStorage` using the
`src/util/localStorage.ts` APIs. Use a similar structure to
`src/batch/config.ts`.

- Window size (number of ticks)
- Indicator parameters (periods, thresholds)
- Risk limits (max position, cooldowns)
- Paths

#### 2.3 Tracker Script (`src/stock/tracker.ts`)
1. On each stock update `await ns.stock.nextUpdate();`
   - Fetch these values for each symbol:
     * `ns.stock.getBidPrice()`
     * `ns.stock.getAskPrice()`
     * `ns.stock.getVolatility()`
     * `ns.stock.getForecast()`

   - Append `{ ts: Date.now(), askPrice, bidPrice, volatility, forecast }` to the in-memory buffer.
   - Trim buffer to the last N entries.
   - Write buffer to `/stocks/SYMBOL.json`.
2. For each symbol, compute indicators (see Section 3).
3. Process requests sent by `StockTrackerClient`.

#### 2.4 Tracker Client API (`stock/client/tracker.ts`)
1. Defines a port-based request/response protocol. Use a `MessageType`
   enum and typed payloads mirroring
   `src/services/client/memory.ts`. Supported messages should include
   `RequestTicks` and `RequestIndicators` so the tracker can respond
   with `TickData[]` or the computed indicator object.
  * Current window of raw tick data for all symbols.
  * All statistical indicators for all symbols.
2. Create a class (`TrackerClient`) to hide details of
   communication protocol.
3. Send requests to tracker daemon on a single well-known port `TRACKER_PORT`.
4. Multiplex responses to client on a single well-known `TRACKER_RESPONSE_PORT`.

#### 2.5 Trader Script (`src/stock/trader.ts`)
1. Load ticks from each `/stocks/SYMBOL.json`.
2. Compare latest values to buy/sell rules (configurable).
3. Submit `ns.stock.buy()` or `ns.stock.sell()` orders.
4. Log decisions to `/logs/trader.log`.

#### 2.6 Trader Client API (`src/stock/client/trader.ts`)
1. Defines a port-based request/response protocol. Use a `MessageType`
   enum and typed payloads mirroring
   `src/services/client/memory.ts`. Supported messages should include:
   * `Invest` specify an amount of liquid cash to invest.
   * `Liquidate` instructs the trader to immediately sell all
     holdings.
2. Create a class (`TraderClient`) to hide details of communication
   protocol.
3. Send requests to trader daemon on a single well-known port `TRADER_PORT`.
4. Multiplex responses to client on a single well-known `TRADER_RESPONSE_PORT`.

#### 2.7 Stock Bootstrap Script (`src/stock/bootstrap.ts`)

Similar to other `bootstrap.ts` scripts, this script should use the
`launch` function from `src/services/launch.ts` to execute the tracker
and trader service daemons. The bootstrap should request RAM
allocations with `MemoryClient` and call
`registerAllocationOwnership` so that allocations are released when the
process exits.

### 3. Statistical Indicators (computed per symbol each run)
1. **Count (N)**
2. **Mean price** (μ)
3. **Median price**
4. **Minimum & Maximum** prices
5. **Standard deviation** (σ)
6. **Rolling Simple Moving Average** (SMA) over periods P₁, P₂...
7. **Exponential Moving Average** (EMA) over periods E₁, E₂...
8. **Z‑Score** for latest tick: (Pₜ – μ) / σ
9. **Rate of Change (ROC)** over period R: (Pₜ – Pₜ₋R) / Pₜ₋R
10. **Bollinger Bands**: SMA ± k·σ (with k typically 2)
11. **Percentiles (e.g., 10th, 90th)**
12. **Maximum Drawdown / Run‑Up** within window
13. **Skewness**
14. **Kurtosis**

### 4. Risk Controls & Logging
- **Max position size** per symbol & total equity percentage.
- **Cooldown**: minimum time between trades on same symbol.
- **Transaction fee/slippage buffer**: price adjustments to avoid whipsaw.
- **Decision log**: CSV or JSON lines with timestamp, symbol, price, indicators, action.
- Log output should follow the `AGENTS.md` guidance: use prefixes like
  `INFO:` and `WARN:` with `ns.print()` and format money values with
  `ns.formatNumber()`.

### 5. Development Roadmap / TODOs

#### MVP (Alpha)
1. Scaffold project structure and `src/stock/config.ts`.
2. Implement `src/stock/tracker.ts`:
   - Read window size from `src/stock/config.ts`.
   - Fetch symbols with `ns.stock.getSymbols()`.
   - Read existing historical data for each symbol from `/stocks/SYMBOL.json`
   - Fetch and buffer ticks.
   - Persist to FS as JSON.
3. Implement `src/stock/client/tracker.ts`.
4. Implement basic indicators: mean, min/max, σ.
5. Unit test indicator functions using Jest unit tests in a separate file.
6. Hook tracker and trader into `src/stock/bootstrap.ts` using
   `launch` and the memory manager.
7. Write quick console output of stats for one symbol.

#### Phase 1 (Beta)
1. Add median & percentiles.
2. Add SMA & EMA computations, including unit tests.
3. Implement `src/stock/trader.ts` skeleton:
   - Request indicators for all symbols with `StockTrackerClient`.
4. Unit tests for indicator helpers using sample data.
5. Add simple threshold-based buy/sell using Z‑score rules.
6. Basic risk control: max position per symbol.

#### Phase 2 (Feature Complete)
1. Integrate ROC & Bollinger Bands, including unit tests.
2. Implement drawdown/run‑up metrics.
3. Add percentile thresholds instead of raw min/max.
4. Write decision logger and log file rotation.
5. Configurable cooldown enforcement.

#### Phase 3 (Advanced)
1. Backtesting harness:
   - Replay historical ticks from JSON and simulate trades.
2. Parameter tuning: script to sweep indicator periods & thresholds.
3. Extend to portfolio-level diversification metrics (correlations).
4. *(Optional)* Add skewness/kurtosis and anomaly detection.

### 6. Testing & Validation
- End-to-end test: run tracker + trader in simulation mode.
- Backtest scripts produce P&L reports.

---
*This spec lays out a clear, incremental path from simple tracking to a robust, parameterized trading engine.*
