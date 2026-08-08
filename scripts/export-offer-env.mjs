import { appendFile, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isDirectExecution, runCli } from "./cli.mjs";

const OFFER_KEY_PATTERN = /^[1-9]\d*$/;
const CART_ITEM_KEYS = ["listing", "option", "quantity"];

export function toVendorCartItem(item, label = "option_configuration item") {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`${label} must be an object`);
  }
  const keys = Object.keys(item).sort();
  if (keys.length !== CART_ITEM_KEYS.length || CART_ITEM_KEYS.some((key) => !keys.includes(key))) {
    throw new Error(`${label} must contain only listing, option, and quantity`);
  }
  if (!Number.isSafeInteger(item.listing) || item.listing <= 0) {
    throw new Error(`${label}.listing must be a positive safe integer`);
  }
  if (typeof item.option !== "string" || !item.option.trim()) {
    throw new Error(`${label}.option must be a non-empty string`);
  }
  if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
    throw new Error(`${label}.quantity must be a positive safe integer`);
  }
  return {
    Listing: item.listing,
    Option: item.option,
    Quantity: item.quantity,
  };
}

export function deriveOfferEnvironment(mappings) {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    throw new Error("config/offer-options.json must contain a non-empty array");
  }
  const seen = new Set();
  return mappings.map((mapping, mappingIndex) => {
    const label = `offer mapping ${mappingIndex + 1}`;
    if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
      throw new Error(`${label} must be an object`);
    }
    if (typeof mapping.source_offer_key !== "string" || !mapping.source_offer_key.trim()) {
      throw new Error(`${label}.source_offer_key must be a non-empty string`);
    }
    const offerKey = mapping.offer_option_key;
    if (typeof offerKey !== "string" || !OFFER_KEY_PATTERN.test(offerKey)) {
      throw new Error(`${label}.offer_option_key must be a positive decimal string`);
    }
    if (seen.has(offerKey)) throw new Error(`duplicate offer_option_key: ${offerKey}`);
    seen.add(offerKey);
    if (!Array.isArray(mapping.option_configuration) || mapping.option_configuration.length === 0) {
      throw new Error(`${label}.option_configuration must be a non-empty array`);
    }
    const cart = mapping.option_configuration.map((item, itemIndex) =>
      toVendorCartItem(item, `${label}.option_configuration[${itemIndex}]`),
    );
    return {
      offerOptionKey: offerKey,
      environmentKey: `OFFER_OPTION__${offerKey}`,
      value: JSON.stringify(cart),
    };
  });
}

export function renderGitHubEnvironment(entries) {
  return `${entries.map(({ environmentKey, value }) => `${environmentKey}=${value}`).join("\n")}\n`;
}

export function mergeGeneratedEnvironment(existingText, entries) {
  const replacements = new Map(entries.map((entry) => [entry.environmentKey, `${entry.environmentKey}=${entry.value}`]));
  const written = new Set();
  const output = [];
  for (const line of String(existingText).split(/\r?\n/)) {
    const match = /^(OFFER_OPTION__[1-9]\d*)=/.exec(line);
    if (!match || !replacements.has(match[1])) {
      if (line) output.push(line);
      continue;
    }
    if (!written.has(match[1])) {
      output.push(replacements.get(match[1]));
      written.add(match[1]);
    }
  }
  for (const [key, line] of replacements) {
    if (!written.has(key)) output.push(line);
  }
  return `${output.join("\n")}\n`;
}

async function readIfPresent(filePath, read = readFile) {
  try {
    return await read(filePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return "";
    throw error;
  }
}

export async function exportOfferEnvironment({
  cwd = process.cwd(),
  environment = process.env,
  fileSystem = { appendFile, readFile, rename, writeFile },
} = {}) {
  const configPath = resolve(cwd, "config/offer-options.json");
  const mappings = JSON.parse(await fileSystem.readFile(configPath, "utf8"));
  const entries = deriveOfferEnvironment(mappings);
  if (typeof environment.GITHUB_ENV === "string" && environment.GITHUB_ENV.trim()) {
    await fileSystem.appendFile(environment.GITHUB_ENV, renderGitHubEnvironment(entries), "utf8");
    return { entries, target: "github" };
  }

  const outputPath = resolve(cwd, ".env.generated");
  const temporaryPath = `${outputPath}.tmp`;
  const existingText = await readIfPresent(outputPath, fileSystem.readFile);
  await fileSystem.writeFile(temporaryPath, mergeGeneratedEnvironment(existingText, entries), "utf8");
  await fileSystem.rename(temporaryPath, outputPath);
  return { entries, target: ".env.generated" };
}

export function formatOfferEnvironmentResult(result) {
  let output = "";
  for (const entry of result.entries) {
    output += `Prepared ${entry.environmentKey} for offer ${entry.offerOptionKey}.\n`;
  }
  return `${output}Offer environment written to ${result.target} in mapping order.\n`;
}

void runCli({
  direct: isDirectExecution(import.meta.url, process.argv[1]),
  task: exportOfferEnvironment,
  format: formatOfferEnvironmentResult,
});
