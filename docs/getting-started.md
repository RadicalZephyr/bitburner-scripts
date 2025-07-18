# bitburner


## Getting Started

### Using in game

Run the following in a Bitburner terminal to get the latest release:

```
wget https://github.com/RadicalZephyr/bitburner-scripts/releases/download/latest/bootstrap.js bootstrap.js
run bootstrap.js
```

This bootstrap script downloads all released scripts to your home
server.

### Developing

1. Install dependencies with `npm install`
2. Use `npm run watch` to rebuild on changes
3. Run Bitburner and under Options > Remote API make sure `Hostname:
   localhost` and `Port: 12525` are set correctly.
4. Hit connect once the watch build finishes!

Now your scripts will be updated every time a change is detected.
