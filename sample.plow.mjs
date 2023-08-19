import { task, command, runs, commandLive } from "./dist/utils/cfgi-runner.js";

const options = { silent: false, exclude: "none" };

task(
  "run",
  () => {},
  [
    runs("a run passing command", () => {
      command("exit 0");
    }),

    runs("a run failing command", () => {
      command("exit 1");
    }),
  ],
  options
);

task(
  "build",
  () => {},
  [
    runs("a build passing command", () => {
      command("exit 0");
    }),

    runs("a build failing command", () => {
      command("exit 1");
    }),
  ],
  options
);

task(
  "dev",
  () => {},
  [
    runs("a dev passing command", () => {
      command("exit 0");
    }),

    runs("a dev failing command", () => {
      command("exit 1");
    }),
  ],
  options
);
