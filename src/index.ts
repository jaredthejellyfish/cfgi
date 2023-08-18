#!/usr/bin/env node

import { Command } from "commander";
import generateNewConfig from "./functions/new-config.js";
import chalk from "chalk";

const program = new Command();

program
  .name("dir")
  .option("-c, --cfg <path>", "Path to the config file to run.")
  .description("Describe, It Runs, a simple command executor")
  .version("0.0.0");

program
  .command("new [name]")
  .option("-e, --example", "Add an example to the run file.")
  .option("-o, --options", "Add an options object to the run file")
  .action((name, options) => {
    console.log(
      chalk.yellow(
        `ℹ Starting generator for config${
          name ? chalk.blue(" " + name) : ""
        }:\n`
      )
    );

    generateNewConfig(name, options.example || false, options.options || false);
  });

program.parse(process.argv);
