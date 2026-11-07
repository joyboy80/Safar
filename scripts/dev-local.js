import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("\x1b[1m\x1b[36m===================================================\x1b[0m");
console.log("\x1b[1m\x1b[36m🚀 Starting SAFAR Local Development Environment\x1b[0m");
console.log("   • Backend:  http://localhost:5000");
console.log("   • Frontend: http://localhost:5173");
console.log("\x1b[1m\x1b[36m===================================================\x1b[0m\n");

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

function startProcess(name, prefixColor, cwd, args) {
  const child = spawn(npmCmd, args, {
    cwd,
    stdio: ["inherit", "pipe", "pipe"],
    shell: isWindows,
    env: { ...process.env, FORCE_COLOR: "1" },
  });

  const prefix = `\x1b[1m${prefixColor}[${name}]\x1b[0m `;

  const pipeOutput = (stream) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep last incomplete line
      for (const line of lines) {
        if (line.trim().length) {
          console.log(`${prefix}${line}`);
        }
      }
    });
  };

  pipeOutput(child.stdout);
  pipeOutput(child.stderr);

  child.on("exit", (code, signal) => {
    if (signal !== "SIGINT" && signal !== "SIGTERM") {
      console.log(`${prefix}Process exited with code ${code ?? signal}`);
    }
  });

  return child;
}

const backendProcess = startProcess("backend", "\x1b[34m", path.join(rootDir, "backend"), ["run", "dev"]);
const frontendProcess = startProcess("frontend", "\x1b[32m", path.join(rootDir, "Frontend"), ["run", "dev"]);

function cleanup() {
  console.log("\n\x1b[33mShutting down Safar local servers...\x1b[0m");
  try {
    if (isWindows) {
      if (backendProcess.pid) spawn("taskkill", ["/pid", backendProcess.pid, "/f", "/t"]);
      if (frontendProcess.pid) spawn("taskkill", ["/pid", frontendProcess.pid, "/f", "/t"]);
    } else {
      backendProcess.kill("SIGINT");
      frontendProcess.kill("SIGINT");
    }
  } catch {}
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

