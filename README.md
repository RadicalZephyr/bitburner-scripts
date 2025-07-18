# bitburner

Scripts and utilities for playing [Bitburner](https://danielyxie.github.io/bitburner/).

Most documentation lives in the [docs](./docs) directory. New users can start with [Getting Started](docs/getting-started.md).

## Release workflow

A GitHub Actions workflow automatically builds the TypeScript sources whenever code is pushed to the `main` branch. The compiled scripts are pushed to the `latest-files` branch along with a small `bootstrap.js` loader. That branch is packaged into a release tagged `latest`.

To download the published scripts directly from inside the game, use the following aliases from [`aliases.txt`](aliases.txt):

```bash
alias get-external-bootstrap="wget https://raw.githubusercontent.com/RadicalZephyr/bitburner-scripts/latest/bootstrap.js external-bootstrap.js"
alias external-bootstrap="run external-bootstrap.js"
```

Run `get-external-bootstrap` in a Bitburner terminal and then execute `external-bootstrap` to fetch all released scripts.
