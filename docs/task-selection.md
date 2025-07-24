# Improving Task Selection

Currently, very naive simple greedy algorithm.

Obvious improvements available.

## Include server `growth` factor in expected value

I guess since we calculate the expected value by determining the batch
size this should come out in the calculation implicitly just by
calculating the grow threads we need.

## Low RAM

When RAM is low, prefer to use new RAM to grow existing tasks than
spawn new tasks. `GrowableAllocation` is a step in this direction
(perhaps all we need to do?).

### Memory aware expected value

`expectedValueForMemory` expands the plain expected value calculation by
taking the current free RAM snapshot as input. It chooses a hack
percentage that actually fits in memory and falls back to zero when no
batch can fit. The Task Selector uses this value to compare targets when
RAM is scarce.

### Improve `Allocator` feedback when allocation fails

Use allocation shrinking and retry strategies. Currently, if
`maxHackPercent` is too high, harvest tasks will fail in low RAM
conditions because the chunk size they request is too large for any
one machine.

The allocator should detect this and return an error saying
"`chunkSize` too large" so the task can try to shrink it's batch size.

## High RAM

- Task tracking so we can kill less valuable tasks using a lot of RAM

- Change `maxTillTargets`, `maxSowTargets` to RAM pool allocation.

- Control config variables like `maxHackPercent` from task selection
  script, based on current conditions.

- Knapsack heuristic solver for deciding on most valuable targets to
  use RAM on.

- Reserve RAM for tilling and sowing _all_ targets below harvest
  phase, assign the rest to harvesting.

### Harvest gain threshold

`harvestGainThreshold` controls when a new harvest is worthwhile. The task
selector skips any harvest whose expected profit is less than this fraction of
the combined profits from existing harvests. This avoids spending RAM on
nearly unprofitable harvests.
