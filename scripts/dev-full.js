import { spawn } from "node:child_process";

const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

const run = (scriptName) =>
  spawn(npmCmd, ["run", scriptName], {
    stdio: "inherit",
    shell: isWin
  });

const frontend = run("dev");
const backend = run("dev:server");

const shutdown = () => {
  frontend.kill();
  backend.kill();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

frontend.on("exit", (code) => {
  if (code && code !== 0) {
    backend.kill();
    process.exit(code);
  }
});

backend.on("exit", (code) => {
  if (code && code !== 0) {
    frontend.kill();
    process.exit(code);
  }
});
