#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const printUsage = () => {
  console.log(
    [
      "Usage:",
      "  pnpm tweakcn:import --name <theme-name> --in <path|-> [--force]",
      "  pnpm tweakcn:import <url-or-path> [--name <theme-name>] [--force]",
      "  pnpm tweakcn:import --url <theme-url> [--name <theme-name>] [--force]",
      "",
      "Options:",
      "  --name, -n   Theme name (used for file names and UI label)",
      "  --in, -i     Input CSS file path (use '-' to read from stdin)",
      "  --url, -u    Theme JSON URL (TweakCN/shadcn registry)",
      "  --json       Force JSON parsing for input",
      "  --css        Force CSS parsing for input",
      "  --force, -f  Overwrite existing files",
    ].join("\n"),
  );
};

const args = process.argv.slice(2);
const options = {
  name: "",
  input: "",
  format: "",
  force: false,
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--name" || arg === "-n") {
    options.name = args[i + 1] ?? "";
    i += 1;
    continue;
  }
  if (arg === "--in" || arg === "-i") {
    options.input = args[i + 1] ?? "";
    i += 1;
    continue;
  }
  if (arg === "--url" || arg === "-u") {
    options.input = args[i + 1] ?? "";
    i += 1;
    continue;
  }
  if (arg === "--json") {
    options.format = "json";
    continue;
  }
  if (arg === "--css") {
    options.format = "css";
    continue;
  }
  if (arg === "--force" || arg === "-f") {
    options.force = true;
    continue;
  }
  if (arg === "--help" || arg === "-h") {
    printUsage();
    process.exit(0);
  }
  if (!arg.startsWith("-") && !options.input) {
    options.input = arg;
  }
}

