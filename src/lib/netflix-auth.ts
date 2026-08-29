import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { BrowserSession, launchForManualAuth } from "@/lib/browser-session";
import { NETFLIX_LOGIN_URL, netflixAuthPath } from "@/lib/netflix-session";

const LOGIN_POLL_MS = 2_000;
const DEFAULT_LOGIN_WAIT_MS = 300_000;

const NETFLIX_SESSION_COOKIES = new Set(["NetflixId", "SecureNetflixId"]);

export function isNetflixLoginUrl(url: string): boolean {
  return /netflix\.com\/(login|LoginHelp|logout)/i.test(url);
}

export function isNetflixSignedInUrl(url: string): boolean {
  if (!url.includes("netflix.com") || isNetflixLoginUrl(url)) {
    return false;
  }
  return /netflix\.com\/(browse|ProfilesGate|WiHome|WiViewingActivity|account|ManageProfiles)/i.test(
    url,
  );
}

export async function contextHasNetflixSession(context: BrowserContext): Promise<boolean> {
  const cookies = await context.cookies("https://www.netflix.com").catch(() => []);
  return cookies.some((cookie) => NETFLIX_SESSION_COOKIES.has(cookie.name) && Boolean(cookie.value));
}

export async function isNetflixLoggedIn(page: Page): Promise<boolean> {
  const url = page.url();
  if (!url.includes("netflix.com") || isNetflixLoginUrl(url)) {
    return false;
  }

  if (await contextHasNetflixSession(page.context())) {
    return true;
  }

  if (isNetflixSignedInUrl(url)) {
    return true;
  }

  const profileHeading = page.getByRole("heading", { name: /who.?s watching/i });
  if (await profileHeading.isVisible().catch(() => false)) {
    return true;
  }

  return false;
}

export async function waitForNetflixLogin(
  page: Page,
  timeoutMs = DEFAULT_LOGIN_WAIT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isNetflixLoggedIn(page)) {
      return;
    }
    await page.waitForTimeout(LOGIN_POLL_MS);
  }
  throw new Error(
    `Timed out after ${timeoutMs / 1000}s waiting for Netflix sign-in. Finish login in the browser window, then run again.`,
  );
}

async function findLoggedInNetflixPage(contexts: BrowserContext[]): Promise<{
  context: BrowserContext;
  page: Page;
} | undefined> {
  for (const context of contexts) {
    for (const page of context.pages()) {
      if (await isNetflixLoggedIn(page).catch(() => false)) {
        return { context, page };
      }
    }
  }
  return undefined;
}

async function findNetflixSessionContext(
  contexts: BrowserContext[],
): Promise<BrowserContext | undefined> {
  for (const context of contexts) {
    if (await contextHasNetflixSession(context)) {
      return context;
    }
  }
  return undefined;
}

async function waitForNetflixLoginInBrowser(
  browser: Browser,
  timeoutMs = DEFAULT_LOGIN_WAIT_MS,
): Promise<{ context: BrowserContext; page?: Page }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const sessionContext = await findNetflixSessionContext(browser.contexts());
    if (sessionContext) {
      return { context: sessionContext, page: sessionContext.pages()[0] };
    }

    const found = await findLoggedInNetflixPage(browser.contexts());
    if (found) {
      return found;
    }
    await new Promise((resolve) => setTimeout(resolve, LOGIN_POLL_MS));
  }
  throw new Error(
    `Timed out after ${timeoutMs / 1000}s waiting for Netflix sign-in in any attached Chrome tab.`,
  );
}

export type NetflixAuthResult = {
  storageStatePath: string;
  page: { url: string; title: string };
  browser?: "owned" | "existing-cdp";
};

export async function authNetflix(
  session = new BrowserSession(),
): Promise<NetflixAuthResult> {
  const storageStatePath = netflixAuthPath();
  await mkdir(dirname(storageStatePath), { recursive: true });

  try {
    const { channel } = await launchForManualAuth(session);
    const page = session.getPage();
    await page.goto(NETFLIX_LOGIN_URL, { waitUntil: "domcontentloaded" });

    console.error("");
    console.error(
      channel === "chrome"
        ? "Google Chrome is open — sign in to Netflix in that window and pick the profile you want tracked."
        : "Browser is open — use Netflix email/password (Google sign-in often fails in Chromium).",
    );
    console.error("Complete 2FA or passkey if prompted. Waiting up to 5 minutes.");
    console.error("");

    await waitForNetflixLogin(page);
    await session.saveStorageState(storageStatePath);

    return {
      storageStatePath,
      browser: "owned",
      page: { url: page.url(), title: await page.title() },
    };
  } finally {
    await session.close().catch(() => undefined);
  }
}

export async function authNetflixFromExistingBrowser(
  cdpUrl = "http://127.0.0.1:9222",
): Promise<NetflixAuthResult> {
  const storageStatePath = netflixAuthPath();
  await mkdir(dirname(storageStatePath), { recursive: true });

  const browser = await chromium.connectOverCDP(cdpUrl);
  const existingSessionContext = await findNetflixSessionContext(browser.contexts());
  if (existingSessionContext) {
    const page = existingSessionContext.pages()[0];
    await existingSessionContext.storageState({ path: storageStatePath });
    return {
      storageStatePath,
      browser: "existing-cdp",
      page: { url: page?.url() ?? "about:blank", title: page ? await page.title() : "" },
    };
  }

  const existingLogin = await findLoggedInNetflixPage(browser.contexts());
  if (existingLogin) {
    await existingLogin.context.storageState({ path: storageStatePath });
    return {
      storageStatePath,
      browser: "existing-cdp",
      page: { url: existingLogin.page.url(), title: await existingLogin.page.title() },
    };
  }

  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page =
    context.pages().find((item) => item.url().includes("netflix.com")) ??
    context.pages()[0] ??
    (await context.newPage());

  if (!page.url().includes("netflix.com")) {
    await page.goto(NETFLIX_LOGIN_URL, { waitUntil: "domcontentloaded" });
  }

  console.error("");
  console.error(`Attached to existing Chrome via ${cdpUrl}.`);
  console.error("Sign in to Netflix in that browser window if you are not already signed in.");
  console.error("This command will save .auth/netflix.json, then disconnect without closing Chrome.");
  console.error("");

  const loggedIn = await waitForNetflixLoginInBrowser(browser);
  await loggedIn.context.storageState({ path: storageStatePath });

  return {
    storageStatePath,
    browser: "existing-cdp",
    page: {
      url: loggedIn.page?.url() ?? "about:blank",
      title: loggedIn.page ? await loggedIn.page.title() : "",
    },
  };
}
