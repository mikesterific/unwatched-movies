import { authNetflix, authNetflixFromExistingBrowser } from "../lib/netflix-auth";

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const cdpUrl = flagValue(args, "--cdp-url") ?? "http://127.0.0.1:9222";
  const existing = args.includes("--existing") || args.includes("--cdp-url");

  const result = existing
    ? await authNetflixFromExistingBrowser(cdpUrl)
    : await authNetflix();

  console.error(`Netflix session saved: ${result.storageStatePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
