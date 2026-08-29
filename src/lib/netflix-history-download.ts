import fs from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import { BrowserSession } from "@/lib/browser-session";
import { importViewingCsv, type UploadSummary } from "@/lib/history";
import { isNetflixLoginUrl } from "@/lib/netflix-auth";
import {
  NETFLIX_VIEWING_ACTIVITY_URL,
  hasNetflixAuth,
  netflixAuthPath,
  netflixUploadsDir,
} from "@/lib/netflix-session";

const DOWNLOAD_NAME = /download all/i;
const SCROLL_ATTEMPTS = 30;

export function isProfileGateUrl(url: string): boolean {
  return /netflix\.com\/(ProfilesGate|profiles)/i.test(url) && !/WiViewingActivity/i.test(url);
}

export async function isProfileGate(page: Page): Promise<boolean> {
  if (isProfileGateUrl(page.url())) {
    return true;
  }
  const heading = page.getByRole("heading", { name: /who.?s watching/i });
  return heading.isVisible().catch(() => false);
}

export function downloadAllControl(page: Page) {
  return page
    .getByRole("link", { name: DOWNLOAD_NAME })
    .or(page.getByRole("button", { name: DOWNLOAD_NAME }))
    .or(page.getByText(DOWNLOAD_NAME));
}

export async function scrollUntilDownloadAll(page: Page): Promise<boolean> {
  for (let attempt = 0; attempt < SCROLL_ATTEMPTS; attempt += 1) {
    if (await downloadAllControl(page).first().isVisible().catch(() => false)) {
      return true;
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
  }
  return downloadAllControl(page).first().isVisible().catch(() => false);
}

export async function clickOfficialDownload(page: Page, destPath: string): Promise<string> {
  if (isNetflixLoginUrl(page.url())) {
    throw new Error("Netflix session expired. Run npm run auth:netflix again.");
  }
  if (await isProfileGate(page)) {
    throw new Error(
      "Netflix is asking you to pick a profile. Choose the profile during npm run auth:netflix, then re-run refresh.",
    );
  }

  const found = await scrollUntilDownloadAll(page);
  if (!found) {
    throw new Error("Could not find the official Download all button on Viewing activity.");
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await downloadAllControl(page).first().click();
  const download = await downloadPromise;
  await download.saveAs(destPath);
  return destPath;
}

export async function refreshOfficialHistory(): Promise<UploadSummary & { filename: string }> {
  if (!hasNetflixAuth()) {
    throw new Error("No saved Netflix session. Run npm run auth:netflix first.");
  }

  const destPath = path.join(netflixUploadsDir(), "NetflixViewingHistory.csv");
  const session = new BrowserSession();
  const launchOptions = {
    headless: false,
    storageState: netflixAuthPath(),
    reduceAutomationFingerprint: true,
    acceptDownloads: true,
    timeout: 60_000,
  } as const;

  try {
    try {
      await session.launch({ ...launchOptions, channel: "chrome" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/chrome|channel|executable|not found|ENOENT/i.test(message)) {
        throw error;
      }
      await session.launch({ ...launchOptions, channel: "chromium" });
    }

    const page = session.getPage();
    await page.goto(NETFLIX_VIEWING_ACTIVITY_URL, { waitUntil: "domcontentloaded" });

    if (isNetflixLoginUrl(page.url())) {
      throw new Error("Netflix session expired. Run npm run auth:netflix again.");
    }

    await clickOfficialDownload(page, destPath);
  } finally {
    await session.close().catch(() => undefined);
  }

  const text = fs.readFileSync(destPath, "utf8");
  const summary = await importViewingCsv(text, path.basename(destPath));
  return { ...summary, filename: path.basename(destPath) };
}
