# Make Monitor sort by Actual Money per Second

# Make monitor server names clickable

Clicking the server name will open the tail window of the process
supervising the phase that server is in (i.e. till, sow or harvest)
using (`ns.ui.openTail`).

# Scale up batches sizes if ram is available

Change harvest to scale up batch sizes to hack up to 25% of a server's
money every batch.

# Make batch daemon's more robust to restarts

They're very interconnected and currently it's basically impossible to
recover without re-running the bootstrap.

In principle however, the lost state can be restored by other running
programs.

For instance, if the till, sow and harvest scripts had a (ping,pong)
heartbeat check with the manager then they could repopulate the
manager with which stage they're in when the Manager daemon comes back
online and receives the heartbeats from