const slugify = (value) => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const readStdin = async () => {
  if (process.stdin.isTTY) {
    return "";
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const looksLikeUrl = (value) => {
  return /^https?:\/\//i.test(value);
};

const readInput = async () => {
  if (!options.input || options.input === "-") {
    return readStdin();
  }
  if (looksLikeUrl(options.input)) {
    const response = await fetch(options.input);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${options.input}: ${response.status} ${response.statusText}`,
      );
    }
    return response.text();
  }
  return fs.readFile(path.resolve(process.cwd(), options.input), "utf8");
};

const extractBlock = (css, selectors) => {
  for (const selector of selectors) {
    const startIndex = css.indexOf(selector);
    if (startIndex === -1) {
      continue;
    }
    const braceStart = css.indexOf("{", startIndex + selector.length);
    if (braceStart === -1) {
      continue;
    }
    let depth = 0;
    for (let i = braceStart; i < css.length; i += 1) {
      const char = css[i];
      if (char === "{") {
        depth += 1;
        continue;
      }
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          return css.slice(braceStart + 1, i);
        }
      }
    }
  }
  return null;
};

const formatRootBlock = (content) => {
  const lines = content
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return "";
  }
  return `:root {\n  ${lines.join("\n  ")}\n}\n`;
};

const isPlainObject = (value) => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const isStringMap = (value) => {
  return isPlainObject(value) &&
    Object.values(value).every((entry) => typeof entry === "string");
};

const looksLikeCssVars = (value) => {
  if (!isStringMap(value)) {
    return false;
  }
  return Object.keys(value).some((key) =>
    key.startsWith("--") ||
    ["background", "foreground", "primary", "secondary", "border", "ring"]
      .includes(key)
  );
};

const normalizeCssVars = (value) => {
  if (!isPlainObject(value)) {
    return null;
  }
  if (looksLikeCssVars(value)) {
    return { light: value, dark: null };
  }
  const light = value.light;
  const dark = value.dark;
  if (looksLikeCssVars(light) || looksLikeCssVars(dark)) {
    return {
      light: looksLikeCssVars(light) ? light : null,
      dark: looksLikeCssVars(dark) ? dark : null,
    };
  }
  return null;
};

const findCssVars = (value) => {
  const directCandidates = [
    value?.cssVars,
    value?.tailwind?.cssVars,
    value?.theme?.cssVars,
    value?.data?.cssVars,
  ];
  for (const candidate of directCandidates) {
    const normalized = normalizeCssVars(candidate);
    if (normalized) {
      return normalized;
    }
  }

  const queue = [value];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!isPlainObject(current)) {
      continue;
    }
    const normalized = normalizeCssVars(current);
    if (normalized) {
      return normalized;
    }
    for (const entry of Object.values(current)) {
      if (isPlainObject(entry)) {
        queue.push(entry);
      }
    }
  }

  return null;
};

const deriveName = (value, fallbackInput) => {
  const candidates = [
    value?.name,
    value?.title,
    value?.label,
    value?.theme?.name,
    value?.theme?.title,
    value?.themeName,
    value?.slug,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  if (fallbackInput) {
    const base = fallbackInput.split("?")[0].split("#")[0].split("/").pop() ??
      "";
    if (base && base !== "-") {
      return base.replace(/\.[a-z0-9]+$/i, "");
    }
  }
  return "";
};

const buildRootCss = (vars) => {
  const entries = Object.entries(vars ?? {})
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => {
      const trimmedKey = key.trim();
      const cssKey = trimmedKey.startsWith("--")
        ? trimmedKey
        : `--${trimmedKey}`;
      return [cssKey, value.trim()];
    })
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

  if (entries.length === 0) {
    return "";
  }

  return `:root {\n${
    entries.map(([key, value]) => `  ${key}: ${value};`).join("\n")
  }\n}\n`;
};

const writeFileSafe = async (filePath, content, force) => {
  try {
    await fs.access(filePath);
    if (!force) {
      throw new Error(`File already exists: ${filePath}`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT" && !force) {
      throw error;
    }
  }
  await fs.writeFile(filePath, content, "utf8");
};

const run = async () => {
  const rawInput = await readInput();
  if (!rawInput.trim()) {
    console.error("No input provided.");
    printUsage();
    process.exit(1);
  }

  let inputThemeName = options.name;
  let lightCss = "";
  let darkCss = "";
  let parsedJson = false;

  const shouldParseJson = options.format === "json" ||
    (options.format !== "css" && rawInput.trim().startsWith("{"));
  if (shouldParseJson) {
    let json = null;
    try {
      json = JSON.parse(rawInput);
    } catch (error) {
      if (options.format === "json") {
        throw error;
      }
    }

    if (json) {
      parsedJson = true;
      inputThemeName = inputThemeName || deriveName(json, options.input);
      const cssVars = findCssVars(json);
      if (!cssVars) {
        console.error("Could not locate cssVars in the JSON payload.");
        process.exit(1);
      }
      const lightVars = cssVars.light ?? cssVars.dark;
      const darkVars = cssVars.light ? cssVars.dark : null;
      if (!lightVars) {
        console.error("No light cssVars found in the JSON payload.");
        process.exit(1);
      }
      lightCss = buildRootCss(lightVars);
      darkCss = buildRootCss(darkVars);
      if (!lightCss.trim()) {
        console.error(
          "Light cssVars block is empty after parsing the JSON payload.",
        );
        process.exit(1);
      }
    }
  }

  if (!lightCss && !parsedJson) {
    inputThemeName = inputThemeName || deriveName({}, options.input);
    const lightBlock = extractBlock(rawInput, [":root"]);
    if (!lightBlock) {
      console.error("Could not find a :root { ... } block in the input.");
      process.exit(1);
    }
    const darkBlock = extractBlock(rawInput, [
      ".dark:root",
      ".dark",
      ":root.dark",
      '[data-theme="dark"]',
    ]);
    lightCss = formatRootBlock(lightBlock);
    darkCss = darkBlock ? formatRootBlock(darkBlock) : "";
  }

  const slug = slugify(inputThemeName);
  if (!slug) {
    console.error(
      "Theme name must contain letters or numbers. Provide --name to override.",
    );
    process.exit(1);
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const webRoot = path.resolve(scriptDir, "..");
  const outDir = path.join(webRoot, "src", "themes", "tweakcn");

  await fs.mkdir(outDir, { recursive: true });

  const source = options.input ? ` Source: ${options.input}` : "";
  const header = `/* Generated by tweakcn-import.${source} */\n`;
  const lightWithHeader = header + lightCss;
  const lightPath = path.join(outDir, `${slug}.css`);
  await writeFileSafe(lightPath, lightWithHeader, options.force);

  if (darkCss) {
    const darkWithHeader = header + darkCss;
    const darkPath = path.join(outDir, `${slug}-dark.css`);
    await writeFileSafe(darkPath, darkWithHeader, options.force);
  }

  console.log(`Theme files written to ${outDir}`);
};

run().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
