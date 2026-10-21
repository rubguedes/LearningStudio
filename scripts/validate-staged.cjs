// Alternativa para ambientes onde processos de build não podem gravar na
// pasta de origem. Copia fontes para TEMP e valida lá, sem modificar o projeto.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const readline = require("node:readline");

const source = path.resolve(__dirname, "..");
const staging = fs.mkdtempSync(
  path.join(os.tmpdir(), "learningstudio-validation-"),
);
const excluded = new Set([
  "node_modules",
  ".git",
  ".tools",
  "target",
  "dist",
  "test-results",
  "playwright-report",
]);
fs.cpSync(source, staging, {
  recursive: true,
  filter: (entry) => !excluded.has(path.basename(entry)),
});
console.log("VALIDATION_DIRECTORY=" + staging);
const npmCli = path.join(
  path.dirname(process.execPath),
  "node_modules",
  "npm",
  "bin",
  "npm-cli.js",
);
if (!fs.existsSync(npmCli))
  throw new Error(
    "npm não foi encontrado ao lado do Node. Execute as verificações diretamente em uma pasta gravável.",
  );
const environment = {
  ...process.env,
  npm_config_cache: path.join(staging, ".npm-cache"),
};
const chromiumRoot = path.join(
  os.homedir(),
  "AppData",
  "Local",
  "ms-playwright",
);
if (fs.existsSync(chromiumRoot)) {
  for (const entry of fs
    .readdirSync(chromiumRoot)
    .filter((name) => name.startsWith("chromium-"))
    .reverse()) {
    for (const suffix of ["chrome-win64/chrome.exe", "chrome-win/chrome.exe"]) {
      const executable = path.join(chromiumRoot, entry, suffix);
      if (fs.existsSync(executable))
        environment.PLAYWRIGHT_CHROMIUM_EXECUTABLE = executable;
    }
  }
}
let results = [];
function npm(args) {
  console.log("\nEXECUTING npm " + args.join(" "));
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd: staging,
    env: environment,
    stdio: "inherit",
    timeout: 600000,
  });
  const status = result.status ?? 1;
  results.push({
    command: "npm " + args.join(" "),
    exitCode: status,
    error: result.error?.message,
  });
  return status;
}
function validate() {
  results = [];
  fs.cpSync(source, staging, {
    recursive: true,
    filter: (entry) => !excluded.has(path.basename(entry)),
  });
  if (npm(["install", "--no-audit", "--no-fund"]) === 0) {
    npm(["run", "format"]);
    const checks = [
      ["run", "lint"],
      ["run", "typecheck"],
      ["test"],
      ["run", "build"],
      ["run", "test:native"],
    ];
    if (!process.argv.includes("--without-browser"))
      checks.push(["run", "test:e2e"]);
    else
      console.log("BROWSER_TESTS_OMITTED: esta rodada não executa Playwright.");
    for (const args of checks) npm(args);
  }
  fs.writeFileSync(
    path.join(staging, "validation-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log("\nVALIDATION_RESULTS=" + JSON.stringify(results));
  console.log("VALIDATION_DIRECTORY=" + staging);
  process.exitCode = results.some((result) => result.exitCode !== 0) ? 1 : 0;
}
validate();
if (process.argv.includes("--interactive")) {
  console.log(
    "READY: validate para reler as fontes e testar; exit para encerrar.",
  );
  readline.createInterface({ input: process.stdin }).on("line", (line) => {
    if (line.trim() === "validate") {
      validate();
      console.log("READY");
    }
    if (line.trim() === "exit") process.exit(process.exitCode || 0);
  });
}
