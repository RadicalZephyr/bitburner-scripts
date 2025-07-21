# Stocks Contributor Guide

- The stock market interaction APIs are accessible through the `TIX`
  interface at `ns.stock` in the file `NetScriptDefinitions.d.ts`.
- Any script using the stock APIs must check if the user has access to
  the various API levels using the functions:
    - `ns.stock.hasWSEAccount()`
    - `ns.stock.hasTIXAPIAccess()`
    - `ns.stock.has4SDataTIXAPI()`
- Scripts polling the stock market should use `ns.stock.nextUpdate()`
  to wait until the next market update.
- Every stock transaction (buying and selling) has a $200,000.00
  commission.
- When making changes or enhancements to the design of the stock
  tracker and trader update the spec in `STOCK_TRACKER_SPEC.md`.

`STOCK_TRACKER_SPEC.md` describes the architecture of the stock
tracking daemon and trader. It lays out how price data is collected,
which indicators are exposed to clients and how trading decisions are
made. Refer to the spec when implementing new features so the code and
documentation remain in sync.
