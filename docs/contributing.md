# Contributing

## Prerequisites

This project requires Node.js 22 or newer. A version manager keeps the correct version isolated from your system installation.

Using nvm:

```
nvm install 22
nvm use 22
```

Using mise:

```
mise install node@22
mise use node@22
```

### Development Build

1. Install dependencies with `npm install`
2. Use `npm run watch` to rebuild on changes
3. Run Bitburner and under Options > Remote API make sure `Hostname:
localhost` and `Port: 12525` are set correctly.
4. Hit connect once the watch build finishes!

Now your scripts will be updated every time a change is detected.

## Release workflow

A GitHub Actions workflow automatically builds the TypeScript sources
whenever code is pushed to the `main` branch. The compiled scripts are
pushed to the `latest-files` branch along with a small `bootstrap.js`
loader. That branch is packaged into a release tagged `latest`.
