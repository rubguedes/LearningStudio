// Usa a toolchain local quando disponível, sem alterar o PATH do Windows.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

if (process.platform !== "win32") {
  console.error("LearningStudio suporta exclusivamente Windows.");
  process.exit(1);
}
const root = path.resolve(__dirname, "..");
const localCargo = path.join(root, ".tools", "cargo");
const environment = { ...process.env };
function setEnvironment(name, value) {
  for (const key of Object.keys(environment)) {
    if (key.toLowerCase() === name.toLowerCase()) delete environment[key];
  }
  environment[name] = value;
}
if (fs.existsSync(path.join(localCargo, "bin", "cargo.exe"))) {
  setEnvironment("CARGO_HOME", localCargo);
  setEnvironment("RUSTUP_HOME", path.join(root, ".tools", "rustup"));
  setEnvironment(
    "PATH",
    path.join(localCargo, "bin") + path.delimiter + (process.env.PATH || ""),
  );
}
// Carrega INCLUDE/LIB/PATH somente no processo de compilação. A instalação
// dos Build Tools não adiciona link.exe ao PATH global do usuário.
const vswhere = path.join(
  environment["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
  "Microsoft Visual Studio",
  "Installer",
  "vswhere.exe",
);
if (fs.existsSync(vswhere)) {
  const installation = spawnSync(
    vswhere,
    [
      "-latest",
      "-products",
      "*",
      "-requires",
      "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
      "-property",
      "installationPath",
    ],
    { encoding: "utf8", env: environment },
  );
  const directory = installation.stdout?.trim();
  if (installation.status === 0 && directory && !/["\r\n]/.test(directory)) {
    const developerShell = path.join(
      directory,
      "Common7",
      "Tools",
      "VsDevCmd.bat",
    );
    if (fs.existsSync(developerShell)) {
      const command = `""${developerShell}" -no_logo -arch=x64 -host_arch=x64 && set"`;
      const result = spawnSync(
        environment.ComSpec || "cmd.exe",
        ["/d", "/s", "/c", command],
        {
          encoding: "utf8",
          env: environment,
          windowsVerbatimArguments: true,
          cwd: root,
        },
      );
      if (result.status !== 0) {
        console.error(
          "Não foi possível carregar o ambiente C++ instalado. Abra um terminal de desenvolvimento x64 do Visual Studio para executar o build.",
        );
        process.exit(1);
      }
      for (const line of result.stdout.split(/\r?\n/)) {
        const separator = line.indexOf("=");
        if (separator > 0)
          setEnvironment(line.slice(0, separator), line.slice(separator + 1));
      }
    }
  }
}
const action = process.argv[2];
const cargoActions = {
  test: ["test", "--locked", "--manifest-path", "src-tauri/Cargo.toml"],
  fmt: ["fmt", "--manifest-path", "src-tauri/Cargo.toml", "--", "--check"],
  clippy: [
    "clippy",
    "--locked",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "--all-targets",
    "--",
    "-D",
    "warnings",
  ],
};
let executable, args;
if (Object.hasOwn(cargoActions, action)) {
  executable = fs.existsSync(path.join(localCargo, "bin", "cargo.exe"))
    ? path.join(localCargo, "bin", "cargo.exe")
    : "cargo";
  args = cargoActions[action];
} else {
  const tauriActions = {
    desktop: ["dev"],
    package: ["build", "--bundles", "nsis"],
    tauri: process.argv.slice(3),
  };
  if (!Object.hasOwn(tauriActions, action)) {
    console.error("Ação nativa inválida.");
    process.exit(1);
  }
  executable = process.execPath;
  args = [
    path.join(root, "node_modules", "@tauri-apps", "cli", "tauri.js"),
    ...tauriActions[action],
  ];
}
const result = spawnSync(executable, args, {
  cwd: root,
  env: environment,
  stdio: "inherit",
});
if (result.error)
  console.error(
    "Não foi possível iniciar a ferramenta nativa. Execute npm run check:windows para conferir os pré-requisitos.",
  );
process.exitCode = result.status ?? 1;
