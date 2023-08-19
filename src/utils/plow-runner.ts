import { execSync, spawnSync, SpawnSyncOptions } from "child_process";
import chalk from "chalk";
import ora from "ora";

const pink = chalk.hex("#FFC0CB");

process.on("SIGINT", () => {
  console.log("");
});

export interface TaskConfig {
  silent?: boolean;
  exclude?: "live" | "sync" | "none";
}

type RunsReturn = {
  name: string;
  run: () => { output: string; silent: boolean; isError: boolean };
};

export type RunOutput = {
  output: string;
  silent: boolean;
  isError: boolean;
};

export type RunError = {
  name: string;
  output: string;
};

/**
 * Executes a command synchronously and captures live output.
 *
 * @param {string} cmd - The command to be executed.
 * @param {boolean} [silent=false] - If true, suppresses output; otherwise, displays live output.
 * @returns {RunOutput} A success message if the command is executed successfully, or nothing if there's an error.
 * @throws {Error} Throws an error if the command is not provided or not correctly formatted, or if an error occurs during execution.
 */
export function commandLive(cmd: string, silent = false): RunOutput {
  if (!cmd) {
    throw new Error("No command is provided.");
  }

  const parts = cmd.split(/\s/);
  const mainCmd = parts[0];
  const args = parts.slice(1);

  if (!mainCmd) {
    throw new Error("Command not correctly formatted.");
  }

  const options: SpawnSyncOptions = {
    stdio: silent ? "ignore" : "inherit",
  };

  const childProcess = spawnSync(mainCmd, args, options);

  if (childProcess.error) {
    throw childProcess.error;
  }

  if (childProcess.status === 0) {
    return { output: "Command exited successfully.", silent, isError: false };
  } else {
    return { output: "Command exited.", silent, isError: true };
  }
}

/**
 * Executes a command synchronously using the specified command string.
 *
 * @param {string} cmd - The command string to be executed.
 * @param {boolean} [silent=true] - Whether to suppress output.
 * @returns {RunOutput} An object containing information about the command execution.
 */
export function command(cmd: string, silent = true): RunOutput {
  try {
    const stdout: Buffer = execSync(cmd);
    const output: string = stdout.toString();
    return { output: output, silent, isError: false };
  } catch (error) {
    return { output: "", silent, isError: true };
  }
}

/**
 * Represents a run within a task.
 * A run must always have a return statement within its function body.
 * If it does not have one it will be added automatically.
 *
 * @param {string} name - The name of the run.
 * @param {() => void | RunOutput} runFunction - The function that defines the run's behavior.
 * @returns {RunsReturn} An object representing the run.
 */
export function runs(
  name: string,
  runFunction: () => void | RunOutput
): RunsReturn {
  let functionString = runFunction.toString();
  const commandRegex = /(command|commandLive)\((.*)\);/g;
  const returnRegex = /return\s+(command|commandLive)\((.*)\);/g;

  // check if there are any return statements in the function
  const returnMatches = functionString.match(returnRegex);
  if (returnMatches) {
    return {
      name: name,
      run: runFunction as RunsReturn["run"],
    };
  }

  // check if there are any command statements in the function
  const matches = functionString.match(commandRegex);
  if (!matches) {
    return {
      name: name,
      run: runFunction as RunsReturn["run"],
    };
  }

  // if there are command statements, find the last one
  const lastMatch = matches[matches.length - 1];
  if (!lastMatch)
    return {
      name: name,
      run: runFunction as RunsReturn["run"],
    };
  const lastMatchIndex = functionString.lastIndexOf(lastMatch);

  // replace the last command statement with a return statement
  functionString =
    functionString.substring(0, lastMatchIndex) +
    `return ${lastMatch}` +
    functionString.substring(lastMatchIndex + lastMatch.length);

  // return the new function
  return { name: name, run: eval(functionString) };
}

/**
 * Represents a task with a setup function and a list of runs.
 *
 * @param {string} name - The name of the task.
 * @param {() => void} setup - The setup function to be executed before runs.
 * @param {{ name: string; run: () => { output: string; silent: boolean; isError: boolean; }; }[]} runs - An array of runs, each containing a name and a run function.
 * @param {TaskConfig} [config] - An optional configuration object for the task.
 * @returns {{passed: number, errors: number}} - The number of passed and failed runs.
 */
