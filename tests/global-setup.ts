import type { FullConfig } from '@playwright/test';

const DEFAULT_DS_STARTUP_WAIT_MS = 3 * 60_000;

const parsedWaitMs = Number(process.env.PLAYWRIGHT_DS_WAIT_MS);
const dsStartupWaitMs = Number.isFinite(parsedWaitMs) && parsedWaitMs >= 0
  ? parsedWaitMs
  : DEFAULT_DS_STARTUP_WAIT_MS;

async function globalSetup(_config: FullConfig): Promise<void> {
  console.log(
    `[ONLYOFFICE E2E] Waiting ${Math.round(dsStartupWaitMs / 60_000)} minutes for DS services startup before tests...`
  );

  await new Promise((resolve) => {
    setTimeout(resolve, dsStartupWaitMs);
  });
}

export default globalSetup;
