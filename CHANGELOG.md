# Changelog

## v2.1.0

- Services bootstrap now launches the updater on `n00dles` to avoid running too many scripts on `foodnstuff`.
- Added initial corporation management scripts and configuration support.
- Added a corporation summary and related documentation.

## v2.0.0

Built for Bitburner 2.8.1

- Release workflow now generates a `VERSION.json` and uses `softprops/action-gh-release`.
- Added automatic updater service (`services/updater.ts`) with instructions in `README.md`.
- Bootstrap script renamed to `external-bootstrap.js`; aliases updated.
- Added new documentation files covering contributing guidelines, gang management, task selection, tuning, and a memory allocator RFD.
- Significant memory allocator improvements with reserved RAM scanning and cancellation of removed harvest batches.
- Removed unused `src/batch/lib.ts` and related cleanup.
- Updated CI to Node 22 and introduced `.nvmrc` for local version management.

- New scripts:
    - `gang/new-manage.ts` and related modules automate recruiting, gear purchases and task selection for gangs.
    - `hacknet/sell-hashes.ts` sells hashes with an optional `--continue` flag.
    - `services/batch.ts` orchestrates harvest batches using the memory allocator.
    - `services/updater.ts` automatically fetches new releases when `VERSION.json` exists.
    - `karma.tsx` displays karma in a HUD window.
    - `util/rainbow.ts` prints a colorful test pattern.

- Existing script updates:
    - `start-share.ts` adds `--max-ram` to filter sharing hosts.
    - `start.ts` now transfers all dependencies of `bootstrap.js` automatically.
    - `stopworld.ts` supports tab-completion of script names.
    - `whereis.ts` no longer checks RAM before running `--goto`.
    - `buy-hacknet.ts` was removed in favour of `hacknet/buy.ts` which uses hours for `--return-time`.
