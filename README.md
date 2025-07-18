# Bitburner

Scripts and utilities for playing [Bitburner](https://bitburner-official.github.io/).

![A stylized digital illustration of a person in a dark hoodie sitting at a desk with multiple glowing green computer screens. The central screen displays code, while another shows a world map with data overlays. The atmosphere is dark and moody, evoking themes of hacking or cybersecurity.](images/hackers-whimsy.png?raw=true)

Most documentation lives in the [docs](./docs) directory. If you want
to contribute to their development you can check out the [contributing guide](docs/contributing.md).

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
