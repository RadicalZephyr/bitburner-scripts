# bitburner

Awesome scripts for Bitburner

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

# Interesting things to remember

- Nuking a server only requires being able to open enough ports. Hacking
  level doesn't matter.
- Once a server has been nuked it can be used to run scripts.
- Growing and weakening a server also aren't limited by the hacking
  level, so servers can be prepared for hacking (min security, max
  money) before you're able to hack them.
- Hacking, and growing are done on a percentage basis. So to get
  maximum cashflow from a server it's best to hack it often at fairly
  low thread counts, so the change isn't too large.
- Weakening is fixed at 0.05 per thread.
- The amount that a server grows is _heavily_ dependent on the thread
  count of one particular instance of the grow script! This means that
  if you calculate 100 threads will grow to max, and you split those
  100 threads across different servers, even 50/50 you will not grow
  to 100%!!!!
