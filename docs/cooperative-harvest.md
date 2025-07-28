# Cooperative Harvest Scheduling

The batch hacking system relies on two scripts to decide **when** and **how** a server is harvested.
`task_selector.ts` picks the best targets and launches harvest tasks, while `harvest.ts`
uses the memory allocator to run the largest possible batches for that target.

## Task Selector

`TaskSelector` maintains queues of till, sow and harvest candidates. Each tick it
retrieves a snapshot of free RAM from the Memory Manager. Pending harvest targets
are evaluated with `expectedValueForMemory()`, which in turn uses
`maxHackPercentForMemory()` to determine the largest hack percent that still fits the
current memory distribution. Targets are sorted by this expected value and the most
profitable one is launched first. No new tasks are launched until the
most recently launched task reports it was able to successfully
allocate memory. Launching tasks may be deferred when recent attempts
failed or when the income new tasks would add is below a
user-configurable percentage of current income.

## Harvest Script

When spawned, `harvest.ts` again queries the Memory Manager through
`GrowableMemoryClient` to reserve enough RAM for a full cycle of batches. It calls
`maxHackPercentForMemory()` to choose a hack percent that allows the desired
number of overlapping batches (`overlapLimit`). The script spawns one batch per
allocated chunk to fill the pipeline and then continuously respawns new batches as
old ones finish. If security rises or money drops, a temporary rebalance batch is
calculated with `calculateRebalanceBatchLogistics()` so the pipeline stays within
the original batch size. The allocation is growable and shrinkable, letting the
harvester adapt as the Memory Manager grants or revokes chunks.

## Working Together

The Task Selector and harvest script cooperate via heartbeat messages. The
harvester periodically reports its status so the selector can track active profit
and retry failed targets. By selecting a hack percent that fits available memory
and maintaining a steady pipeline of overlapping batches, the harvester maximizes
cash throughput without exceeding RAM limits. The selector in turn prioritizes
servers whose expected profit is worthwhile compared to running harvests, ensuring
RAM is always directed to the most lucrative targets.
