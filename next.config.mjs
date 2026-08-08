import { networkInterfaces } from "node:os";

function normalizeDevOrigin(rawValue) {
  const raw = rawValue.trim();
  if (!raw) return null;

  let hostname = raw;
  if (/^https?:\/\//i.test(raw)) {
    hostname = new URL(raw).hostname;
  } else {
    hostname = raw.replace(/^\/\//, "").split("/", 1)[0];
    if (hostname.startsWith("[")) {
      const closingBracket = hostname.indexOf("]");
      hostname = closingBracket >= 0 ? hostname.slice(1, closingBracket) : hostname;
    } else {
      hostname = hostname.split(":", 1)[0];
    }
  }

  hostname = hostname.trim().toLowerCase();
  if (!hostname || hostname === "*" || hostname.includes("..")) {
    throw new Error(`Invalid DEV_ALLOWED_ORIGINS value: ${rawValue}`);
  }

  const validationTarget = hostname.startsWith("*.") ? hostname.slice(2) : hostname;
  if (!/^[a-z0-9.-]+$/i.test(validationTarget)) {
    throw new Error(`Invalid DEV_ALLOWED_ORIGINS hostname: ${rawValue}`);
  }

  return hostname;
}

function detectedLanIPv4Hosts() {
  return Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

const configuredOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map(normalizeDevOrigin)
  .filter(Boolean);

const allowedDevOrigins = [
  ...new Set(["localhost", "127.0.0.1", ...detectedLanIPv4Hosts(), ...configuredOrigins]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  output: "export",
  images: { unoptimized: true },
  allowedDevOrigins,
  logging: {
    browserToTerminal: "warn",
  },
  productionBrowserSourceMaps: true,
};

export default nextConfig;
