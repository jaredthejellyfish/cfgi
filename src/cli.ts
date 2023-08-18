#!/usr/bin/env node

import { Command } from "commander";
import { generateNewConfig } from "./utils/new-config.js";
import {
  findConfigFilesInDir,
  validateProvidedConfigName,
  generateIndividualTaskFile,
  parseConfig,
  selectTaskFromConfig,
  generateMultiTaskFile,
  runInVM,
} from "./utils/run-file.js";

import chalk from "chalk";
import { Node } from "@babel/types";

const program = new Command();

program
  .name("dir")
  .arguments("[name]")
  .option("-a, --all", "Run all tasks in the config file")
  .description("Describe, It Runs, a simple command executor")
  .version("0.0.0")
  .action(async (name, args) => {
    const sanitizedConfigName = await validateProvidedConfigName(name);
    const configName = sanitizedConfigName
      ? sanitizedConfigName
      : await findConfigFilesInDir();

    console.log(
      chalk.yellow(
        `ℹ Starting runner for config${name ? chalk.blue(" " + name) : ""}:\n`
      )
    );

    const { options, imports, tasks } = await parseConfig(configName);

    if (!tasks.length) {
      console.log(chalk.red("✖ No tasks found!"));
      process.exit(1);
    }

    const selectedTasks: { name: string; node: Node }[] =
      tasks.length > 1 && !args.all
        ? await selectTaskFromConfig(tasks)!
        : !args.all && tasks[0]
        ? [tasks[0]]
        : tasks;

    const taskCode =
      selectedTasks?.length > 1 || args.all
        ? generateMultiTaskFile(options, imports, selectedTasks)
        : generateIndividualTaskFile(options, imports, selectedTasks);

    runInVM(taskCode);
  });

program
  .command("new [name]")
  .option("-e, --example", "Add an example to the run file.")
  .option("-o, --options", "Add an options object to the run file")
  .option(
    "-eo, --example-options",
    "Add an example and options object to the generated run file."
  )
  .action((name, options) => {
    console.log(
      chalk.yellow(
        `ℹ Starting generator for config${
          name ? chalk.blue(" " + name) : ""
        }:\n`
      )
    );

    const includeOptions = options.options || options.exampleOptions || false;
    const includeSample = options.example || options.exampleOptions || false;

    generateNewConfig(name, includeOptions, includeSample);
  });

program.parse(process.argv);
