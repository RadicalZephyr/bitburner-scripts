# Bitburner

Scripts and utilities for playing [Bitburner](https://bitburner-official.github.io/).

![A stylized digital illustration of a person in a dark hoodie sitting at a desk with multiple glowing green computer screens. The central screen displays code, while another shows a world map with data overlays. The atmosphere is dark and moody, evoking themes of hacking or cybersecurity.](images/hackers-whimsy.png?raw=true)

Most documentation lives in the [docs](./docs) directory. If you want
to contribute to their development you can check out the [contributing guide](docs/contributing.md).

### Development Requirements

Building these scripts locally requires Node.js 22 or newer. Use a Node version manager to install the correct version:

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

### One Time Set Up

To get the scripts the first time you need to run a couple commands by
copy and pasting these commands into the Bitburner terminal:

```bash
wget https://github.com/RadicalZephyr/bitburner-scripts/releases/download/latest/bootstrap.js external-bootstrap.js
run external-bootstrap.js
```

Once everything is downloaded, you can run the `start.js` script to
launch all of the services and start the batch hacking system.

```bash
run start.js
```

Personally I have this command aliased as just `start`:

```bash
alias start="run start.js"
```

If you want this script to run automatically when you open Bitburner
there is a setting in the "Options" menu, "Autoexec Script + Args",
just write in "start.js".

### Automatic Update

These scripts now come with an automatic updater service that runs
inside of Bitburner. It automatically checks for new releases of the
scripts and will prompt the user if they want the script to download
the new scripts.

This is a new experimental feature, if you run into problems while
using it feel free to open an issue and I'll do my best to help you
troubleshoot it.

### Manual Update

If you prefer to only update the releases manually you can disable the
automatic updater by just deleting the `VERSION.json` file on the
`home` server.

```bash
rm VERSION.json
```

You can then also store the original set up commands as aliases, by
running these commands in the Bitburner terminal:

```bash
alias get-external-bootstrap="wget https://github.com/RadicalZephyr/bitburner-scripts/releases/download/latest/bootstrap.js external-bootstrap.js"
alias external-bootstrap="run external-bootstrap.js"
```

Now you can just run these aliases from your Bitburner terminal
whenever you want to fetch a new release of these scripts:

```bash
get-external-bootstrap
external-bootstrap
```

### KataGo Integration

Some scripts in this repository rely on [KataGo][KataGo] to generate
Go moves. Download a [KataGo release][katago-release] for your system
and unpack it so the `katago` binary lives next to
`default_gtp.cfg` in this project. Download a KataGo trained
[network][katago-network] and unpack it to `default_model.bin.gz` next
to `default_gtp.cfg`.

Run the benchmark script to determine the correct `numSearchThreads`
to use on your system.

```bash
./katago benchmark
```

[KataGo]: https://github.com/lightvector/KataGo
[katago-release]: https://github.com/lightvector/KataGo/releases/
[katago-network]: https://katagotraining.org/networks/

Start the local HTTP proxy that communicates with KataGo:

```bash
npm run gtp-proxy
```

With the proxy running you can execute scripts such as `kataPlay.js`
from Bitburner (found under `dist/go` after building):

```bash
run dist/go/kataPlay.js
```

Leave the proxy running while interacting with these scripts so they
can send GTP commands to KataGo.
