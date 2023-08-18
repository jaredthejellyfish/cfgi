import { Command } from "commander";

declare module "cfgi" {
  interface TaskConfig {
    silent?: boolean;
    exclude?: "live" | "sync" | "none";
  }

  type RunsReturn = {
    name: string;
    run: () => { output: string; silent: boolean; isError: boolean };
  };

  type RunOutput = {
    output: string;
    silent: boolean;
    isError: boolean;
  };

  type RunError = {
    name: string;
    output: string;
  };

  function task(
    name: string,
    setup: () => void,
    runs: RunsReturn[],
    config?: TaskConfig
  ): { passed: number; errors: number };
  function command(cmd: string, silent?: boolean): RunOutput;
  function commandLive(cmd: string, silent?: boolean): RunOutput;
  function runs(name: string, runFunction: () => void | RunOutput): RunsReturn;
  function generateNewConfig(
    configName: string,
    includeSample: boolean,
    includeOptions: boolean
  ): void;
}
