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
  workspaces?: string[];
  [key: string]: unknown;
};

type CheckResult = {
  label: string;
  ok: boolean;
  detail?: string;
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
  try {
    const tag = (await $`git describe --tags --abbrev=0`.quiet().text()).trim();
    const tagVersion = tag.replace(/^v/, "");
    if (isValidVersion(tagVersion)) {
      return tagVersion;
    }
  } catch {
    // Fall back to package.json when tags are unavailable.
  }

  const packageJson = JSON.parse(await readFile("package.json", "utf-8")) as PackageJson;
  return packageJson.version;
}

async function getPackageJsonFiles() {
  const rootPackage = JSON.parse(await readFile("package.json", "utf-8")) as PackageJson;
  const files = new Set<string>(["package.json"]);

  for (const workspace of rootPackage.workspaces ?? []) {
    const pattern = workspace.endsWith("/") ? `${workspace}package.json` : `${workspace}/package.json`;
    const glob = new Bun.Glob(pattern);
    for await (const file of glob.scan(".")) {
      files.add(file);
    }
  }

  return [...files].sort();
}

async function updatePackageJson(version: string, dryRun: boolean) {
  const files = await getPackageJsonFiles();
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
  const checks: CheckResult[] = [];
  const gitStatus = await checkGitStatus();
  checks.push({
    label: "git working tree is clean",
    ok: gitStatus.clean || options.force,
    detail: gitStatus.clean ? undefined : "uncommitted changes detected",
  });
  checks.push({
    label: "current branch is releasable",
    ok: ["main", "master"].includes(gitStatus.branch) || options.force,
    detail: `current branch: ${gitStatus.branch}`,
  });
  checks.push({
    label: `CHANGELOG contains v${version}`,
    ok: (await checkChangelog(version)) || options.force,
    detail: "add a matching section to CHANGELOG.md before releasing",
  });

  try {
    await $`bun run check`.quiet();
    checks.push({ label: "typecheck passes", ok: true });
  } catch {
    checks.push({
      label: "typecheck passes",
      ok: options.force,
      detail: "bun run check failed",
    });
  }

  try {
    await $`bun run build`.quiet();
    checks.push({ label: "build passes", ok: true });
  } catch {
    checks.push({
      label: "build passes",
      ok: options.force,
      detail: "bun run build failed",
    });
  }

  return checks;
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
    console.log(
      "Usage: rin release <version>\n  version: patch | minor | major | x.y.z | x.y.z-beta.1",
    );
    return;
  }

  const options: ReleaseOptions = {
    dryRun: args.includes("--dry-run"),
    skipGit: args.includes("--skip-git"),
    force: args.includes("--force"),
  };

  const currentVersion = await getCurrentVersion();
  const version = getNewVersion(currentVersion, versionArg);
  const checkResults = await runPreReleaseChecks(version, options);
  const failedChecks = checkResults.filter((check) => !check.ok);
  if (failedChecks.length > 0) {
    console.error("Pre-release checks failed:");
    for (const check of failedChecks) {
      console.error(`- ${check.label}${check.detail ? ` (${check.detail})` : ""}`);
    }
    throw new Error("Pre-release checks failed");
  }

  await updatePackageJson(version, options.dryRun);
  await updateChangelogLinks(version, options.dryRun);

  if (!options.dryRun && !options.skipGit) {
    const packageJsonFiles = await getPackageJsonFiles();
    await $`git add ${packageJsonFiles} CHANGELOG.md`.quiet();
    await $`git commit -m ${`chore(release): v${version}`}`.quiet();
    await $`git tag ${`v${version}`}`.quiet();
  }

  console.log(`Release prepared: v${version}`);
}
