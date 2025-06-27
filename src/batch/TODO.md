# Make Monitor sort by Actual Money per Second

# Make monitor server names clickable

Clicking the server name will open the tail window of the process
supervising the phase that server is in (i.e. till, sow or harvest)
using (`ns.ui.openTail`).

# Scale up batches sizes if ram is available

Change harvest to scale up batch sizes to hack up to 25% of a server's
money every batch.

# Create new `src/batch/discover.ts` to be persistent and walk network

Contrary to my previous belief, servers on the network can be hidden
from you and as you fulfill new criteria like getting more money,
going to different areas, or accomplishing other in-game tasks, new
servers will appear on the network. This calls for a change in
strategy that doesn't rely on walking the network once during startup
but having a persistent server process that periodically (once every
five seconds) re-scans the entire network.

* Remove `get-all-hosts.ts`
* New script is an infinitely looping process.
* Add periodic network walks
* Hosts can be in one of three phases
  - Discovered
  - ToCrack
  - Cracked (and sent to MemoryManager or TSM)
* Include launching new `discover` script in bootstrap
