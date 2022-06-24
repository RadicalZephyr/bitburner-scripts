Since threads are totally fungible (except for when a host has
multiple cores), we can easily split up the needed threads across any
number of hosts.

This means that our pool of threads is one giant knapsack with an
integer number of slots, our targets are items that can fill this
knapsack, with an upper bound of the desired number of threads.

It's slightly unclear what to use for the value in this model.

It also would be ideal for the softening and building phases for the
desired number of threads to either be matched exactly or for the
threads spawned to be close to being an integer divisor of the total
number of threads desired. This would mean there would be an even
number of rounds needed.

---

An alternate strategy we could use is to try and minimize the amount
of time it takes to complete the phase.

Or, we could simply get the targets rolling in the order so that as
much hacking can start as soon as possible. That would mean
prioritizing shorter times on easier servers.

For this to really be meaningful though we would need to then actually
start the hacking on the faster servers, thus removing threads for
preparing the higher tier servers.
