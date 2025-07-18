# Harvest Batch Timing

The harvest script schedules four phases so that each one ends `CONFIG.batchInterval` milliseconds after the previous.  The diagram below illustrates the relative timing of these phases.  Durations depend on the target server but the end times are evenly spaced.

```mermaid
gantt
title Harvest Batch Phases
dateFormat ms
axisFormat %S s

section Batch
Hack                 :hack, 0, HACK_TIME
Weaken after Hack    :w1, 0, WEAKEN_TIME
Grow                 :grow, after hack, GROW_TIME
Weaken after Grow    :w2, after grow, WEAKEN_TIME
```

Each phase runs on a worker host and writes a done message to a port when complete.  The harvester waits for each phase to finish before launching the next batch.
