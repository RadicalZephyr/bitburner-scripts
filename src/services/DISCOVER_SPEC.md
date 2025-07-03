## Project: Rework Discovery Daemon to have a Client API

### 1. Overview

Refactoring the discover service (`src/services/discover.ts`) to use
the standard Messaging protocol we've established. As exemplified by
the `MemoryClient` in `src/services/client/memory.ts`.

### 2 Architectural Components

#### 2.1 Discovery Client API (`src/services/client/discover.ts`)

1. Defines a port-based request/response protocol. Use a `MessageType`
   enum and typed payloads mirroring
   `src/services/client/memory.ts`. Supported messages should include
   `RequestWorkers` and `RequestTargets`.
2. Create a class (`DiscoveryClient`) to hide the details of the
   communication protocol.
3. Send requests to tracker daemon on a single well-known port `TRACKER_PORT`.
4. Multiplex responses to client on a single well-known `TRACKER_RESPONSE_PORT`.
