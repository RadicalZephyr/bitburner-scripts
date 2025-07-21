## Configuration

The batch hacking system exposes several knobs under the `BATCH` config
namespace. New options include:

- `launchFailLimit` – number of consecutive failed launches allowed for
  a host before giving up.
- `launchFailBackoffMs` – base backoff used when retrying launches
  after failure. Each additional failure doubles the wait time.
  Failure counters reset once the target responds with a heartbeat,
  indicating the task fully started.
