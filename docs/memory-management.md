## Module layout

The allocator service is now split into distinct modules:

- `allocator.ts` implements the `MemoryAllocator` class and related helper
  types. It manages the RAM accounting and exposes methods for allocation,
  claiming, releasing and garbage collection.
- `memory.tsx` contains the daemon that uses `MemoryAllocator` to
  respond to port requests. It also updates the UI and performs periodic
  cleanup.

This separation keeps the allocator logic testable while the daemon file
focuses on orchestration and rendering.

### Status structure

The allocator exposes a `Status` message so other scripts can see how
much memory is currently free. The response is now an object describing
both the total free RAM and how that memory is distributed across
workers:

```typescript
interface FreeChunk {
    hostname: string;
    freeRam: number;
}

interface FreeRam {
    freeRam: number;
    chunks: FreeChunk[];
}
```

`freeRam` is the total amount of memory available across all workers and
`chunks` lists the free RAM on each individual host. Consumers should
inspect the chunk list when deciding how many batches can actually fit
into memory.

### Claim retention and release

If the owner of an allocation deallocates it while other scripts have
claimed chunks, those claims remain in place and the allocation itself
is not removed. Scripts register a claim by starting with the
`--allocId` command-line option.

Example sequence:

1. Script **A** allocates memory and receives allocation ID `42`.
2. Script **A** starts script **B** with `--allocId 42` to claim a
   portion of that allocation.
3. Script **A** deallocates ID `42`; the claimed chunks stay reserved so
   **B** continues running.
4. Script **B** exits or releases its claim, allowing the allocator to
   finally free ID `42` and return the memory to the pool.

Only once all claims have been released does the allocator reclaim the
memory associated with the allocation.
