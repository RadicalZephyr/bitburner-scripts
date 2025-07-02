## Project: Bitburner Stock Tracker & Trader

### 1. Overview
A pair of Netscript 2.0 scripts for the Bitburner game:
- **tracker.js**: Collects raw price ticks for a configurable set of symbols into a rolling window and persists them to the filesystem.
- **trader.js**: Loads historical ticks, computes indicators, and makes buy/sell decisions based on configurable thresholds and risk controls.

### 2. Architectural Components

#### 2.1 Data Storage (Bitburner FS)
- **Directory**: `/stocks/`
- **Files per symbol**: `SYMBOL.json`
  - Stores an array of `{ ts: number, price: number }` entries.
  - Rolling window length (N ticks) is configurable.

#### 2.2 Configuration Module (`config.js`)
- List of symbols
- Window size (number of ticks)
- Indicator parameters (periods, thresholds)
- Risk limits (max position, cooldowns)
- Paths

#### 2.3 Tracker Script (`tracker.js`)
1. On each iteration (configurable interval):
   - Fetch `ns.getStockPrice(symbol)` for each symbol.
   - Append `{ ts: Date.now(), price }` to the in-memory buffer.
   - Trim buffer to the last N entries.
   - Write buffer to `/stocks/SYMBOL.json`.

#### 2.4 Trader Script (`trader.js`)
1. Load ticks from each `/stocks/SYMBOL.json`.
2. For each symbol, compute indicators (see Section 3).
3. Compare latest values to buy/sell rules (configurable).
4. Submit `ns.stock.buy()` or `ns.stock.sell()` orders.
5. Log decisions to `/logs/trader.log`.

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
13. *(Optional)* Skewness & Kurtosis

### 4. Risk Controls & Logging
- **Max position size** per symbol & total equity percentage.
- **Cooldown**: minimum time between trades on same symbol.
- **Transaction fee/slippage buffer**: price adjustments to avoid whipsaw.
- **Decision log**: CSV or JSON lines with timestamp, symbol, price, indicators, action.

### 5. Development Roadmap / TODOs

#### MVP (Alpha)
1. Scaffold project structure and `config.js`.
2. Implement `tracker.js`:
   - Read symbols & window size from config.
   - Fetch and buffer ticks.
   - Persist to FS as JSON.
3. Implement basic indicator: mean, min/max, σ.
4. Write quick console output of stats for one symbol.

#### Phase 1 (Beta)
5. Add median & percentiles.
6. Add SMA & EMA computations.
7. Implement `trader.js` skeleton:
   - Load JSON buffers.
   - Compute and print indicators for each symbol.
8. Add simple threshold-based buy/sell using Z‑score rules.
9. Basic risk control: max position per symbol.

#### Phase 2 (Feature Complete)
10. Integrate ROC & Bollinger Bands.
11. Implement drawdown/run‑up metrics.
12. Add percentile thresholds instead of raw min/max.
13. Write decision logger and log file rotation.
14. Configurable cooldown enforcement.

#### Phase 3 (Advanced)
15. Backtesting harness:
   - Replay historical ticks from JSON and simulate trades.
16. Parameter tuning: script to sweep indicator periods & thresholds.
17. Extend to portfolio-level diversification metrics (correlations).
18. *(Optional)* Add skewness/kurtosis and anomaly detection.

### 6. Testing & Validation
- Unit tests for each indicator (compare against known sample data).
- End-to-end test: run tracker + trader in simulation mode.
- Backtest scripts produce P&L reports.

---
*This spec lays out a clear, incremental path from simple tracking to a robust, parameterized trading engine.*

