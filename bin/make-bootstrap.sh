#!/usr/bin/env bash

set -e

FILES="$(find dist/ -type f -name '*.js' | cut -d '/' -f 2 | sed 's/\(.*\)/"\1",/')"

cat > dist/bootstrap.js <<BOOTSTRAP_HERE
/** @param {NS} ns */
export async function main(ns) {
  for (const file of files) {
    await ns.wget(baseUrl + file, file, "home");
  }
}

const baseUrl = "https://raw.githubusercontent.com/RadicalZephyr/bitburner-scripts/latest/";

const files = [
$FILES
""
];
BOOTSTRAP_HERE
