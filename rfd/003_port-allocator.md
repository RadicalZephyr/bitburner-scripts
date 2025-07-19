# Port Allocator

`src/services/port.tsx` provides a simple daemon that manages dynamic
allocation of Netscript ports. Scripts send messages to
`PORT_ALLOCATOR_PORT` requesting an available port and receive the port
number back on `PORT_ALLOCATOR_RESPONSE_PORT`.

The allocator tracks which ports are currently in use and starts
handing out ids beginning at 101 to avoid conflicts with the
well-known port numbers statically assigned to the core services. When
a client is finished it sends a release message and the daemon clears
the port so that it can be reused.

The main service daemons are all unique programs and need to be
accessible to many other client programs so they use fixed port
numbers.

This small service allows scripts which may have multiple instances
(such as `batch/harvest.ts`) to make use of Netscript Ports without
being able to rely on single well-known port number. The port
allocator coordinates use of the shared port pool such that scripts
are guaranteed private use of their own port.
