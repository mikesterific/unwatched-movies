import { describe, expect, it } from "vitest";
import { isNetflixLoginUrl, isNetflixSignedInUrl } from "@/lib/netflix-auth";
import { isProfileGateUrl } from "@/lib/netflix-history-download";

describe("Netflix auth URL checks", () => {
  it("treats login and help URLs as signed out", () => {
    expect(isNetflixLoginUrl("https://www.netflix.com/login")).toBe(true);
    expect(isNetflixLoginUrl("https://www.netflix.com/LoginHelp")).toBe(true);
    expect(isNetflixSignedInUrl("https://www.netflix.com/login")).toBe(false);
  });

  it("treats browse, account, and viewing activity as signed in", () => {
    expect(isNetflixSignedInUrl("https://www.netflix.com/browse")).toBe(true);
    expect(isNetflixSignedInUrl("https://www.netflix.com/WiViewingActivity")).toBe(true);
    expect(isNetflixSignedInUrl("https://www.netflix.com/account")).toBe(true);
  });

  it("detects the profile gate without treating viewing activity as a gate", () => {
    expect(isProfileGateUrl("https://www.netflix.com/ProfilesGate")).toBe(true);
    expect(isProfileGateUrl("https://www.netflix.com/WiViewingActivity")).toBe(false);
  });
});
