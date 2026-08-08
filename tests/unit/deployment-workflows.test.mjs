import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function workflow(name) {
  return readFile(resolve(process.cwd(), ".github/workflows", name), "utf8");
}

function expectOrdered(text, commands) {
  let previous = -1;
  for (const command of commands) {
    const position = text.indexOf(command, previous + 1);
    expect(position, `${command} should appear in workflow order`).toBeGreaterThan(previous);
    previous = position;
  }
}

describe("deployment workflow contracts", () => {
  it("deploys every non-main branch through the test environment after quality", async () => {
    const text = await workflow("test.yml");
    expect(text).toContain("push:\n    branches-ignore:\n      - main");
    expect(text).toContain("pull_request:\n    branches-ignore:\n      - main");
    expect(text).toContain("workflow_dispatch:");
    expect(text).toContain("environment: test");
    expect(text).toContain("APP_NAME: niobiumecomm-ptrb-vol-test");
    expect(text).not.toContain("feature/");
    expectOrdered(text, [
      "npm ci --strict-allow-scripts",
      "npm run deps:health",
      "npx playwright install --with-deps chromium",
      "node scripts/export-offer-env.mjs",
      "npm run quality",
      "npm run deploy",
    ]);
  });

  it("validates main pull requests and deploys only pushes or manual production runs", async () => {
    const text = await workflow("prod.yml");
    expect(text).toContain("pull_request:\n    branches:\n      - main");
    expect(text).toContain("push:\n    branches:\n      - main");
    expect(text).toContain("if: github.event_name == 'pull_request'");
    expect(text).toContain("if: github.event_name == 'push' || github.event_name == 'workflow_dispatch'");
    expect(text).toContain("environment: prod");
    expect(text).toContain("APP_NAME: niobiumecomm-ptrb-vol");
    expect(text.match(/npm run deploy/g)).toHaveLength(1);
    const deployJob = text.slice(text.indexOf("quality-and-deploy:"));
    expectOrdered(deployJob, [
      "npm ci --strict-allow-scripts",
      "npm run deps:health",
      "npx playwright install --with-deps chromium",
      "node scripts/export-offer-env.mjs",
      "npm run quality",
      "npm run deploy",
    ]);
  });

  it("keeps deployment credentials in GitHub secrets", async () => {
    const accountKey = ["CLOUDFLARE", "ACCOUNT", "ID"].join("_");
    const tokenKey = ["CLOUDFLARE", "API", "TOKEN"].join("_");
    for (const name of ["test.yml", "prod.yml"]) {
      const text = await workflow(name);
      expect(text).toContain(`${accountKey}: \${{ secrets.${accountKey} }}`);
      expect(text).toContain(`${tokenKey}: \${{ secrets.${tokenKey} }}`);
      expect(text).not.toMatch(new RegExp(`${tokenKey}:\\s*(?!\\$\\{\\{ secrets\\.)[^\\s]`));
    }
  });
});
