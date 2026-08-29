import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { projectHistoryInfo, projectPrimeHistoryInfo } from "@/lib/project-csv";

describe("project viewing CSV", () => {
  const previousCsv = process.env.PROJECT_HISTORY_CSV;
  const previousPrime = process.env.PROJECT_PRIME_HISTORY;
  const previousDb = process.env.UNSEEN_DB_PATH;

  beforeEach(() => {
    const dir = mkdtempSync(path.join(tmpdir(), "unseen-csv-"));
    process.env.UNSEEN_DB_PATH = path.join(dir, "test.sqlite");
    closeDb();
    getDb();
  });

  afterEach(() => {
    closeDb();
    if (previousCsv) process.env.PROJECT_HISTORY_CSV = previousCsv;
    else delete process.env.PROJECT_HISTORY_CSV;
    if (previousPrime) process.env.PROJECT_PRIME_HISTORY = previousPrime;
    else delete process.env.PROJECT_PRIME_HISTORY;
    if (previousDb) process.env.UNSEEN_DB_PATH = previousDb;
    else delete process.env.UNSEEN_DB_PATH;
  });

  it("reports when the project CSV is present", () => {
    const filePath = path.join(tmpdir(), `history-${Date.now()}.csv`);
    writeFileSync(filePath, "Title,Date\nThe Matrix,8/1/24\n");
    process.env.PROJECT_HISTORY_CSV = filePath;
    expect(projectHistoryInfo().present).toBe(true);
    expect(projectHistoryInfo().filename).toBe(path.basename(filePath));
  });

  it("reports when a Prime viewing-history file is present", () => {
    const filePath = path.join(tmpdir(), `prime-${Date.now()}.csv`);
    writeFileSync(filePath, "Title,Seconds Viewed\nThe Matrix,100\n");
    process.env.PROJECT_PRIME_HISTORY = filePath;
    expect(projectPrimeHistoryInfo().present).toBe(true);
    expect(projectPrimeHistoryInfo().filename).toBe(path.basename(filePath));
  });
});
