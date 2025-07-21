# Contributor Guide

## Development Instructions

 * Any function that calculates a number of threads to run must always
   return an integer value.
 * Grow and weaken thread calculations should always be rounded up
   with `Math.ceil`.


## Glossary

These are important terms used to describe the code in this directory.

### Batch Hacking Systems

The collective term for the scripts in this `src/batch/` directory.


### Hacking Lifecycle

The hacking lifecycle phases are used to succinctly indicate the state
of a target in relation to it's preparation for hacking. To avoid
having overlapping names with the individual helper scripts and to
emphasize that most phases require using more than one helper script
we use a farming metaphor to name the phases. There are three major
hacking lifecycle phases: tilling, sowing and harvesting.

#### Till Phase

The first phase is the tilling phase. A target must be tilled when
it's current security (`ns.getServerSecurityLevel(target)`) is
significantly higher than it's minimum possible security value
(`ns.getServerMinSecurity(target)`), regardless of it's current
money.

The Till Task script continually spawns rounds of weaken helper
scripts to until the targets security value has been reduced to it's
minimum value.

#### Sow Phase

Once a target has been tilled and it's security has been reduced to
it's minimum the target can be transitioned to the sowing phase if
it's current money available (`ns.getServerMoneyAvailable(target)`) is
significantly lower than the maximum money the server can possibly
have (`ns.getServerMaxMoney(target)`).

The Sow Task script continually spawns rounds of grow and weaken
helper scripts to grow the targets available money towards maximum
while keeping it's security at a minimal level.

#### Harvest

A target is only ready to begin harvesting once the server is at
maximum money and minimum security. From there the harvest script
calculates batches of hack, grow and weaken scripts so that running
the entire batch of scripts will steal money from the server while
returning it to the optimal state of max money and minimum security.


### Task Selector (`src/batch/task_selector.ts`)

The `TaskSelector` is responsible for identifying which lifecycle
phase each target is in, determining which targets are the highest
priority to move through the hacking lifecycle, and launching the
appropriate task script to do so.


### Task Scripts

There are three task scripts that correspond to the three major

Files:
 - Till Task script: `src/batch/till.ts`
 - Sow Task script: `src/batch/sow.ts`
 - Harvest Task script: `src/batch/harvest.ts`


#### Task Helper Scripts

The very simple worker scripts that actually run specific operations
against a target.

Files:
 - hack helper script: `src/batch/h.ts`
 - grow helper script: `src/batch/g.ts`
 - weaken helper script: `src/batch/w.ts`


### Monitor (`src/batch/monitor.ts`)

The monitor script helps the user get visual insight into the state of
the batch hacking system and provides helpful UI features to make it
easier to debug the system.


### MemoryAllocator (`src/services/memory.tsx`)

The memory allocator is a service daemon that keeps track of how much
RAM on each server has been claimed by various scripts so we can avoid
scripts failing because they tried to `ns.exec` a script on a host
with not enough memory. The batch hacking system makes extensive use
of the memory allocator to run it's various scripts.

### Additional Documentation

The batch system is further described in two markdown documents in the
`docs/` folder:

- [`docs/batch-system-diagram.md`](../../docs/batch-system-diagram.md)
  contains a flowchart showing how the batch scripts and supporting
  services communicate.
- [`docs/memory-management.md`](../../docs/memory-management.md)
  discusses the design of the memory allocator and approaches for
  releasing RAM. Both are useful background when modifying the batch
  scripts or the memory services they rely on.
