import fs from "node:fs";
import path from "node:path";

export const NETFLIX_LOGIN_URL = "https://www.netflix.com/login";
export const NETFLIX_VIEWING_ACTIVITY_URL = "https://www.netflix.com/WiViewingActivity";

export function netflixAuthPath(cwd = process.cwd()): string {
  return process.env.NETFLIX_AUTH_PATH ?? path.join(cwd, ".auth", "netflix.json");
}

export function netflixUploadsDir(cwd = process.cwd()): string {
  return path.join(cwd, "data", "uploads");
}

export function hasNetflixAuth(cwd = process.cwd()): boolean {
  return fs.existsSync(netflixAuthPath(cwd));
}
