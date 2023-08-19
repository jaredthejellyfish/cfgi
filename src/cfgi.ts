import {
  task,
  command,
  runs,
  commandLive,
  TaskConfig,
} from "./utils/cfgi-runner.js";

/**
 * @fileOverview The entry point for the cfgi package. This file exports all the public functions and types for the package. It is the only one that should be imported from the package and also the only one that should be exported from the package's package.json file.
 * @author Gerard Hernandez
 *
 * @requires     {@link module:cfgi-runner~task | task}
 * @requires     {@link module:cfgi-runner~command | command}
 * @requires     {@link module:cfgi-runner~runs | runs}
 * @requires     {@link module:cfgi-runner~commandLive | commandLive}
 * @requires     {@link module:cfgi-runner~TaskConfig | TaskConfig}
 *
 * @exports task
 * @exports command
 * @exports runs
 * @exports commandLive
 * @exports TaskConfig
 *
 */

export { task, command, runs, commandLive, TaskConfig };
