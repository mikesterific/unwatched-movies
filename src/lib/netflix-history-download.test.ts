import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { afterEach, describe, expect, it } from "vitest";
import {
  clickOfficialDownload,
  isProfileGate,
} from "@/lib/netflix-history-download";

const downloadFixture = path.join(process.cwd(), "fixtures/viewing-activity-download.html");
const profileFixture = path.join(process.cwd(), "fixtures/viewing-activity-profile-gate.html");

describe("official viewing-activity download fixture", () => {
  const browsers: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    while (browsers.length > 0) {
      await browsers.pop()?.close();
    }
  });

  it("clicks Download all on a local viewing-activity page", async () => {
    const browser = await chromium.launch({ headless: true });
    browsers.push(browser);
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    await page.route("**/NetflixViewingHistory.csv", (route) =>
      route.fulfill({
        status: 200,
        headers: {
          "content-type": "text/csv",
          "content-disposition": "attachment; filename=NetflixViewingHistory.csv",
        },
        body: "Title,Date\nThe Matrix,8/1/24\n",
      }),
    );
    await page.goto(pathToFileURL(downloadFixture).href);
    const dest = path.join(mkdtempSync(path.join(tmpdir(), "netflix-dl-")), "NetflixViewingHistory.csv");
    await clickOfficialDownload(page, dest);
    expect(readFileSync(dest, "utf8")).toContain("The Matrix");
  }, 30_000);

  it("refuses to download when the profile gate is showing", async () => {
    const browser = await chromium.launch({ headless: true });
    browsers.push(browser);
    const page = await browser.newPage();
    await page.goto(pathToFileURL(profileFixture).href);
    expect(await isProfileGate(page)).toBe(true);
    await expect(
      clickOfficialDownload(page, path.join(tmpdir(), "should-not-exist.csv")),
    ).rejects.toThrow(/pick a profile/i);
  });
});
