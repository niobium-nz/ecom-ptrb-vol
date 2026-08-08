import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { isDirectExecution, runCli } from "./cli.mjs";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
const ZONE_NAME = "niobium.co.nz";
const DOMAIN_SUFFIX = "listings.niobium.co.nz";

export function requireDeployValue(name, value) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required for deployment`);
  return value.trim();
}

export function validateAppName(value) {
  const appName = requireDeployValue("APP_NAME", value).toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(appName)) {
    throw new Error("APP_NAME must be a valid lowercase Cloudflare Pages project name and DNS label");
  }
  return appName;
}

export function readDeployConfiguration(environment = process.env) {
  return {
    appName: validateAppName(environment.APP_NAME),
    accountId: requireDeployValue("CLOUDFLARE_ACCOUNT_ID", environment.CLOUDFLARE_ACCOUNT_ID),
    apiToken: requireDeployValue("CLOUDFLARE_API_TOKEN", environment.CLOUDFLARE_API_TOKEN),
  };
}

export function deploymentNames(appName) {
  const projectName = validateAppName(appName);
  return {
    projectName,
    pagesHostname: `${projectName}.pages.dev`,
    customDomain: `${projectName}.${DOMAIN_SUFFIX}`,
  };
}

export function buildWranglerDeployCommand(appName, platform = process.platform) {
  return {
    command: platform === "win32" ? "npx.cmd" : "npx",
    args: [
      "wrangler",
      "pages",
      "deploy",
      "out",
      "--project-name",
      validateAppName(appName),
      "--branch",
      "main",
      "--commit-dirty=true",
    ],
  };
}

export function buildDnsRecord(customDomain, pagesHostname) {
  return {
    type: "CNAME",
    name: customDomain,
    content: pagesHostname,
    ttl: 1,
    proxied: true,
  };
}

export function dnsRecordMatches(record, desired) {
  return Boolean(
    record
      && record.type === desired.type
      && record.name === desired.name
      && record.content === desired.content
      && record.proxied === desired.proxied,
  );
}

export async function cloudflareRequest({
  apiToken,
  path,
  method = "GET",
  body,
  fetchImpl = fetch,
  allowNotFound = false,
}) {
  const response = await fetchImpl(`${CLOUDFLARE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response || typeof response.text !== "function" || typeof response.status !== "number") {
    throw new Error("Cloudflare API returned an invalid Response object");
  }
  const text = await response.text();
  if (allowNotFound && response.status === 404) return null;
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Cloudflare API returned malformed JSON with status ${response.status}`);
  }
  if (!response.ok || response.status < 200 || response.status >= 300 || payload.success === false) {
    throw new Error(`Cloudflare API request failed with status ${response.status}`);
  }
  if (!Object.hasOwn(payload, "result")) {
    throw new Error("Cloudflare API response did not include a result");
  }
  return payload.result;
}

export async function ensurePagesProject(configuration, fetchImpl = fetch) {
  const projectPath = `/accounts/${encodeURIComponent(configuration.accountId)}/pages/projects/${encodeURIComponent(configuration.appName)}`;
  const existing = await cloudflareRequest({ ...configuration, path: projectPath, fetchImpl, allowNotFound: true });
  if (existing) return { created: false, project: existing };
  const project = await cloudflareRequest({
    ...configuration,
    path: `/accounts/${encodeURIComponent(configuration.accountId)}/pages/projects`,
    method: "POST",
    body: { name: configuration.appName, production_branch: "main" },
    fetchImpl,
  });
  return { created: true, project };
}

export async function findAccountZone(configuration, fetchImpl = fetch) {
  const query = new URLSearchParams({ name: ZONE_NAME, "account.id": configuration.accountId });
  const zones = await cloudflareRequest({
    ...configuration,
    path: `/zones?${query}`,
    fetchImpl,
  });
  const zone = Array.isArray(zones) ? zones.find((item) => item?.name === ZONE_NAME) : null;
  if (!zone || typeof zone.id !== "string" || !zone.id) {
    throw new Error(`Cloudflare zone ${ZONE_NAME} was not found in the configured account`);
  }
  return zone;
}

export async function ensureDnsRecord(configuration, names, fetchImpl = fetch) {
  const zone = await findAccountZone(configuration, fetchImpl);
  const query = new URLSearchParams({ type: "CNAME", name: names.customDomain });
  const records = await cloudflareRequest({
    ...configuration,
    path: `/zones/${encodeURIComponent(zone.id)}/dns_records?${query}`,
    fetchImpl,
  });
  const existing = Array.isArray(records) ? records[0] : null;
  const desired = buildDnsRecord(names.customDomain, names.pagesHostname);
  if (dnsRecordMatches(existing, desired)) return { action: "unchanged", record: existing };
  if (existing && typeof existing.id === "string" && existing.id) {
    const record = await cloudflareRequest({
      ...configuration,
      path: `/zones/${encodeURIComponent(zone.id)}/dns_records/${encodeURIComponent(existing.id)}`,
      method: "PUT",
      body: desired,
      fetchImpl,
    });
    return { action: "updated", record };
  }
  const record = await cloudflareRequest({
    ...configuration,
    path: `/zones/${encodeURIComponent(zone.id)}/dns_records`,
    method: "POST",
    body: desired,
    fetchImpl,
  });
  return { action: "created", record };
}

export async function ensurePagesDomain(configuration, names, fetchImpl = fetch) {
  const domainsPath = `/accounts/${encodeURIComponent(configuration.accountId)}/pages/projects/${encodeURIComponent(configuration.appName)}/domains`;
  const domains = await cloudflareRequest({ ...configuration, path: domainsPath, fetchImpl });
  const existing = Array.isArray(domains)
    ? domains.find((domain) => domain?.name === names.customDomain)
    : null;
  if (existing) return { created: false, domain: existing };
  const domain = await cloudflareRequest({
    ...configuration,
    path: domainsPath,
    method: "POST",
    body: { name: names.customDomain },
    fetchImpl,
  });
  return { created: true, domain };
}

export function runCommand(command, args, { cwd = process.cwd(), environment = process.env } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, env: environment, shell: false, stdio: "inherit" });
    child.once("error", rejectPromise);
    child.once("close", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`Deployment command failed with exit code ${code}`));
    });
  });
}

export async function assertStaticOutput(cwd = process.cwd(), statImpl = stat) {
  const outputPath = resolve(cwd, "out");
  let outputStat;
  try {
    outputStat = await statImpl(outputPath);
  } catch {
    throw new Error("Static output directory out/ is missing; run npm run build before deployment");
  }
  if (!outputStat.isDirectory()) throw new Error("Static output path out/ is not a directory");
  return outputPath;
}

export async function deployCloudflarePages({
  cwd = process.cwd(),
  environment = process.env,
  fetchImpl = fetch,
  commandRunner = runCommand,
  statImpl = stat,
} = {}) {
  const configuration = readDeployConfiguration(environment);
  const names = deploymentNames(configuration.appName);
  await assertStaticOutput(cwd, statImpl);
  const project = await ensurePagesProject(configuration, fetchImpl);
  const wrangler = buildWranglerDeployCommand(configuration.appName);
  await commandRunner(wrangler.command, wrangler.args, { cwd, environment });
  const dns = await ensureDnsRecord(configuration, names, fetchImpl);
  const domain = await ensurePagesDomain(configuration, names, fetchImpl);
  return {
    appName: configuration.appName,
    customDomain: names.customDomain,
    projectCreated: project.created,
    dnsAction: dns.action,
    domainCreated: domain.created,
  };
}

export function formatDeploymentResult(result) {
  return `Cloudflare Pages project ${result.appName} deployed.\n` +
    `Custom domain configured: ${result.customDomain}.\n` +
    `Project created: ${result.projectCreated}; DNS: ${result.dnsAction}; domain created: ${result.domainCreated}.\n`;
}

void runCli({
  direct: isDirectExecution(import.meta.url, process.argv[1]),
  task: deployCloudflarePages,
  format: formatDeploymentResult,
});
