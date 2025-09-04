# Changelog

## Unreleased

### Repository Wide Improvements

- Added support for autocompleting flags to all scripts [#213][pr-213].
- Help messages now list all CONFIG values used by each script. [#218][pr-218].

### Startup

- Added a `--minimal` flag to the start script for starting only necessary services [#227][pr-227].

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
- Removed usage of broken `releaseChunks` API [#260][pr-260].
- Harvest script can run without a control port and releases ports safely on exit [#276][pr-276].
- Make number of hack level history samples configurable [#285][pr-285].

### Services

- Discovery, memory, and other daemons run asynchronous `readLoop`s for lower latency [#160][pr-160].
- New Launch service replaces `launch.ts` for remote script execution [#173][pr-173];
    - Expanded options with `ramOverride` support [#175][pr-175].
- Source File service exposes owned Source File levels for other scripts [#195][pr-195].
- Memory allocator retains claimed chunks after owner deallocation and adds configurable garbage collection, grow-check, and response-port timeout settings [#260][pr-260].
- Include megacorp servers in backdoor list [#264][pr-264].
- The port allocator now clears ports before allocating them [#264][pr-264].
- Bootstrap scripts prevent duplicate instances [#268][pr-268].
- Memory service sorts workers with host prioritisation and alphabetical tie-breakers [#273][pr-273].

### IPvGO

- Introduce `kataPlay.ts` which plays IPvGO using a KataGo HTTP proxy; setup instructions cover running the proxy and script [#206][pr-206].
- KataGo proxy and NetScript client gain wall placement and cache-clearing support, with new limits on consecutive passes and invalid moves [#223][pr-223].
- Make `kataPlay.ts` more robust against errors and capture game details when errors occur for later debugging [#240][pr-240].
- Added a `playGo` config value that controls whether to start KataGo AI [#273][pr-273].
- `wipe.ts` now closes the `go/kataPlay.js` HUD [#276][pr-276].

### Automation

- Company work automation handles multiple corporations and respects a configurable reputation goal [#187][pr-187].
- Faction work script overhauled with best work selection and added focus toggle [#188][pr-188], [#221][pr-221].
- Augmentation purchasing supports reputation donations and NeuroFlux levels [#189][pr-189].
- Loop install script automates late bitnode progression, purchasing programs, training skills and purchasing augmentations before reinstalling [#190][pr-190].
- Add a script to install backdoors on faction servers as soon as it becomes possible [#193][pr-193].
- Automation bootstrap launches faction, backdoor, and RAM upgrade tasks when Source File\u202f4 is owned [#195][pr-195].
- Company work automation works for all faction-giving companies evenly and added focus toggle [#198][pr-198].
- Gym training script and travel helpers automate combat stat leveling with configurable cadence (`combatTrainTimeMs`) [#226][pr-226].
- Port opener buying, network-wide manual growth, and Silhouette faction setup scripts streamline early game automation [#226][pr-226].
- Company work automation skips companies for factions the player already belongs to [#226][pr-226].
- Add a script for automating early bitnode bootstrapping [#227][pr-227].
- Faction work automation skips factions with no available work tasks to avoid unreachable reputation goals [#229][pr-229].
- Noodle eater counts bowls eaten and travels to the Noodle Bar automatically when Source File\u202f4 is owned [#245][pr-245].
- `gym` script renamed to `workout` and `port-openers` to `purchase-crackers` [#255][pr-255].
- Automation scripts rely on the global focus setting via `ns.singularity.setFocus` [#255][pr-255].
- Include megacorp servers in backdoor list [#264][pr-264].
- Added `donate` for faction donations and operations [#273][pr-273].
- Company and faction work automation use configurable `companyWorkTimeMs` and `factionWorkTimeMs` durations [#273][pr-273].
- Contract fetcher allocates ports dynamically to avoid conflicts [#273][pr-273].
- Added `best-crime` script to display money per second for each crime [#276][pr-276].
- Company work automation pursues CEO positions after meeting faction reputation goals [#276][pr-276].
- `fetch-contracts` `--test` flag defaults to an empty string and searches for contracts on `home` when testing [#276][pr-276].
- Set sleeves to study algorithms in `loop-install` script [#285][pr-285].

### Contracts

- Added solvers for "Compression III: LZ Compression" and "Hamming Codes" coding contracts [#276][pr-276].

### Manual Hacking

- Added `manual/till`, `manual/sow`, and `manual/harvest` scripts for automating terminal till/sow/harvest operations [#273][pr-273].

### Grafting

- Added `graft/queue-augs.ts` to queue augmentations for grafting with multiplier filters and prerequisite handling [#257][pr-257].
- `graft/queue-augs.ts` now scores augments by multiplier sum to install most impactful augments first [#270][pr-270].

### Sleeves

- Introduced sleeve scripts for augmentation purchases, crime ring coordination, direct management, and a progress dashboard [#266][pr-266].
- Added more sleeve scripts for training all skills, working on
  Bladeburner and studying [#267][pr-267].
- Augmentation purchasing skips sleeves with shock to avoid crashing [#273][pr-273].
- Study script accepts a `--course` option to pick which class sleeves attend [#276][pr-276].

### Bladeburner

- Add a basic Bladeburner skill buying utility and a mission control script to select the best mission every cycle [#246][pr-246].
- Make Bladeburner skill buying script delay configurable [#285][pr-285].
- Penalize dangerous actions in Bladeburner [#287][pr-287].

### Utilities

- Added `readLoop` helper and `sleep` wrappers to simplify async port polling [#160][pr-160].
- `boolFromString` allows boolean config values like `yes`/`on`/`1` [#166][pr-166].
- `growthAnalyze` helper exported for consistent growth calculations [#190][pr-190].
- `killEverywhere` command kills scripts across the network; `clear-port.js` clears all ports when none specified [#192][pr-192], [#191][pr-191].
- Backdoor helpers (`needsBackdoor`, `canInstallBackdoor`) and `shortestPath` utility added for automation scripts [#193][pr-193].
- `makeFuid` generates unique IDs for client requests and allocation tracking [#192][pr-192].
- `sendTerminalCommand`, `manualGrow`, and `manualWeaken` automate terminal interactions and wait for progress bars [#226][pr-226].
- Consolidated custom React hooks into `util/hooks.ts`, adding polling helpers for single-render components [#229][pr-229].
- Improved `config.ts` helper program: read and write configs with autocomplete and better output formatting [#241][pr-241];
- `sendTerminalCommand` now queues commands, verifies echoed output, and recognizes timed commands for more reliable terminal automation [#250][pr-250].
- Base client/server abstractions and protocol helpers simplify custom port services [#278][pr-278].
- `readLoop` uses unique at-exit handler IDs to prevent collisions between scripts [#278][pr-278].

### User interface

- Backdoor notifier rewritten as a React component with automatic tail management [#178][pr-178].
- Monitor HUD displays expected profit per second alongside expected value [#185][pr-185].
- Monitor HUD displays total hacking profit-per-second [#214][pr-214].
- Tail UIs like monitor, infiltration list, and backdoor notifier render once and poll for updates using hook utilities [#229][pr-229].

### Documentation and tests

- Memory management guide expanded with the new `FreeRam` structure and memory-aware calculations [#184][pr-184].
- Unit tests cover expected value calculations with limited memory [#184][pr-184].
- AGENTS guidelines clarified for PR reviewers [#189][pr-189].
- Utility tests relocated under `src/util/__tests__` with coverage for terminal progress bar detection [#226][pr-226].
- Updated memory management guide for claim-preserving deallocation and added tests for claim release and response-port timeouts [#260][pr-260].
- Pull-request review guidelines moved to `docs/pull-requests.md` and referenced from `AGENTS.md` [#273][pr-273].

### Exploits

- Add scripts for achieving all REDACTED exploits [#286][pr-286].

### Build Scripts

- Added a script to audit Netscript API RAM footprint (`npm run audit-ram`) [#230][pr-230].

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
[pr-213]: https://github.com/RadicalZephyr/bitburner-scripts/pull/213
[pr-214]: https://github.com/RadicalZephyr/bitburner-scripts/pull/214
[pr-218]: https://github.com/RadicalZephyr/bitburner-scripts/pull/218
[pr-221]: https://github.com/RadicalZephyr/bitburner-scripts/pull/221
[pr-223]: https://github.com/RadicalZephyr/bitburner-scripts/pull/223
[pr-226]: https://github.com/RadicalZephyr/bitburner-scripts/pull/226
[pr-227]: https://github.com/RadicalZephyr/bitburner-scripts/pull/227
[pr-229]: https://github.com/RadicalZephyr/bitburner-scripts/pull/229
[pr-230]: https://github.com/RadicalZephyr/bitburner-scripts/pull/230
[pr-240]: https://github.com/RadicalZephyr/bitburner-scripts/pull/240
[pr-241]: https://github.com/RadicalZephyr/bitburner-scripts/pull/241
[pr-245]: https://github.com/RadicalZephyr/bitburner-scripts/pull/245
[pr-246]: https://github.com/RadicalZephyr/bitburner-scripts/pull/246
[pr-250]: https://github.com/RadicalZephyr/bitburner-scripts/pull/250
[pr-255]: https://github.com/RadicalZephyr/bitburner-scripts/pull/255
[pr-257]: https://github.com/RadicalZephyr/bitburner-scripts/pull/257
[pr-260]: https://github.com/RadicalZephyr/bitburner-scripts/pull/260
[pr-264]: https://github.com/RadicalZephyr/bitburner-scripts/pull/264
[pr-266]: https://github.com/RadicalZephyr/bitburner-scripts/pull/266
[pr-267]: https://github.com/RadicalZephyr/bitburner-scripts/pull/267
[pr-268]: https://github.com/RadicalZephyr/bitburner-scripts/pull/268
[pr-270]: https://github.com/RadicalZephyr/bitburner-scripts/pull/270
[pr-273]: https://github.com/RadicalZephyr/bitburner-scripts/pull/273
[pr-276]: https://github.com/RadicalZephyr/bitburner-scripts/pull/276
[pr-278]: https://github.com/RadicalZephyr/bitburner-scripts/pull/278
[pr-285]: https://github.com/RadicalZephyr/bitburner-scripts/pull/285
[pr-286]: https://github.com/RadicalZephyr/bitburner-scripts/pull/286
[pr-287]: https://github.com/RadicalZephyr/bitburner-scripts/pull/287

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
