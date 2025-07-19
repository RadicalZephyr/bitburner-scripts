# Service Bootstrapping

Startup begins with `src/start.ts`, which copies the main bootstrap
script to a remote host and launches it. `src/bootstrap.ts` then starts
all long‑running daemons in order. Services are launched locally using
`/services/bootstrap.ts`, while batch hacking scripts are launched via
`/batch/bootstrap.ts`.

The bootstrap scripts kill any previous instance of each service before
launching a fresh copy. Dependencies are uploaded automatically so each
host has the latest build artifacts. The memory and port allocation
services must start early because other scripts depend on them for
resources and communication.

This layered approach allows individual services to be restarted without
interrupting the rest of the system. It also makes development easier by
providing a single entry point that stands up the whole environment with
reasonable defaults.
