import inquirer from "inquirer";
import fs from "fs";
import chalk from "chalk";

const configRunsTemplate = `runs(\"a passing command\", () => {
      command(\"exit 0\");
    }),

    runs(\"a failing command\", () => {
      command(\"exit 1\");
    }),`;

const configOptionsTemplate = `
const options = { silent: false, exclude: "none" };
`;

const configTemplate = (
  name: string,
  includeSample: boolean,
  includeOptions: boolean
) => `import {
  task,
  command,
  runs,
  commandLive,
} from "./dist/functions/cfgi-runner.js";
${includeOptions ? configOptionsTemplate : ""}
task(
  "${name}",
  () => {},
  [
    ${includeSample ? configRunsTemplate : "// Commands go here..."}
  ],
  options
);
`;

/**
 * Generates a new configuration file asynchronously.
 *
 * @param {string} [configName] - The name for the new configuration. If not provided, the user will be prompted for input.
 * @returns {Promise<string>} The name of the generated configuration file.
 */
export default async function generateNewConfig(
  configName: string,
  includeSample: boolean = false,
  includeOptions: boolean = false
) {
  /**
   * If configName is not provided, prompt the user for input.
   * @type {string}
   */
  const configNamePrompted =
    configName ||
    (await inquirer
      .prompt({
        type: "input",
        name: "configName",
        message: "What is the name of the config?",
      })
      .then((answers) => {
        console.log("");
        return answers["configName"];
      }));

  if (includeSample)
    console.log(
      `${chalk.green("✔")} Generated sample tests for ${chalk.blue(
        configNamePrompted
      )}.`
    );

  if (includeOptions)
    console.log(
      `${chalk.green("✔")} Generated options object for ${chalk.blue(
        configNamePrompted
      )}.\n`
    );


  /**
   * The filename for the generated configuration file.
   * @type {string}
   */
  const configFileName =
    configNamePrompted.replace(/ /g, "-").toLowerCase() + ".cfgi.js";

  // Current working directory
  const cwd = process.cwd();

  // Create the config file
  fs.writeFileSync(
    `${cwd}/${configFileName}`,
    configTemplate(configNamePrompted, includeSample, includeOptions)
  );

  console.log(
    chalk.yellow(
      `ℹ Generator created config file ${chalk.blue(
        configFileName
      )} in ${chalk.blue(cwd)}.\n`
    )
  );

  return configFileName;
}
