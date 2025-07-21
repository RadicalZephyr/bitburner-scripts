# Harvest Batch Timing

The harvest script schedules four phases so that each one ends `CONFIG.batchInterval` milliseconds after the previous. The diagram below illustrates the relative timing of these phases. Durations depend on the target server but the end times are evenly spaced.

```mermaid
gantt
title Harvest Batch Phases
dateFormat s
axisFormat %S s

section Batch0
Hack        :h0,  14, 19
Hack-Weaken :hw0,  0, 20
Grow        :g0,  5, 21
Grow-Weaken :gw0,  6, 22

section Batch1
Hack        :h1,  18, 23
Hack-Weaken :hw1,  4, 24
Grow        :g1,  9, 25
Grow-Weaken :gw1,  10, 26

section Batch2
Hack        :h2,  22, 27
Hack-Weaken :hw2,  8, 28
Grow        :g2,  13, 29
Grow-Weaken :gw2,  14, 30

section Batch3
Hack        :h3,  26, 31
Hack-Weaken :hw3,  12, 32
Grow        :g3,  17, 33
Grow-Weaken :gw3,  18, 34

section Batch4
Hack        :h4,  30, 35
Hack-Weaken :hw4,  16, 36
Grow        :g4,  21, 37
Grow-Weaken :gw4,  22, 38

section Batch5
Hack        :h5,  34, 39
Hack-Weaken :hw5,  20, 40
Grow        :g5,  25, 41
Grow-Weaken :gw5,  26, 42

section Batch6
Hack        :h6,  38, 43
Hack-Weaken :hw6,  24, 44
Grow        :g6,  29, 45
Grow-Weaken :gw6,  30, 46
```

Each phase runs on a worker host and writes a done message to a port when complete. The harvester waits for each phase to finish before launching the next batch.
