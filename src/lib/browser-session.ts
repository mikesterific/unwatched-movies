import { access } from "node:fs/promises";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export type BrowserChannel = "chromium" | "chrome";

export type BrowserLaunchOptions = {
  headless?: boolean;
  slowMo?: number;
  timeout?: number;
  storageState?: string;
  channel?: BrowserChannel;
  reduceAutomationFingerprint?: boolean;
  acceptDownloads?: boolean;
};

export class BrowserSession {
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;
  private defaultTimeout = 10_000;

  async launch(options: BrowserLaunchOptions = {}): Promise<{ url: string; title: string }> {
    await this.close();
    this.defaultTimeout = options.timeout ?? this.defaultTimeout;

    const useChromeChannel = options.channel === "chrome";
    const reduceFingerprint =
      options.reduceAutomationFingerprint === true || useChromeChannel;

    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless: options.headless ?? false,
      slowMo: options.slowMo,
    };

    if (options.channel && options.channel !== "chromium") {
      launchOptions.channel = options.channel;
    }

    if (reduceFingerprint) {
      launchOptions.ignoreDefaultArgs = ["--enable-automation"];
      launchOptions.args = [
        "--disable-blink-features=AutomationControlled",
        ...(launchOptions.args ?? []),
      ];
    }

    this.browser = await chromium.launch(launchOptions);
    const contextOptions: Parameters<Browser["newContext"]>[0] = {
      viewport: { width: 1280, height: 900 },
      acceptDownloads: options.acceptDownloads ?? true,
    };
    if (options.storageState) {
      await access(options.storageState);
      contextOptions.storageState = options.storageState;
    }
    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.defaultTimeout);
    this.page.setDefaultNavigationTimeout(this.defaultTimeout);

    return { url: this.page.url(), title: await this.page.title() };
  }

  async close(): Promise<void> {
    await this.context?.close().catch(() => undefined);
    await this.browser?.close().catch(() => undefined);
    this.page = undefined;
    this.context = undefined;
    this.browser = undefined;
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error("Browser is not launched. Call launch before running page actions.");
    }
    return this.page;
  }

  getContext(): BrowserContext {
    if (!this.context) {
      throw new Error("Browser context is not active. Call launch first.");
    }
    return this.context;
  }

  async saveStorageState(filePath: string): Promise<void> {
    await this.getContext().storageState({ path: filePath });
  }
}

export const AUTH_LAUNCH_BASE: BrowserLaunchOptions = {
  headless: false,
  timeout: 120_000,
  slowMo: 50,
  reduceAutomationFingerprint: true,
};

export async function launchForManualAuth(session: BrowserSession): Promise<{
  channel: BrowserChannel;
}> {
  try {
    await session.launch({
      ...AUTH_LAUNCH_BASE,
      channel: "chrome",
    });
    return { channel: "chrome" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const chromeMissing = /chrome|channel|executable|not found|ENOENT/i.test(message);

    if (!chromeMissing) {
      throw error;
    }

    console.error("");
    console.error("Google Chrome was not found. Install Chrome from https://www.google.com/chrome/");
    console.error("— or sign in to Netflix with email/password (avoid “Sign in with Google”).");
    console.error("Falling back to bundled Chromium (Google SSO often fails there).");
    console.error("");

    await session.launch({
      ...AUTH_LAUNCH_BASE,
      channel: "chromium",
    });
    return { channel: "chromium" };
  }
}
