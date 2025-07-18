# Batch System Overview

The batch hacking system is composed of a set of long running services and batch scripts.  The flowchart below shows how the main scripts are launched and how they communicate with each other.

```mermaid
flowchart TD
    Start[start.ts]
    Start --> Bootstrap[/bootstrap.ts/]

    Bootstrap --> ServiceBootstrap["services/bootstrap.ts"]
    Bootstrap --> BatchBootstrap["batch/bootstrap.ts"]

    ServiceBootstrap --> MemoryService["memory.tsx"]
    ServiceBootstrap --> DiscoverService["discover.ts"]
    ServiceBootstrap --> PortService["port.tsx"]

    BatchBootstrap --> TaskSelector["task_selector.ts"]
    BatchBootstrap --> Monitor["monitor.tsx"]

    TaskSelector <-->|MEMORY_PORT| MemoryService
    TaskSelector <-->|DISCOVERY_PORT| DiscoverService
    TaskSelector <-->|MONITOR_PORT| Monitor

    TaskSelector -->|launch| Till[till.ts]
    TaskSelector -->|launch| Sow[sow.ts]
    TaskSelector -->|launch| Harvest[harvest.ts]

    Till -->|spawn weaken| W1[w.js]
    Sow -->|spawn grow| G1[g.js]
    Sow -->|spawn weaken| W2[w.js]
    Harvest -->|spawn| Hack[h.js]
    Harvest -->|spawn| Grow[g.js]
    Harvest -->|spawn| Weaken[w.js]

    Hack --done--> Harvest
    Grow --done--> Harvest
    Weaken --done--> Harvest
    W1 --done--> Till
    G1 --done--> Sow
    W2 --done--> Sow
```

Scripts communicate over dedicated ports.  Memory allocations use `MEMORY_PORT`/`MEMORY_RESPONSE_PORT`, port requests use `PORT_ALLOCATOR_PORT`/`PORT_ALLOCATOR_RESPONSE_PORT` and task lifecycle updates flow through `TASK_SELECTOR_PORT` and `MONITOR_PORT`.
