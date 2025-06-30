# Make Monitor output tables sortable by different columns

There's an issue with creating complex interactive React UIs using
`printRaw`. I think it's because in order to update the display we
need to call `printRaw` again, it re-renders everything. To get around
this, we need a way for the React elements to set state in the
Netscript program that will then be passed in to create the React tree
so the changes persist.

So, for instance to make sorting work we need to store how to sort the
table in a variable that lives inside the main loop scope, then just
change that variable from the React `onClick` handler.

# Make monitor server names clickable

Clicking the server name will open the tail window of the process
supervising the phase that server is in (i.e. till, sow or harvest)
using (`ns.ui.openTail`).

# Make batch daemon's more robust to restarts

They're very interconnected and currently it's basically impossible to
recover without re-running the bootstrap.

In principle however, the lost state can be restored by other running
programs.

For instance, if the till, sow and harvest scripts had a (ping,pong)
heartbeat check with the manager then they could repopulate the
manager with which stage they're in when the Manager daemon comes back
online and receives the heartbeats from
