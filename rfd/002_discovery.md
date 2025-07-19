# Discovery Service

The discovery daemon (`src/services/discover.ts`) walks the network to
find every host and attempts to crack new servers as soon as we have
access to the required port openers. Every host is classified as a
**worker** if it has RAM and a **target** if it holds money. Scripts can
subscribe on the discovery ports to be notified when new workers or
targets appear.

The service stores two subscription lists (one for workers and one for
targets) and sends batched updates when it sees new servers. Failed
notifications are retried a configurable number of times. Clients can
also query the discovery service at any time to get the current list of
known hosts.

Network scans run periodically using a breadth‐first search. Once a host
is cracked the service keeps it in a set so that it does not waste time
on servers already processed. This ensures we steadily expand our
network footprint as soon as new port crackers are purchased.
