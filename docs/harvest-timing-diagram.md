# Harvest Batch Timing

The harvest script schedules four phases so that each one ends `CONFIG.batchInterval` milliseconds after the previous.  The diagram below illustrates the relative timing of these phases.  Durations depend on the target server but the end times are evenly spaced.

```mermaid
gantt
title Harvest Batch Phases
dateFormat s
axisFormat %S s

section Batch
Hack                 :hack, 14, 19
Weaken after Hack    :w1, 1, 20
Grow                 :grow, 5, 21
Weaken after Grow    :w2, 3, 22
```

Each phase runs on a worker host and writes a done message to a port when complete.  The harvester waits for each phase to finish before launching the next batch.
