# Thoughts on current memory management

Currently, the logic of which chunks to release is handled by the
MemoryManager. This is preferable because that component has a broader
view of the total allocations and can strategize about what to
release.

The problem is that this means the harvest script just has to deal
with whichever chunks were released. Since we are trying to keep the
memory we have allocated essentially full at all times, there's only
ever chunk that is ready to be released: the one which is about to be
freed by the scripts running in it ending.

This means we have two obvious ways to move forward.

1 ) Change `releaseChunks` API so that the client gets to decide which
chunks to release.

This would be simpler and in the simplest implementation the harvester
can wait for the next scripts to end, release that chunk, and then
wait to spawn the next batch until the following batch ends.

1a) Client tries to be smart about releasing chunks

There is a third path, where the harvester could try and optimize
which memory it frees. The most obvious way it could do this is by
trying to completely remove a host from it's allocation (i.e. always
choose to release chunks from the host that has the fewest).

The downside of this is that the harvesters don't have a good picture
of the full memory picture and thus can't optimize overall memory use
effectively.


2) The `releaseChunks` API could be made more complex to involve a
back-and-forth between the memory client.

This would probably look something like

* client notifys that it can give up N chunks.
* server sends back which N chunks it would prefer to get back
* client waits until those chunks are actually free, tells server that
  the free is complete.

This approach is so complex that it would make correctly using this
API quite unlikely which is probably worse than just not freeing
memory.

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
