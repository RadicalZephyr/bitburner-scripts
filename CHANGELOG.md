# Changelog

## Unreleased

### Batch hacking

- Introduce `taskSelectorTickMs` and `discoverWalkIntervalMs` config options for smoother port loops and discovery timing [#160][pr-160].
- Make opening a tail window when batch execution fails via `spawnBatchOpenTailOnExecFail` config [#166][pr-166].
- Expected value and hack thread calculations accept custom hack percentages, used by monitor and task selector [#172][pr-172].
- Harvest script rewritten with argument parsing and setup helper functions [#176][pr-176].
- Done messages now include the host in addition to the PID for reliable batch tracking [#180][pr-180].
- Memory-aware batch selection uses free-RAM snapshots to pick the best targets [#182][pr-182], [#183][pr-183].
- Harvests below `harvestGainThreshold` are skipped to keep RAM focused on profitable targets [#185][pr-185].
- Improved accuracy of harvest batch fitting algorithm [#191][pr-191].
- Fixed sow task requesting smaller allocations than necessary [#191][pr-191].

### Services

- Discovery, memory, and other daemons run asynchronous `readLoop`s for lower latency [#160][pr-160].
- New Launch service replaces `launch.ts` for remote script execution [#173][pr-173];
    - Expanded options with `ramOverride` support [#175][pr-175].
- Source File service exposes owned Source File levels for other scripts [#195][pr-195].

### IPvGO

- Introduce `kataPlay.ts` which plays IPvGO using a KataGo HTTP proxy; setup instructions cover running the proxy and script [#206][pr-206].

### Automation

- Company work automation handles multiple corporations and respects a configurable reputation goal [#187][pr-187].
- Faction work script overhauled with best work selection and added focus toggle [#188][pr-188].
- Augmentation purchasing supports reputation donations and NeuroFlux levels [#189][pr-189].
- Loop install script automates late bitnode progression, purchasing programs, training skills and purchasing augmentations before reinstalling [#190][pr-190].
- Add a script to install backdoors on faction servers as soon as it becomes possible [#193][pr-193].
- Automation bootstrap launches faction, backdoor, and RAM upgrade tasks when Source File\u202f4 is owned [#195][pr-195].
- Company work automation works for all faction-giving companies evenly and added focus toggle [#198][pr-198].

### Utilities

- Added `readLoop` helper and `sleep` wrappers to simplify async port polling [#160][pr-160].
- `boolFromString` allows boolean config values like `yes`/`on`/`1` [#166][pr-166].
- `growthAnalyze` helper exported for consistent growth calculations [#190][pr-190].
- `killEverywhere` command kills scripts across the network; `clear-port.js` clears all ports when none specified [#192][pr-192], [#191][pr-191].
- Backdoor helpers (`needsBackdoor`, `canInstallBackdoor`) and `shortestPath` utility added for automation scripts [#193][pr-193].
- `makeFuid` generates unique IDs for client requests and allocation tracking [#192][pr-192].

### User interface

- Backdoor notifier rewritten as a React component with automatic tail management [#178][pr-178].
- Monitor HUD displays expected profit per second alongside expected value [#185][pr-185].

### Documentation and tests

- Memory management guide expanded with the new `FreeRam` structure and memory-aware calculations [#184][pr-184].
- Unit tests cover expected value calculations with limited memory [#184][pr-184].
- AGENTS guidelines clarified for PR reviewers [#189][pr-189].

[pr-160]: https://github.com/RadicalZephyr/bitburner-scripts/pull/160
[pr-166]: https://github.com/RadicalZephyr/bitburner-scripts/pull/166
[pr-172]: https://github.com/RadicalZephyr/bitburner-scripts/pull/172
[pr-173]: https://github.com/RadicalZephyr/bitburner-scripts/pull/173
[pr-174]: https://github.com/RadicalZephyr/bitburner-scripts/pull/174
[pr-175]: https://github.com/RadicalZephyr/bitburner-scripts/pull/175
[pr-176]: https://github.com/RadicalZephyr/bitburner-scripts/pull/176
[pr-177]: https://github.com/RadicalZephyr/bitburner-scripts/pull/177
[pr-178]: https://github.com/RadicalZephyr/bitburner-scripts/pull/178
[pr-180]: https://github.com/RadicalZephyr/bitburner-scripts/pull/180
[pr-181]: https://github.com/RadicalZephyr/bitburner-scripts/pull/181
[pr-182]: https://github.com/RadicalZephyr/bitburner-scripts/pull/182
[pr-183]: https://github.com/RadicalZephyr/bitburner-scripts/pull/183
[pr-184]: https://github.com/RadicalZephyr/bitburner-scripts/pull/184
[pr-185]: https://github.com/RadicalZephyr/bitburner-scripts/pull/185
[pr-186]: https://github.com/RadicalZephyr/bitburner-scripts/pull/186
[pr-187]: https://github.com/RadicalZephyr/bitburner-scripts/pull/187
[pr-188]: https://github.com/RadicalZephyr/bitburner-scripts/pull/188
[pr-189]: https://github.com/RadicalZephyr/bitburner-scripts/pull/189
[pr-190]: https://github.com/RadicalZephyr/bitburner-scripts/pull/190
[pr-191]: https://github.com/RadicalZephyr/bitburner-scripts/pull/191
[pr-192]: https://github.com/RadicalZephyr/bitburner-scripts/pull/192
[pr-193]: https://github.com/RadicalZephyr/bitburner-scripts/pull/193
[pr-195]: https://github.com/RadicalZephyr/bitburner-scripts/pull/195
[pr-198]: https://github.com/RadicalZephyr/bitburner-scripts/pull/198
[pr-206]: https://github.com/RadicalZephyr/bitburner-scripts/pull/206

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
