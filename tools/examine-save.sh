#!/bin/sh

cat - | jq '.data.AllServersSave | fromjson | to_entries | map({ server: .key , scripts: .value.data.runningScripts | map(.data | {filename, args}) })' | bat
