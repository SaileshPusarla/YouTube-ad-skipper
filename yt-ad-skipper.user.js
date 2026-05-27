// ==UserScript==
// @name         YouTube Ad Skipper
// @namespace    https://github.com/local/yt-ad-skipper
// @version      1.3.0
// @description  Automatically skips, mutes, and removes YouTube ads
// @author       You
// @match        *://*.youtube.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  /* ─────────────────────────── CONFIG ─────────────────────────── */
  const CONFIG = {
    muteAds: true,
    fastForwardAds: true,
    removeOverlays: true,
    pollInterval: 100,     // ms — faster than before (was 300)
    logToConsole: false,
  };

  const log = (...args) => CONFIG.logToConsole && console.log("[AdSkipper]", ...args);

  let savedVolume = null;
  let wasAdPlaying = false;
  let observerStarted = false;

  /* ─────────────────────────── AD DETECTION ────────────────────── */
  // Every class YouTube has ever used to signal an active ad
  const AD_PLAYING_SELECTORS = [
    ".ad-showing",
    ".ytp-ad-player-overlay",
    ".ytp-ad-module",
    ".ytp-ad-overlay-container",
  ];

  function isAdPlaying() {
    return AD_PLAYING_SELECTORS.some(sel => !!document.querySelector(sel));
  }

  /* ─────────────────────────── SKIP BUTTON ─────────────────────── */
  const SKIP_BTN_SELECTORS = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-ad-skip-button-slot button",
    "[class*='skip-ad']",
    "[class*='skip_ad']",
  ];

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

  /* ─────────────────────────── OVERLAY ADS ─────────────────────── */
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

  function removeOverlayAds() {
    OVERLAY_SELECTORS.forEach(sel =>
      document.querySelectorAll(sel).forEach(el => {
        log("Removing overlay:", sel);
        el.remove();
      })
    );
  }

  /* ─────────────────────────── PLAYER ──────────────────────────── */
  function getVideo() {
    return (
      document.querySelector("video.html5-main-video") ||
      document.querySelector("video")
    );
  }

  function mutePlayer(video) {
    if (!video || video.muted) return;
    savedVolume = video.volume;
    video.muted = true;
    video.volume = 0;
    log("Muted (saved volume:", savedVolume, ")");
  }

  function unmutePlayer(video) {
    if (!video || !video.muted) return;
    video.muted = false;
    if (savedVolume !== null) {
      video.volume = savedVolume;
      savedVolume = null;
    }
    log("Unmuted");
  }

  function fastForwardAd(video) {
    if (!video || !isFinite(video.duration) || video.duration <= 0) return;
    if (video.currentTime < video.duration - 0.1) {
      log("Fast-forwarding to end");
      video.currentTime = video.duration;
    }
  }

  /* ─────────────────────────── CORE HANDLER ────────────────────── */
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
    log("Ad ended.");
  }

  /* ─────────────────────────── BURST HELPER ────────────────────── */
  // Run handleAd rapidly for `durationMs` milliseconds
  function burst(durationMs = 6000) {
    let elapsed = 0;
    const id = setInterval(() => {
      handleAd();
      elapsed += CONFIG.pollInterval;
      if (elapsed >= durationMs) clearInterval(id);
    }, CONFIG.pollInterval);
  }

  /* ─────────────────────────── POLL ────────────────────────────── */
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

  /* ─────────────────────────── OBSERVER ────────────────────────── */
  function startObserver() {
    if (observerStarted || !document.body) return;
    observerStarted = true;
    new MutationObserver(() => {
      if (isAdPlaying()) handleAd();
    }).observe(document.body, { childList: true, subtree: true });
    log("Observer started.");
  }

  /* ─────────────────────────── EVENTS ──────────────────────────── */
  // yt-ad-impression fires the INSTANT YouTube decides to show an ad —
  // earlier than any DOM change, making it the fastest possible trigger.
  const YT_AD_EVENTS = [
    "yt-ad-impression",          // ad starts (most important)
    "yt-navigate-finish",        // SPA navigation complete
    "yt-page-data-updated",      // page data refreshed
    "yt-page-data-fetched",      // data fetched (earlier than finish)
    "yt-player-updated",         // player re-initialised
  ];

  function onYTNavigate() {
    log("YouTube event — resetting + burst.");
    wasAdPlaying = false;
    savedVolume = null;
    burst(8000);
  }

  function onAdImpression() {
    log("yt-ad-impression fired — handling immediately.");
    // React right away, then keep checking for the skip button
    handleAd();
    burst(6000);
  }

  /* ─────────────────────────── INIT ────────────────────────────── */
  function init() {
    log("YouTube Ad Skipper v1.3.0 ready.");

    startObserver();
    setInterval(poll, CONFIG.pollInterval);

    // Startup — YouTube often fires a pre-roll within the first few seconds
    burst(12000);

    // Also catch it after full load (Safari sometimes needs this)
    window.addEventListener("load", () => burst(8000), { once: true });

    // Tab switching
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        log("Tab visible — burst.");
        burst(5000);
      }
    });

    // YouTube internal events
    document.addEventListener("yt-ad-impression",    onAdImpression);
    document.addEventListener("yt-navigate-finish",  onYTNavigate);
    document.addEventListener("yt-page-data-updated", onYTNavigate);
    document.addEventListener("yt-page-data-fetched", onYTNavigate);
    document.addEventListener("yt-player-updated",   onYTNavigate);
  }

  // document-start means body may not exist yet — wait for DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
