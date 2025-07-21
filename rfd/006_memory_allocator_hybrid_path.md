# RFD‑001: Memory Allocator Hybrid Path for Bitburner

**Authors:** Zefira Shannon (proposal), ChatGPT (editor)

**Status:** Draft

**Created:** 2025‑07‑14

---

## Summary

This Request for Discussion proposes a _hybrid_ strategy for keeping
the Bitburner **Memory Allocator** in sync with all RAM consumers on
worker hosts — including:

1. **Allocator‑aware** scripts started via the `launch` helper;

2. **Core infrastructure** that must start _before_ the allocator
   (Discovery and the allocator itself);

3. **Ad‑hoc / foreign** processes started manually by the player.

The design combines **explicit registration + PID tagging** for
allocator‑aware processes with a **smoothed reserved‑RAM measurement**
for everything else. The goal is to provide stable, conservative
free‑RAM estimates while keeping ergonomics acceptable for one‑off
testing.

---

## Motivation

- The allocator cannot track its own PID or Discovery’s PID at
  startup, creating blind spots.

- Players (or automation in other repos) periodically `run` scripts
  directly; the allocator must avoid clobbering this memory.

- The current _Δ‑based_ `reservedRam` heuristic is noisy: if a
  controller script allocates a large block for helpers **before**
  those helpers spawn, the allocator temporarily believes the host is
  full, hurting throughput.

- Full PID‑level accounting solves accuracy but is too heavy without
  cooperation from helper scripts.

A balanced solution should:

- Be _accurate enough_ to avoid clashes 99 % of the time.
- Add minimal overhead to hot paths.
- Require little friction for casual users.

---

## Requirements

| ID  | Requirement                                                                      | Priority     |
| --- | -------------------------------------------------------------------------------- | ------------ |
|  R1 | Must avoid launching a new script if free RAM would go < 0 GB at _runtime_.      | MUST         |
|  R2 | Must not misclassify Discovery or Allocator RAM after they start.                | MUST         |
|  R3 | Should reclaim memory within one polling interval after a foreign process exits. | SHOULD       |
|  R4 | Should impose ≤ O(#PIDs) operations per poll, with low constant factors.         | SHOULD       |
|  R5 | Should allow users to opt‑in extra processes easily.                             | NICE TO HAVE |
|  R6 | Should degrade gracefully if helper scripts forget to propagate tags.            | NICE TO HAVE |

---

## Proposal

### 1  Explicit self‑registration of core services

- Discovery and the allocator call `registerAllocation(hostname, pid,
ram)` once their PID is known.

- On clean shutdown they emit `unregister(pid)` (best‑effort;
  allocator also times‑out stale entries).

### 2  Allocator tag propagation

- `launch()` generates a **UUID** `allocId` and appends
  `--allocId=<uuid>` to the target script’s argv.

- Helper libraries expose `inheritAllocatorArgs(ns)`; task scripts
  must pass this when they `exec` children.

- The tag is _copy‑only_: no runtime IPC is required.

### 3  Host‑scan algorithm (every `T_poll`, default = 2 s)

```ts
const procs = ns.ps(host);
let allocRam = 0n;
let foreignRam = 0n;
for (const p of procs) {
  if (hasAllocTag(p)) allocRam += toFixed(p.ramUsage);
  else if (isRegistered(pid))
    allocRam += toFixed(p.ramUsage); // core services
  else foreignRam += toFixed(p.ramUsage);
}
```

### 4  Smoothed reserved‑RAM & safety margin

```ts
reservedEMA = α * reservedEMA + (1 – α) * foreignRam;  // α ≈ 0.7
const effectiveFree = maxRam – allocRam – reservedEMA – safetyMarginGB;
```

- `safetyMarginGB` defaults to **8 GB** or **10 %**, whichever is larger.
- Operators may tune `α` and the margin via `CONFIG`.

### 5  Convenience wrapper for human launches

Provide an alias:

```bash
alias aa="run /scripts/launch.js"
```

With identical CLI semantics, most ad‑hoc scripts now opt‑in automatically.

---

## Data structures & APIs

```ts
interface Registration {
  pid: number;
  ram: bigint;
  hostname: string;
  ts: number;
}

registerAllocation(host, pid, ram);
unregister(pid);

// in launch.ts
function makeAllocArgs(uuid: string, userArgs: ScriptArg[]): ScriptArg[];
```

Runtime state (per host):

| Field           | Type   | Meaning                             |
| --------------- | ------ | ----------------------------------- |
|  `allocatedRam` | bigint | Sum RAM of _known_ allocator PIDs.  |
|  `reservedEMA`  | bigint | Exponentially‑smoothed foreign RAM. |
|  `lastScan`     | ms     | Timestamp of last full PID scan.    |

---

## Drawbacks

- Requires every internal helper to propagate the tag → chance of
  human error.

- Polling loop still O(#PIDs); on very large botnets this could
  be \~1000 PIDs ↔ OK but non‑zero.

- False positives if an external script deliberately spoofs
  `--allocId` (mitigate by using 128‑bit UUIDs and optional checksum).

---

## Alternatives considered

1. **Pure PID accounting** — accurate but heavy; helper scripts
   uncooperative.

2. **Process‑group UUID via Port IPC** — stronger integrity but adds
   IPC on every helper spawn.

3. **Kernel‑like cgroups** (one exec spawns an entire VM) — outside
   Bitburner’s JS sandbox capabilities.

---

## Prior art and references

- Oxide Computer — _RFD 1_ style guide.

- Kubernetes — Pod UID tag + cAdvisor (reserved vs working
  set). \* AWS Lambda — Provisioned vs utilized memory model.

---

## Non‑Goals

- Designing a user‑facing dashboard (may follow in a separate RFD).
- Eliminating polling entirely.
- Supporting Bitburner versions prior to 2.8.

---

## Future work

1. **Metrics export** to In‑Game‑Graph for visualization.
2. **Dynamic safety‑margin back‑off** based on observed overcommit violations.
3. **Unit tests** using Netscript’s `mock‑ns` framework.

---

## Unresolved questions

- What is an acceptable upper bound on allocator CPU time per poll on
  low‑end servers?

- Should we age‑out _registered_ PIDs aggressively if a crash prevents
  unregister?

- How big must the default UUID be to make tag collisions effectively
  impossible?

- Are there scenarios where a static safety margin is insufficient?

---

## Appendix A — Implementation timeline

| Week | Milestone                                                   |
| ---- | ----------------------------------------------------------- |
|  1   | Register/unregister API + Discovery & Allocator integration |
|  2   | Tag generation & propagation in `launch` + helpers          |
|  3   | Host‑scan refactor, EMA & safety margin                     |
|  4   | CLI alias script & docs                                     |
|  5   | Load‑test, tune α and margin, write unit tests              |

---

## Changelog

- **2025‑07‑14** — initial draft.
