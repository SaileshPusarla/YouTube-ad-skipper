# ⏭️ YouTube Ad Skipper

A lightweight browser script that automatically skips, mutes, and removes YouTube ads — no bloated extension, no tracking, no nonsense.

Works on **Chrome, Brave, Edge** (as a browser extension) and **Safari** (as a userscript via the Userscripts app).

---

## Features

- ⚡ **Instant skip** — clicks the Skip button the moment it appears
- 🔇 **Auto-mute** — silences the player during ads and restores your volume after
- ⏩ **Force-skip** — fast-forwards unskippable ads to their end so YouTube dismisses them
- 🧹 **Overlay removal** — wipes out banner and overlay ads from the page
- 🔁 **SPA-safe** — handles YouTube's single-page navigation, so no ads slip through when you switch videos

---

## Installation

### Safari (no Xcode needed)

1. Install [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) from the Mac App Store (free)
2. Open Safari → **Settings → Extensions** → enable **Userscripts**
3. Open the Userscripts app and set a folder (e.g. `~/Documents/userscripts`)
4. Drop `yt-ad-skipper.user.js` into that folder
5. Visit YouTube — click the `</>` icon in the toolbar and make sure the toggle is **on** for `youtube.com`

### Chrome / Brave / Edge

1. Download or clone this repo
2. Go to `chrome://extensions` (or `brave://extensions` / `edge://extensions`)
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the `extension/` folder
5. Done — visit YouTube to confirm it's working

---

## Configuration

At the top of `content.js` (extension) or `yt-ad-skipper.user.js` (Safari), you'll find a `CONFIG` block:

```js
const CONFIG = {
  muteAds: true,         // mute video during ads
  fastForwardAds: true,  // jump unskippable ads to their end
  removeOverlays: true,  // remove banner / overlay ad elements
  logToConsole: false,   // set true to see debug logs in DevTools
};
```

Change any value and save. For the Chrome extension, go to `chrome://extensions` and click the **↻ refresh** icon on the card to reload it.

---

## How it works

The script uses two complementary mechanisms running side by side:

**Polling** (every 300 ms) checks whether YouTube's `.ad-showing` class is present on the player. If an ad is detected it tries to click a skip button, mutes the video, fast-forwards if needed, and strips overlay elements from the DOM.

**MutationObserver** watches for new nodes injected into the page so it can react *instantly* when YouTube injects a skip button, without waiting for the next poll cycle.

When the ad ends, both mechanisms detect its absence and restore the original volume automatically.

No data is collected, no requests are made to any external server. Everything runs locally in your browser.

---

## File structure

```
youtube-ad-skipper/
├── extension/               # Chrome / Brave / Edge
│   ├── manifest.json
│   ├── content.js
│   └── icon.png
├── yt-ad-skipper.user.js    # Safari (userscript)
├── LICENSE
└── README.md
```

---

## Legal

Ad-blocking is legal. This project contains only original code — no YouTube source code or assets are used or reproduced. CSS class names (e.g. `.ad-showing`) are not copyrightable.

Using this script may violate [YouTube's Terms of Service](https://www.youtube.com/t/terms). That is a matter between you and YouTube and does not affect the legality of the software itself.

> This project is provided for personal and educational use. The author is not responsible for any account actions taken by YouTube.

---

## License

[MIT](LICENSE)
