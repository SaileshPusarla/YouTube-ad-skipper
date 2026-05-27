/**
 * YouTube Ad Skipper — content.js
 * Works on Chrome / Brave / Edge (Manifest V3)
 *
 * What it does:
 *  1. Clicks "Skip Ad" the instant it appears
 *  2. Mutes the player during any ad and restores volume after
 *  3. Fast-forwards unskippable ads to their end (forces skip)
 *  4. Removes banner/overlay ads from the page
 *  5. Survives YouTube's SPA navigation (no full page reloads)
 */

(() => {
  "use strict";

  /* ─────────────────────────── CONFIG ─────────────────────────── */
  const CONFIG = {
    muteAds: true,          // mute video during ads
    fastForwardAds: true,   // jump unskippable ads to the very end
    removeOverlays: true,   // remove banner / overlay ad elements
    logToConsole: false,    // set true for debug output
  };

  /* ─────────────────────────── HELPERS ─────────────────────────── */
  const log = (...args) => CONFIG.logToConsole && console.log("[AdSkipper]", ...args);

  let savedVolume = null;   // remember volume so we can restore it
  let observerStarted = false;

  /* ─────────────────────────── AD SELECTORS ────────────────────── */
  // Skip-button selectors (YouTube tests multiple class names)
  const SKIP_BTN_SELECTORS = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    "[class*='skip-ad']",
    "[class*='skip_ad']",
  ];

  // Overlay / banner ad selectors
  const OVERLAY_SELECTORS = [
    ".ytp-ad-overlay-container",
    ".ytp-ad-text-overlay",
    ".ytp-ad-image-overlay",
    ".ytp-ad-overlay-close-button",
    "#masthead-ad",
    ".ytd-display-ad-renderer",
    "ytd-display-ad-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-promoted-video-renderer",
    "ytd-search-pyv-renderer",
    ".ytd-banner-promo-renderer",
    "#player-ads",
    "ytd-player-legacy-desktop-watch-ads-renderer",
  ];

  /* ─────────────────────────── CORE LOGIC ──────────────────────── */

  /**
   * Returns the main <video> element on the page (if any).
   */
  function getVideo() {
    return document.querySelector("video.html5-main-video") ||
           document.querySelector("video");
  }

  /**
   * Returns true when an ad is currently playing.
   * YouTube sets .ad-showing on the player container.
   */
  function isAdPlaying() {
    return !!(
      document.querySelector(".ad-showing") ||
      document.querySelector(".ytp-ad-player-overlay")
    );
  }

  /**
   * Try to click every possible skip button variant.
   */
  function clickSkipButton() {
    for (const sel of SKIP_BTN_SELECTORS) {
      const btn = document.querySelector(sel);
      if (btn && btn.offsetParent !== null) {   // only if visible
        log("Clicking skip button:", sel);
        btn.click();
        return true;
      }
    }
    return false;
  }

  /**
   * Mute the player and remember the previous volume.
   */
  function mutePlayer(video) {
    if (!video || video.muted) return;
    savedVolume = video.volume;
    video.muted = true;
    video.volume = 0;
    log("Muted ad (saved volume:", savedVolume, ")");
  }

  /**
   * Restore volume after the ad finishes.
   */
  function unmutePlayer(video) {
    if (!video || !video.muted) return;
    video.muted = false;
    if (savedVolume !== null) {
      video.volume = savedVolume;
      log("Unmuted — restored volume:", savedVolume);
      savedVolume = null;
    }
  }

  /**
   * Jump the video to its very end so YouTube's own skip logic fires.
   * Only used for unskippable ads when no skip button is present.
   */
  function fastForwardAd(video) {
    if (!video || !isFinite(video.duration) || video.duration <= 0) return;
    if (video.currentTime < video.duration - 0.1) {
      log("Fast-forwarding ad to end (duration:", video.duration, ")");
      video.currentTime = video.duration;
    }
  }

  /**
   * Remove overlay / banner ad DOM nodes.
   */
  function removeOverlayAds() {
    for (const sel of OVERLAY_SELECTORS) {
      document.querySelectorAll(sel).forEach(el => {
        log("Removing overlay element:", sel);
        el.remove();
      });
    }
  }

  /**
   * Main handler — called repeatedly while an ad is active.
   */
  function handleAd() {
    if (!isAdPlaying()) return;

    const video = getVideo();

    // 1. Try to skip immediately
    const skipped = clickSkipButton();

    // 2. Mute while the ad plays
    if (CONFIG.muteAds && video) mutePlayer(video);

    // 3. Fast-forward unskippable ads
    if (!skipped && CONFIG.fastForwardAds && video) fastForwardAd(video);

    // 4. Nuke overlay banners
    if (CONFIG.removeOverlays) removeOverlayAds();
  }

  /**
   * Called when an ad ends (or we detect .ad-showing is gone).
   */
  function handleAdEnd() {
    const video = getVideo();
    if (CONFIG.muteAds && video) unmutePlayer(video);
    if (CONFIG.removeOverlays) removeOverlayAds(); // final cleanup
    log("Ad ended — playback restored.");
  }

  /* ─────────────────────────── POLLING ─────────────────────────── */
  // Poll every 300 ms — cheap and reliable across YouTube's SPA navigation.
  let wasAdPlaying = false;

  function poll() {
    const adNow = isAdPlaying();

    if (adNow) {
      wasAdPlaying = true;
      handleAd();
    } else if (wasAdPlaying) {
      // Ad just ended
      wasAdPlaying = false;
      handleAdEnd();
    }
  }

  /* ─────────────────────────── MUTATION OBSERVER ──────────────────
   * Watches for skip buttons injected into the DOM.
   * Complements polling for instant reaction.
   */
  function startObserver() {
    if (observerStarted) return;
    observerStarted = true;

    const observer = new MutationObserver(() => {
      if (isAdPlaying()) handleAd();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    log("MutationObserver started.");
  }

  /* ─────────────────────────── TAB VISIBILITY ─────────────────────
   * YouTube reloads ads when you switch back to its tab.
   * Re-run the handler the moment the tab becomes visible again.
   */
  function onVisibilityChange() {
    if (document.visibilityState === "visible") {
      log("Tab became visible — checking for ads.");
      // Burst-check for 3 seconds to catch the ad that loads on return
      let checks = 0;
      const burst = setInterval(() => {
        handleAd();
        if (++checks >= 10) clearInterval(burst);
      }, 300);
    }
  }

  /* ─────────────────────────── YOUTUBE NAVIGATION EVENTS ──────────
   * YouTube fires these custom events on every in-app navigation
   * (clicking a video, search result, etc.). Catching them lets us
   * handle ads that load fresh after each navigation.
   */
  function onYTNavigate() {
    log("YouTube navigation detected — resetting ad state.");
    wasAdPlaying = false;
    savedVolume = null;
    // Burst-check after navigation to catch pre-roll ads
    let checks = 0;
    const burst = setInterval(() => {
      handleAd();
      if (++checks >= 20) clearInterval(burst);  // check for 6 s
    }, 300);
  }

  /* ─────────────────────────── STARTUP BURST ──────────────────────
   * On first page load YouTube serves a pre-roll ad almost immediately.
   * Run a dense burst of checks for the first 10 seconds to catch it,
   * before the regular 300 ms poll takes over.
   */
  function startupBurst() {
    log("Running startup burst checks.");
    let checks = 0;
    const burst = setInterval(() => {
      handleAd();
      if (++checks >= 33) clearInterval(burst); // ~10 s at 300 ms
    }, 300);
  }

  /* ─────────────────────────── INIT ────────────────────────────── */
  function init() {
    log("YouTube Ad Skipper initialised.");
    startObserver();
    setInterval(poll, 300);
    startupBurst();

    // Tab switching
    document.addEventListener("visibilitychange", onVisibilityChange);

    // YouTube's own SPA navigation events
    document.addEventListener("yt-navigate-finish", onYTNavigate);
    document.addEventListener("yt-page-data-updated", onYTNavigate);
  }

  // Start after the page is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
