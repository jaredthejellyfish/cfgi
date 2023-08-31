import * as fs from "fs/promises";
import * as path from "path";
import inquirer from "inquirer";
import { parse } from "@babel/parser";
import pkg from "@babel/generator";
import babel from "@babel/core";
import { createContext, Script } from "vm";
import chalk from "chalk";
import { task, command, runs, commandLive, TaskConfig } from "./cfgi-runner.js";
import { Node } from "@babel/types";

const generate = pkg.default;

/**
 * @fileOverview Manages the running of a configuration file.
 * @author Gerard Hernandez
 *
 * @module cfgi/cli
 *
 * @requires     {@link https://nodejs.org/api/fs.html | fs}
 * @requires     {@link https://www.npmjs.com/package/inquirer | inquirer}
 * @requires     {@link https://www.npmjs.com/package/@babel/parser | @babel/parser}
 * @requires     {@link https://www.npmjs.com/package/@babel/generator | @babel/generator}
 * @requires     {@link https://www.npmjs.com/package/@babel/core | @babel/core}
 * @requires     {@link https://www.npmjs.com/package/vm | vm}
 * @requires     {@link https://www.npmjs.com/package/chalk | chalk}
 *
 * @requires     {@link module:cfgi-runner~task | task}
 * @requires     {@link module:cfgi-runner~command | command}
 * @requires     {@link module:cfgi-runner~runs | runs}
 * @requires     {@link module:cfgi-runner~commandLive | commandLive}
 * @requires     {@link module:cfgi-runner~TaskConfig | TaskConfig}
 *
 */

const currentDirectory: string = process.cwd();

export async function findConfigFilesInDir(dir?: string): Promise<string[]> {
  const configPath = dir || process.cwd();

  const files = await fs.readdir(configPath);

  let cfgiDir = files.find((file) => file === "cfgi");

  let configFiles: string[] = [];

  if (cfgiDir) {
    const cfgiFiles = await fs.readdir(path.join(configPath, cfgiDir));
    configFiles = cfgiFiles
      .filter(
        (file) =>
          file.endsWith(".cfgi.js") ||
          file.endsWith(".cfgi.ts") ||
          file.endsWith(".mjs")
      )
      .map((file) => path.join(cfgiDir!, file)); // prepend the directory name
  } else {
    configFiles = files.filter(
      (file) =>
        file.endsWith(".cfgi.js") ||
        file.endsWith(".cfgi.ts") ||
        file.endsWith(".mjs")
    );
  }

  const availableFiles = configFiles.sort((a, b) => a.localeCompare(b));

  return availableFiles;
}

/**
 * Selects a configuration file from a directory.
 * @function
 * @async
 * @param {string[]} files - The configuration files in the directory.
 * @returns {Promise<string>} - The name of the selected configuration file.
 */
export async function selectConfigNameFromDir(
  files: string[]
): Promise<string> {
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
 * @function
 * @async
 * @param {string} name - The name of the configuration file.
 * @returns {Promise<string | undefined>} - The matched configuration file name.
 */
export async function validateProvidedConfigName(
  name?: string
): Promise<string | undefined> {
  if (!name) return;

  const files = await fs.readdir(currentDirectory);

  const configFiles = files.filter(
    (file) =>
      file.endsWith(".cfgi.js") ||
      file.endsWith(".cfgi.ts") ||
      file.endsWith(".mjs")
  );

  const matchedFile = configFiles.find((file) => file.includes(name));

  return matchedFile;
}

/**
 * Parses the configuration file.
 * @function
 * @async
 * @param {string} configFName - The name of the configuration file.
 * @returns {Promise<options:TaskConfig,imports:Array<string>,tasks:Array<{name:string,node:Node }>>} - The parsed configuration file.
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
 * @function
 * @async
 * @param {Array<{name: string, node: Node}>} tasks - The tasks in the configuration file.
 * @returns {Promise<Array<{name: string, node: Node}>>} - The selected tasks.
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
 * @function
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
 * @function
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
 * @function
 * @param {string} code - The code to run.
 * @returns {void}
 */
export function runInVM(code: string): void {
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
