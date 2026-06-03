export type DevicePage = "desktop-landscape" | "mobile" | "mobile-safari";

export function detectDevicePage(): DevicePage {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "desktop-landscape";
  }

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const hasTouch = navigator.maxTouchPoints > 1;
  const isIpadOsDesktopMode = platform === "MacIntel" && hasTouch;
  const mobileMedia = window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
  const isMobileDevice = mobileMedia || /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || isIpadOsDesktopMode;

  if (!isMobileDevice) {
    return "desktop-landscape";
  }

  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent) || isIpadOsDesktopMode;
  const isSafari = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Android/i.test(userAgent);

  return isAppleMobile && isSafari ? "mobile-safari" : "mobile";
}

export function devicePageLabel(devicePage: DevicePage) {
  if (devicePage === "desktop-landscape") return "Desktop landscape";
  if (devicePage === "mobile-safari") return "Mobile Safari";
  return "Mobile";
}
