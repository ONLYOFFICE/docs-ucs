import { test, expect, Page, Locator } from '@playwright/test';

const HOST = process.env.TEST_HOST;
const PASSWORD = process.env.DROPLET_PASSWORD;
const SECRET_KEY = process.env.ONLYOFFICE_SECRET_KEY ?? 'secret';

if (!HOST) {
  throw new Error('TEST_HOST is not defined');
}

if (!PASSWORD) {
  throw new Error('DROPLET_PASSWORD is not defined');
}

const BASE_URL = `https://${HOST}`;
const NEXTCLOUD_URL = `${BASE_URL}/nextcloud`;
const DOCUMENT_SERVER_URL = `${BASE_URL}/onlyoffice-documentserver/`;

const USERNAME = 'Administrator';


const CLICK_DELAY = 10_000;
const UI_TIMEOUT = 60_000;
const EDITOR_READY_TIMEOUT = 180_000;
const AUTOSAVE_WAIT = 5_000;
const TEST_TIMEOUT = 20 * 60_000;

function logProgress(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[ONLYOFFICE E2E] ${timestamp} - ${message}`);
}

test.use({
  ignoreHTTPSErrors: true,
  actionTimeout: UI_TIMEOUT,
  navigationTimeout: UI_TIMEOUT,
});

test.setTimeout(TEST_TIMEOUT);
test.describe.configure({ retries: 0 });

test('Create and save ONLYOFFICE files in Nextcloud', async ({ page }) => {
  logProgress('Test started');

  try {
    await test.step('Login to Nextcloud', async () => {
      await login(page);
    });

    await test.step('Open ONLYOFFICE settings and configure document server', async () => {
      await openOnlyofficeSettings(page);
      await configureDocumentServer(page, DOCUMENT_SERVER_URL);
    });

    await test.step('Open Files app', async () => {
      await openFiles(page);
    });

    await test.step('Create and edit document', async () => {
      await createAndOpenFile(page, 'New document');
      await writeDocumentText(page);
      await closeEditorAndReturnToFiles(page);
    });

    await test.step('Create and edit presentation', async () => {
      await createAndOpenFile(page, 'New presentation');
      await writePresentationText(page);
      await closeEditorAndReturnToFiles(page);
    });

    await test.step('Create and edit spreadsheet', async () => {
      await createAndOpenFile(page, 'New spreadsheet');
      await writeSpreadsheetText(page);
      await closeEditorAndReturnToFiles(page);
    });

    logProgress('Test finished successfully');
  } catch (error) {
    logProgress(`Test failed: ${getErrorMessage(error)}`);
    throw error;
  }
});

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isSuccessOnlyofficeInfoDialog(dialogText: string): boolean {
  return /successfully updated/i.test(dialogText);
}


async function clickWithDelay(locator: Locator): Promise<void> {
  await locator.click({ timeout: UI_TIMEOUT });
  await locator.page().waitForTimeout(CLICK_DELAY);
}

async function login(page: Page): Promise<void> {
  logProgress('Opening Nextcloud login page');
  await page.goto(
    `${NEXTCLOUD_URL}/apps/user_saml/saml/selectUserBackEnd?redirectUrl=`,
    { waitUntil: 'domcontentloaded' }
  );

  await clickWithDelay(page.getByRole('link', { name: 'Direct log in' }));

  await page.getByRole('textbox', { name: 'Account name' }).fill(USERNAME);
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);

  await Promise.all([
    page.waitForURL(/\/nextcloud\//),
    page.getByRole('button', { name: 'Log in', exact: true }).click(),
  ]);

  await page.waitForTimeout(CLICK_DELAY);
  const closeButton = page.getByRole('button', { name: 'Close' });

  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  await expect(
    page.getByRole('button', { name: 'Settings menu' })
  ).toBeVisible();
}

async function openOnlyofficeSettings(page: Page): Promise<void> {
  logProgress('Opening ONLYOFFICE settings page in Nextcloud admin');
  await expect(
    page.getByRole('button', { name: 'Settings menu' })
  ).toBeVisible();

  await clickWithDelay(page.getByRole('button', { name: 'Settings menu' }));

  await expect(
    page.getByRole('link', { name: 'Administration settings' })
  ).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/nextcloud\/settings\/admin/),
    page.getByRole('link', { name: 'Administration settings' }).click(),
  ]);

  await page.waitForTimeout(CLICK_DELAY);

  await expect(page.getByRole('link', { name: 'ONLYOFFICE' })).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/nextcloud\/settings\/admin\/onlyoffice/),
    page.getByRole('link', { name: 'ONLYOFFICE' }).click(),
  ]);

  await page.waitForTimeout(CLICK_DELAY);

  await expect(
    page.getByRole('textbox', { name: 'https://<documentserver>/' })
  ).toBeEditable();
}

async function configureDocumentServer(
  page: Page,
  documentServerUrl: string
): Promise<void> {
  logProgress(`Configuring document server URL: ${documentServerUrl}`);
  const dsInput = page.getByRole('textbox', {
    name: 'https://<documentserver>/',
  });

  await expect(dsInput).toBeEditable();

  const closeErrorButton = page.getByRole('button', { name: 'Close' });
  if (await closeErrorButton.isVisible().catch(() => false)) {
    await clickWithDelay(closeErrorButton);
  }

  await dsInput.fill(documentServerUrl);

  const secretKeyInput = page.getByPlaceholder('Secret key (leave blank to disable)').first();
  if (await secretKeyInput.isVisible().catch(() => false)) {
    await secretKeyInput.fill(SECRET_KEY);
  }

  const insecureCheckbox = page.getByRole('checkbox', {
    name: 'Disable certificate verification (insecure)',
  });

  const insecureLabel = page.getByText(
    'Disable certificate verification (insecure)'
  );

  await insecureLabel.scrollIntoViewIfNeeded();
  await expect(insecureCheckbox).toBeAttached();

  if (!(await insecureCheckbox.isChecked())) {
    await insecureLabel.click();
    await page.waitForTimeout(CLICK_DELAY);
    await expect(insecureCheckbox).toBeChecked();
  }

  const saveAddressButton = page.locator('#onlyofficeAddrSave');
  await expect(saveAddressButton).toBeEnabled();
  await clickWithDelay(saveAddressButton);

  const dialog = page.getByRole('dialog').first();
  if (await dialog.isVisible().catch(() => false)) {
    const dialogText = (await dialog.textContent().catch(() => null))?.trim() ?? '';
    const okButton = dialog.getByRole('button', { name: 'Ok' });

    if (isSuccessOnlyofficeInfoDialog(dialogText)) {
      logProgress(
        `ONLYOFFICE configuration saved with info dialog${dialogText ? `: ${dialogText}` : ''}`
      );
    } else {
      logProgress(
        `ONLYOFFICE configuration returned dialog${dialogText ? `: ${dialogText}` : ''}`
      );
    }

    if (await okButton.isVisible().catch(() => false)) {
      await okButton.click({ timeout: UI_TIMEOUT });
      await dialog.waitFor({ state: 'hidden', timeout: UI_TIMEOUT }).catch(() => undefined);
    }
  } else {
    logProgress('ONLYOFFICE configuration saved without visible dialog');
  }
}

async function openFiles(page: Page): Promise<void> {
  logProgress('Opening Files app');
  const filesLink = page.getByRole('link', { name: 'Files' }).first();

  if (await filesLink.isVisible().catch(() => false)) {
    await clickWithDelay(filesLink);
  } else {
    await page.goto(`${NEXTCLOUD_URL}/apps/files/files`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(CLICK_DELAY);
  }

  await expect(page.getByRole('button', { name: 'New' })).toBeVisible();
}

async function createAndOpenFile(
  page: Page,
  menuItemName: string
): Promise<void> {
  logProgress(`Creating file from menu item: ${menuItemName}`);
  await expect(page.getByRole('button', { name: 'New' })).toBeVisible();
  await clickWithDelay(page.getByRole('button', { name: 'New' }));

  await page.waitForTimeout(CLICK_DELAY);

  await expect(page.getByRole('menuitem', { name: menuItemName })).toBeVisible();
  await clickWithDelay(page.getByRole('menuitem', { name: menuItemName }));

  const createButton = page.getByRole('button', { name: 'Create' });
  await expect(createButton).toBeVisible();

  await page.waitForTimeout(CLICK_DELAY);
  await clickWithDelay(createButton);
  await waitForEditorReady(page);
}

async function waitForEditorReady(page: Page): Promise<void> {
  logProgress('Waiting for editor to be ready');
  const editorIframe = page.locator('iframe').first();

  await expect(editorIframe).toBeVisible({ timeout: EDITOR_READY_TIMEOUT });
  await expect(page.frameLocator('iframe').locator('body')).toBeVisible({
    timeout: EDITOR_READY_TIMEOUT,
  });
}

async function writeDocumentText(page: Page): Promise<void> {
  logProgress('Writing text into document');
  const editorFrame = page.frameLocator('iframe');

  await editorFrame.locator('body').click();
  await page.keyboard.type('Playwright test text');
  await waitForAutosave();
}

async function writePresentationText(page: Page): Promise<void> {
  logProgress('Writing text into presentation');
  const editorFrame = page.frameLocator('iframe');

  await editorFrame.locator('body').click();
  await page.keyboard.type('Playwright presentation text');
  await waitForAutosave();
}

async function writeSpreadsheetText(page: Page): Promise<void> {
  logProgress('Writing text into spreadsheet');
  const editorFrame = page.frameLocator('iframe');

  await editorFrame.locator('body').click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+Home');
  await page.keyboard.type('Playwright spreadsheet text');
  await page.keyboard.press('Enter');
  await waitForAutosave();
}

async function waitForAutosave(): Promise<void> {
  logProgress('Waiting 5 seconds for editor autosave');
  await new Promise((resolve) => setTimeout(resolve, AUTOSAVE_WAIT));
}

async function closeEditorAndReturnToFiles(page: Page): Promise<void> {
  logProgress('Closing editor and returning to files list');
  const closeButton = page.getByRole('button', { name: 'Close editor' });

  if (await closeButton.isVisible().catch(() => false)) {
    await Promise.all([
      page.waitForURL(/\/nextcloud\/apps\/files\/files/),
      closeButton.click(),
    ]);

    await page.waitForTimeout(CLICK_DELAY);
  } else {
    await page.goto(`${NEXTCLOUD_URL}/apps/files/files`, {
      waitUntil: 'domcontentloaded',
    });
  }

  await expect(page.getByRole('button', { name: 'New' })).toBeVisible();
}
