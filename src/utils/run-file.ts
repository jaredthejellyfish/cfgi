import * as fs from "fs/promises";
import inquirer from "inquirer";
import { task, command, runs, commandLive, TaskConfig } from "./plow-runner.js";
import { parse } from "@babel/parser";
import pkg from "@babel/generator";
import babel from "@babel/core";
import { Node } from "@babel/types";
import chalk from "chalk";

import { createContext, Script } from "vm";

const generate = pkg.default;

/**
 * Returns the current working directory.
 * @type {string}
 */
export const currentDirectory = process.cwd();

/**
 * Finds all the configuration files in a directory.
 * @param {string} dir - The directory to search in.
 * @returns {Promise<string>} - The name of the selected configuration file.
 */
export async function findConfigFilesInDir(dir?: string): Promise<string[]> {
  const configPath = dir || currentDirectory;

  const files = await fs.readdir(configPath);

  const configFiles = files.filter(
    (file) => file.endsWith(".plow.js") || file.endsWith(".plow.ts") || file.endsWith(".mjs")
  );

  const availableFiles = configFiles.sort((a, b) => a.localeCompare(b));

  return availableFiles;
}

export async function selectConfigNameFromDir(files: string[]): Promise<string> {
  const response = await inquirer.prompt({
    type: "list",
    name: "config",
    message: "Which config file would you like to run?",
    choices: files,
  });

  return response.config;
}

/**
 * Validates the provided configuration name.
 * @param {string} name - The name of the configuration file.
 * @returns {Promise<string | undefined>} - The matched configuration file name.
 */
export async function validateProvidedConfigName(
  name?: string
): Promise<string | undefined> {
  if (!name) return;

  const files = await fs.readdir(currentDirectory);

  const configFiles = files.filter(
    (file) => file.endsWith(".plow.js") || file.endsWith(".plow.ts") || file.endsWith(".mjs")
  );

  const matchedFile = configFiles.find((file) => file.includes(name));

  return matchedFile;
}

/**
 * Parses the configuration file.
 * @param {string} configFName - The name of the configuration file.
 * @returns {Promise<{options: TaskConfig, imports: string[], tasks: {name: string, node: Node}[]}>} - The parsed configuration file.
 */
export async function parseConfig(configFName: string): Promise<{
  options: TaskConfig;
  imports: string[];
  tasks: { name: string; node: Node }[];
}> {
  // read the contents of the config file as text
  const code = await fs.readFile(configFName, "utf-8");

  try {
    const ast = parse(code, {
      sourceType: "module",
      plugins: ["typescript"],
    });

    let options: TaskConfig = {};
    let imports: string[] = [];
    let tasks: { name: string; node: Node }[] = [];

    ast.program.body.forEach((node: Node) => {
      if (node.type === "ImportDeclaration") {
        const importString = generate(node).code;
        imports.push(importString);
      }
      if (node.type === "VariableDeclaration") {
        // @ts-ignore
        const declaredVariableName = node.declarations[0]?.id.name;

        if (declaredVariableName === "options")
          if (node.declarations[0]?.init) {
            const optionsObjString = generate(node.declarations[0]?.init).code;
            options = eval(`(${optionsObjString})`);
          }
      }
      if ((node.type = "ExpressionStatement")) {
        // @ts-expect-error
        if (node.expression && node.expression.callee.name) {
          // @ts-expect-error
          const taskName = node.expression.arguments[0].value;
          tasks.push({ name: taskName, node: node });
        }
      }
    });

    return { options, imports, tasks };
  } catch (e) {
    return { options: {}, imports: [], tasks: [] };
  }
}

/**
 * Selects a task from the configuration file.
 * @param {Array<{name: string, node: Node}>} tasks - The tasks in the configuration file.
 * @returns {Promise<{name: string, node: Node}[]>} - The selected tasks.
 */
export async function selectTaskFromConfig(
  tasks: { name: string; node: Node }[]
): Promise<{ name: string; node: Node }[]> {
  const taskNames = tasks.map((t) => t.name);

  const response = await inquirer.prompt({
    type: "list",
    name: "task",
    message: "Which task would you like to execute?",
    choices: taskNames.concat("all"),
  });

  if (response.task === "all") return tasks;

  return [tasks.find((t) => t.name === response.task)!];
}

/**
 * Generates an individual task file.
 * @param {TaskConfig} options - The task configuration options.
 * @param {string[]} imports - The imports in the configuration file.
 * @param {Array<{name: string, node: Node}>} tasks - The tasks in the configuration file.
 * @returns {string} - The generated task file.
 */
export function generateIndividualTaskFile(
  options: TaskConfig,
  imports: string[],
  tasks: { name: string; node: Node }[]
): string {
  const task = tasks[0]!;

  const generatedCode = `
  const options = ${JSON.stringify(options, null, 2)};

  ${generate(task.node).code};`;

  const transpiledCode = babel.transformSync(generatedCode, {
    presets: [
      [
        "@babel/preset-env",
        {
          targets: "> 0.25%, not dead", // Adjust this according to your needs
        },
      ],
    ],
  })!.code!;

  const ast = parse(transpiledCode, {
    sourceType: "module",
    plugins: ["typescript"],
  });

  const generated = generate(ast, { retainLines: true });

  return generated.code;
}

/**
 * Generates a multi-task file.
 * @param {TaskConfig} options - The task configuration options.
 * @param {string[]} imports - The imports in the configuration file.
 * @param {Array<{name: string, node: Node}>} tasks - The tasks in the configuration file.
 * @returns {string} - The generated multi-task file.
 */
export function generateMultiTaskFile(
  options: TaskConfig,
  imports: string[],
  tasks: { name: string; node: Node }[]
): string {
  const generatedCode = `
  const options = ${JSON.stringify(options, null, 2)};

  ${tasks.map((task) => generate(task.node).code).join("\n")};`;

  const transpiledCode = babel.transformSync(generatedCode, {
    presets: [
      [
        "@babel/preset-env",
        {
          targets: "> 0.25%, not dead", // Adjust this according to your needs
        },
      ],
    ],
  })!.code!;

  const ast = parse(transpiledCode, {
    sourceType: "module",
    plugins: ["typescript"],
  });

  const generated = generate(ast, { retainLines: true });

  return generated.code;
}

/**
 * Runs the provided code in a virtual machine.
 * @param {string} code - The code to run.
 */
export function runInVM(code: string) {
  console.log(chalk.yellow(`\nℹ Running task ${chalk.blue(task.name)}:\n`));

  const script = new Script(code);
  const context = createContext({
    task,
    command,
    runs,
    commandLive,
  });

  try {
    script.runInContext(context);
  } catch (e) {
    console.log(chalk.red("✖ Something went wrong!"));
    console.log(e);
  }
}
