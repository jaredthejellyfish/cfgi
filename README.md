# cfgi [![wakatime](https://wakatime.com/badge/github/jaredthejellyfish/cfgi.svg)](https://wakatime.com/badge/github/jaredthejellyfish/cfgi)

The `cfgi` project is a command runner which enables you to create tasks with synchronous or asynchronous commands, capturing their output live or in a silent mode.

## Installation

To use `cfgi`, you first need to install it. To install `cfgi` as a local dependency run:

```sh
$ npm install cfgi
```

## Usage

After you've installed `cfgi`, you can use it in your javascript code as follows:

```javascript
import { task, command, runs, commandLive } from "cfgi";

const options = { silent: false, exclude: "none" };

task(
  "My task",
  () => {}, // setup - executes before runs
  [
    runs("A passing command", () => {
      command("exit 0");
    }),

    runs("A failing command", () => {
      command("exit 1");
    }),
  ],
  options
);
```

This script will run a passing command and a failing command, printing both commands outputs to the console. If a command fails, the script will continue with the next command.

If you don't want to see the output of the commands, you can set `silent` parameter to `true`. If you want to exclude `live` or `sync` tasks, you can set `exclude` parameter to `"live"` or `"sync"`, respectively.

You can use `runs` to define a run within a task. A run must always have a return statement within its function body. If it does not have one it will be added automatically.

You can use `command` to execute a command synchronously using the specified command string.

You can use `commandLive` to execute a command synchronously and captures live output.

Finally `task` function represents a task with a setup function and a list of runs. The setup function is executed before runs

## Documentation

For detailed documentation, please visit the [cfgi jsdoc documentation](https://jaredthejellyfish.github.io/cfgi/). Here you will find comprehensive information about the API, including detailed descriptions of the `task`, `runs`, `command`, and `commandLive` functions, as well as the options object.

The documentation also includes examples of how to use the API, and explanations of the different options available for customizing the behavior of your tasks and commands.

If you have any questions or issues with the documentation, please open an issue on the [cfgi GitHub repository](https://github.com/jaredthejellyfish/cfgi/issues).

## Author & contributions

The `cfgi` project is developed by Gerard Hernandez. Contributions are welcome and greatly appreciated. Please fork the repository and create a pull request with your changes. Make sure to add tests for new features and bug fixes. If you have any questions, feel free to open an issue on the repository.

## License

This project is licensed under [MIT License](./LICENSE)
