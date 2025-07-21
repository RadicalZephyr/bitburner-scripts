# Memory Allocator

The memory allocator daemon is split between a UI layer
(`src/services/memory.tsx`) and the pure allocator logic
(`src/services/allocator.ts`). Worker scripts request RAM via the
`MEMORY_PORT` message channel. Requests specify a chunk size and
number of chunks so that allocations can be split across many hosts.

Allocations are tracked by id. Each spawned script claims a portion of
its allocation when it starts and releases those chunks as it
finishes. The allocator periodically reclaims memory from terminated
processes and updates reserved RAM totals using the Discovery service.

Launch helper functions in `src/services/launch.ts` integrate the
memory allocator with `run`, automatically requesting memory and
releasing it when the spawned script exits. Long‑running services keep
their allocation for the life of the process. This design keeps the
batch hacking system from overcommitting RAM and allows multiple
services to share the entire network of worker servers efficiently.
