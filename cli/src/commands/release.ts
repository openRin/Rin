import { $ } from "bun";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

const VALID_BUMPS = ["patch", "minor", "major"] as const;
type BumpType = (typeof VALID_BUMPS)[number];

type ReleaseOptions = {
  dryRun: boolean;
  skipGit: boolean;
  force: boolean;
};

type PackageJson = {
  version: string;
  [key: string]: unknown;
};

function isValidVersion(version: string) {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(version);
}

function bumpVersion(currentVersion: string, bumpType: BumpType) {
  const [major, minor, patch] = currentVersion.split(".").map(Number);
  if (bumpType === "major") return `${major + 1}.0.0`;
  if (bumpType === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function getNewVersion(currentVersion: string, versionArg: string) {
  if (VALID_BUMPS.includes(versionArg as BumpType)) {
    return bumpVersion(currentVersion, versionArg as BumpType);
  }
  if (isValidVersion(versionArg)) {
    return versionArg;
  }
  throw new Error(`Invalid version format: ${versionArg}`);
}

async function getCurrentVersion() {
  const packageJson = JSON.parse(await readFile("package.json", "utf-8")) as PackageJson;
  return packageJson.version;
}

async function updatePackageJson(version: string, dryRun: boolean) {
  const files = ["package.json", "client/package.json", "server/package.json", "cli/package.json"];
  for (const file of files) {
    if (!existsSync(file)) continue;
    const pkg = JSON.parse(await readFile(file, "utf-8")) as PackageJson;
    const oldVersion = pkg.version;
    pkg.version = version;
    if (dryRun) {
      console.log(`  📄 ${file}: ${oldVersion} -> ${version} (dry-run)`);
    } else {
      await writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`);
      console.log(`  ✅ ${file}: ${oldVersion} -> ${version}`);
    }
  }
}

async function checkGitStatus() {
  try {
    const status = await $`git status --porcelain`.quiet().text();
    const branch = await $`git branch --show-current`.quiet().text();
    return { clean: status.trim() === "", branch: branch.trim() };
  } catch {
    return { clean: false, branch: "unknown" };
  }
}

async function checkChangelog(version: string) {
  if (!existsSync("CHANGELOG.md")) return false;
  const changelog = await readFile("CHANGELOG.md", "utf-8");
  return changelog.includes(`## [v${version}]`) || changelog.includes(`## [${version}]`);
}

async function runPreReleaseChecks(version: string, options: ReleaseOptions) {
  const checks: boolean[] = [];
  const gitStatus = await checkGitStatus();
  checks.push(gitStatus.clean || options.force);
  checks.push(["main", "master"].includes(gitStatus.branch) || options.force);
  checks.push((await checkChangelog(version)) || options.force);

  try {
    await $`bun run check`.quiet();
    checks.push(true);
  } catch {
    checks.push(options.force);
  }

  try {
    await $`bun run build`.quiet();
    checks.push(true);
  } catch {
    checks.push(options.force);
  }

  return checks.every(Boolean);
}

async function updateChangelogLinks(version: string, dryRun: boolean) {
  if (!existsSync("CHANGELOG.md")) return;
  const content = await readFile("CHANGELOG.md", "utf-8");
  if (content.includes(`[v${version}]:`)) return;
  const next = `${content.trimEnd()}\n[v${version}]: https://github.com/openRin/Rin/releases/tag/v${version}\n`;
  if (!dryRun) {
    await writeFile("CHANGELOG.md", next);
  }
}

export async function runReleaseCommand(args: string[]) {
  const versionArg = args.find((arg) => !arg.startsWith("-"));
  if (!versionArg) {
    console.log(`Usage: rin release <version>\n  version: patch | minor | major | x.y.z`);
    return;
  }

  const options: ReleaseOptions = {
    dryRun: args.includes("--dry-run"),
    skipGit: args.includes("--skip-git"),
    force: args.includes("--force"),
  };

  const currentVersion = await getCurrentVersion();
  const version = getNewVersion(currentVersion, versionArg);
  const checksOk = await runPreReleaseChecks(version, options);
  if (!checksOk) {
    throw new Error("Pre-release checks failed");
  }

  await updatePackageJson(version, options.dryRun);
  await updateChangelogLinks(version, options.dryRun);

  if (!options.dryRun && !options.skipGit) {
    await $`git add package.json client/package.json server/package.json cli/package.json CHANGELOG.md`.quiet();
    await $`git commit -m ${`chore(release): v${version}`}`.quiet();
    await $`git tag ${`v${version}`}`.quiet();
  }

  console.log(`Release prepared: v${version}`);
}