export function task(
  name: string,
  setup: () => void,
  runs: RunsReturn[],
  config?: TaskConfig
): { passed: number; errors: number } {
  if (setup) setup();

  const startTime = new Date().getTime();

  const typedRuns = runs.map((r) => {
    return {
      name: r.name,
      run: r.run,
      type: r.run.toString().indexOf("commandLive") > -1 ? "live" : "sync",
      forcedSilent: config?.silent || false,
    };
  });

  const syncRuns = typedRuns.filter((r) => r.type === "sync");
  const liveRuns = typedRuns.filter((r) => r.type === "live");

  const { successful: successfulSync, errors: errosSync } = runSyncRuns(
    syncRuns,
    config?.exclude
  );

  const { successful: successfulLive, errors: errorsLive } = runLiveRuns(
    liveRuns,
    config?.exclude
  );

  const successful = successfulSync.concat(successfulLive);
  const errors = errosSync.concat(errorsLive);

  const endTime = new Date().getTime();

  cleanup(name, successful, errors, config?.silent, endTime - startTime);
  return { passed: successful.length, errors: errors.length };
}

function runSyncRuns(
  syncRuns: {
    name: string;
    run: () => RunOutput;
    forcedSilent: boolean;
    type: string;
  }[],
  exclude?: "live" | "sync" | "none"
): { successful: string[]; errors: RunError[] } {
  if (exclude && exclude === "sync") {
    console.log("");
    console.log(chalk.yellow(`ℹ Skipping sync tasks.`));
    console.log("");
    return { successful: [], errors: [] };
  }

  const successful: string[] = [];
  const errors: RunError[] = [];

  console.log(chalk.yellow(`ℹ Running regular tasks:\n`));
  syncRuns.forEach((r) => {
    const spinner = ora(`Running ${pink(command.name)}...`).start();
    const { output, silent, isError } = r.run();
    if (isError) {
      spinner.stopAndPersist({
        symbol: chalk.red("✖"),
        text: `Task ${pink(r.name)} failed.`,
      });
      errors.push({ name: r.name, output: output || "Unknown error" });
    } else {
      spinner.stopAndPersist({
        symbol: chalk.green("✔"),
        text: `Task ${pink(r.name)} ran successfully.`,
      });
      !silent &&
        !r.forcedSilent &&
        console.log(`  ${chalk.blue("└→")} ${output}`);
      successful.push(r.name);
    }
  });

  return { successful, errors };
}

function runLiveRuns(
  liveRuns: { name: string; run: () => RunOutput }[],
  exclude?: "live" | "sync" | "none"
): { successful: string[]; errors: RunError[] } {
  const successful: string[] = [];
  const errors: RunError[] = [];

  if (exclude && exclude === "live") {
    console.log("");
    console.log(chalk.yellow(`ℹ Skipping live tasks.`));
    console.log("");
    return { successful: [], errors: [] };
  }

  liveRuns.forEach((r) => {
    console.log(
      chalk.yellow(
        `\nℹ Running live command ${pink(r.name)} as a child process:\n`
      )
    );
    const { output, silent, isError } = r.run();
    if (isError) {
      console.log(chalk.red(`✖ Task ${pink(r.name)} failed.`));
      errors.push({ name: r.name, output: output || "Unknown error" });
      return;
    }
    if (!silent) {
      console.log(`  ${chalk.blue("└→")} ${output}`);
    }
    successful.push(r.name);
  });

  return { successful, errors };
}

function handleErrors(errors: RunError[]): void {
  console.log();
  console.log(chalk.red(`✖ ${errors.length} tasks failed ro run!`));
  errors.slice(0, -1).forEach((e) => {
    console.log(
      `  ${chalk.red("|→")} ${chalk.blue(e.name)} ${
        e.output && `${chalk.red("→")} ${e.output}`
      } `
    );
  });

  errors[0] &&
    console.log(
      `  ${chalk.red("└→")} ${chalk.blue(errors[0].name)} ${
        errors[0].output && `${chalk.red("→")} ${errors[0].output}`
      } `
    );
}

function cleanup(
  taskName: string,
  successful?: string[],
  errors?: RunError[],
  silent?: boolean,
  totalTime?: number
): void {
  if (!silent) {
    console.log(chalk.yellow(`\nℹ Summary:\n`));
    if (successful && successful.length > 0)
      console.log(
        chalk.green(`✔ ${successful.length} tasks ran successfully.`)
      );
    if (errors && errors.length > 0) handleErrors(errors);

    console.log("");
    console.log(
      chalk.yellow(
        `ℹ Completed task ${pink(taskName)} in ${totalTime! / 1000}s`
      )
    );
    return;
  } else {
    console.log("");
    console.log(
      chalk.yellow(
        `ℹ Completed task ${pink(taskName)} in ${totalTime! / 1000}s`
      )
    );
    console.log("");
  }
}

// console.log("");
// console.log(
//   chalk.bold(`${chalk.red("♥")} Thank you for using ${pink("lake")} :)`)
// );
// console.log("");
// console.log(pink("⏽ Author: @jaredthejellyfish"));
// console.log(pink("⏽ Github: https://github.com/jaredthejellyfish/lake"));
// console.log("");
