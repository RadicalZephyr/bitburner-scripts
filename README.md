# Bitburner

Scripts and utilities for playing [Bitburner](https://bitburner-official.github.io/).

![A stylized digital illustration of a person in a dark hoodie sitting at a desk with multiple glowing green computer screens. The central screen displays code, while another shows a world map with data overlays. The atmosphere is dark and moody, evoking themes of hacking or cybersecurity.](../images/hackers-whimsy.png?raw=true)

Most documentation lives in the [docs](./docs) directory. New users can start with [Getting Started](docs/getting-started.md).

## Release workflow

A GitHub Actions workflow automatically builds the TypeScript sources whenever code is pushed to the `main` branch. The compiled scripts are pushed to the `latest-files` branch along with a small `bootstrap.js` loader. That branch is packaged into a release tagged `latest`.

To download the published scripts directly from inside the game just
run these commands in the Bitburner terminal:

```bash
wget https://raw.githubusercontent.com/RadicalZephyr/bitburner-scripts/latest/bootstrap.js external-bootstrap.js
run external-bootstrap.js
```

If you want to regularly get the newest releases, you can set up these
commands as aliases, by running these commands in the Bitburner terminal:

```bash
alias get-external-bootstrap="wget https://raw.githubusercontent.com/RadicalZephyr/bitburner-scripts/latest/bootstrap.js external-bootstrap.js"
alias external-bootstrap="run external-bootstrap.js"
```

Now you can just run these commands from your Bitburner terminal
whenever you want to fetch a new release of these scripts:

```bash
get-external-bootstrap
external-bootstrap
```
