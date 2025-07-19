# Batch Hacking System

The batch hacking suite consists of several coordinated scripts that
prepare and harvest money from targets as efficiently as possible. The
`task_selector` (`src/batch/task_selector.ts`) decides which servers
to work on and launches the appropriate task script for each lifecycle
phase: tilling (`src/batch/till.ts`), sowing (`src/batch/sow.ts`) and
harvesting (`src/batch/harvest.ts`).

A lightweight monitor (`src/batch/monitor.tsx`) displays progress and
helps debug the running batches. Scripts rely on the memory allocator
to schedule their helper threads without exceeding available RAM. Each
task sends status updates so the selector can move targets through the
lifecycle smoothly.

The system separates the decision logic from the worker scripts so
that improvements to target selection or batch math can be made
without changing the basic helper scripts. By keeping each script
focused on a single responsibility the overall system remains
maintainable even as more servers and cores come online.
