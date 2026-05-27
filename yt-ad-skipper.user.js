// ==UserScript==
// @name         YouTube Ad Skipper
// @namespace    https://github.com/local/yt-ad-skipper
// @version      1.0.0
// @description  Automatically skips, mutes, and removes YouTube ads
// @author       You
// @match        *://*.youtube.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  /* ─────────────────────────── CONFIG ─────────────────────────── */
  const CONFIG = {
    muteAds: true,         // mute video during ads
    fastForwardAds: true,  // jump unskippable ads to their end
    removeOverlays: true,  // remove banner / overlay ad elements
    logToConsole: false,   // set true for debug output in Safari DevTools
  };

  /* ─────────────────────────── HELPERS ─────────────────────────── */
  const log = (...args) => CONFIG.logToConsole && console.log("[AdSkipper]", ...args);

  let savedVolume = null;
  let observerStarted = false;

  /* ─────────────────────────── AD SELECTORS ────────────────────── */
  const SKIP_BTN_SELECTORS = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    "[class*='skip-ad']",
    "[class*='skip_ad']",
  ];

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

  function getVideo() {
    return document.querySelector("video.html5-main-video") ||
           document.querySelector("video");
  }

  function isAdPlaying() {
    return !!(
      document.querySelector(".ad-showing") ||
      document.querySelector(".ytp-ad-player-overlay")
    );
  }

  function clickSkipButton() {
    for (const sel of SKIP_BTN_SELECTORS) {
      const btn = document.querySelector(sel);
      if (btn && btn.offsetParent !== null) {
        log("Clicking skip button:", sel);
        btn.click();
        return true;
      }
    }
    return false;
  }

  function mutePlayer(video) {
    if (!video || video.muted) return;
    savedVolume = video.volume;
    video.muted = true;
    video.volume = 0;
    log("Muted ad (saved volume:", savedVolume, ")");
  }

  function unmutePlayer(video) {
    if (!video || !video.muted) return;
    video.muted = false;
    if (savedVolume !== null) {
      video.volume = savedVolume;
      log("Unmuted — restored volume:", savedVolume);
      savedVolume = null;
    }
  }

  function fastForwardAd(video) {
    if (!video || !isFinite(video.duration) || video.duration <= 0) return;
    if (video.currentTime < video.duration - 0.1) {
      log("Fast-forwarding ad to end (duration:", video.duration, ")");
      video.currentTime = video.duration;
    }
  }

  function removeOverlayAds() {
    for (const sel of OVERLAY_SELECTORS) {
      document.querySelectorAll(sel).forEach(el => {
        log("Removing overlay element:", sel);
        el.remove();
      });
    }
  }

  function handleAd() {
    if (!isAdPlaying()) return;
    const video = getVideo();
    const skipped = clickSkipButton();
    if (CONFIG.muteAds && video) mutePlayer(video);
    if (!skipped && CONFIG.fastForwardAds && video) fastForwardAd(video);
    if (CONFIG.removeOverlays) removeOverlayAds();
  }

  function handleAdEnd() {
    const video = getVideo();
    if (CONFIG.muteAds && video) unmutePlayer(video);
    if (CONFIG.removeOverlays) removeOverlayAds();
    log("Ad ended — playback restored.");
  }

  /* ─────────────────────────── POLLING ─────────────────────────── */
  let wasAdPlaying = false;

  function poll() {
    const adNow = isAdPlaying();
    if (adNow) {
      wasAdPlaying = true;
      handleAd();
    } else if (wasAdPlaying) {
      wasAdPlaying = false;
      handleAdEnd();
    }
  }

  /* ─────────────────────────── MUTATION OBSERVER ─────────────────*/
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
      let checks = 0;
      const burst = setInterval(() => {
        handleAd();
        if (++checks >= 10) clearInterval(burst);
      }, 300);
    }
  }

  /* ─────────────────────────── YOUTUBE NAVIGATION EVENTS ──────────
   * YouTube fires these custom events on every in-app navigation.
   * Catching them lets us handle ads that load after each navigation.
   */
  function onYTNavigate() {
    log("YouTube navigation detected — resetting ad state.");
    wasAdPlaying = false;
    savedVolume = null;
    let checks = 0;
    const burst = setInterval(() => {
      handleAd();
      if (++checks >= 20) clearInterval(burst);  // check for 6 s
    }, 300);
  }

  /* ─────────────────────────── INIT ────────────────────────────── */
  function init() {
    log("YouTube Ad Skipper initialised.");
    startObserver();
    setInterval(poll, 300);

    // Tab switching
    document.addEventListener("visibilitychange", onVisibilityChange);

    // YouTube's own SPA navigation events
    document.addEventListener("yt-navigate-finish", onYTNavigate);
    document.addEventListener("yt-page-data-updated", onYTNavigate);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
