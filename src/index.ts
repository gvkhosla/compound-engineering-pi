#!/usr/bin/env bun
import { defineCommand, runMain } from "citty"
import convert from "./commands/convert"
import install from "./commands/install"
import listCommand from "./commands/list"
import sync from "./commands/sync"

if (process.env.CE_PI_SUPPRESS_COMPAT_NOTICE !== "1") {
  console.error(
    "[compound-engineering-pi] CLI is maintained for compatibility. Prefer `bunx @every-env/compound-plugin ... --to pi` for converter behavior, and use this package primarily via `pi install npm:compound-engineering-pi`.",
  )
}

const main = defineCommand({
  meta: {
    name: "compound-plugin",
    version: "0.1.0",
    description: "Compatibility CLI for Pi packaging; prefer upstream compound-plugin for conversion logic",
  },
  subCommands: {
    convert: () => convert,
    install: () => install,
    list: () => listCommand,
    sync: () => sync,
  },
})

runMain(main)
