const {expect}=require("playwright/test");

const CLOSE_POPUP_TEXT=/^(Đóng|Huỷ|Hủy|Quay về|Quay về trang chủ)$/i;
function safeArtifactName(value){return String(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"artifact";}
async function assertChannelPlayback(page, testInfo, options) {
  await assertPlayback(page, testInfo, {
    label: `Channel "${options.CHANNEL_NAME}"`,
    artifactPrefix: options.CHANNEL_NAME,
  });
}

async function assertMoviePlayback(page, testInfo, options = {}) {
  const label = options.MOVIE_NAME ? `Movie "${options.MOVIE_NAME}"` : "First movie content";

  await assertPlayback(page, testInfo, {
    label,
    artifactPrefix: options.MOVIE_NAME || "first-movie-content",
  });
}

async function assertSearchContentPlayback(page, testInfo, options) {
  await assertPlayback(page, testInfo, {
    label: `Search result for "${options.SEARCH_KEYWORD}"`,
    artifactPrefix: `search-${options.SEARCH_KEYWORD}`,
  });
}

async function assertPlayback(page, testInfo, { label, artifactPrefix }) {
  await page.waitForTimeout(6000);

  const popup = await getVisiblePopup(page);
  if (popup) {
    const playerState = await getPlayerState(page).catch((error) => ({
      hasVideo: false,
      isProbablyPlaying: false,
      reason: error?.message || String(error),
    }));

    await testInfo.attach(`${safeArtifactName(artifactPrefix)}-error-popup.txt`, {
      body: `${label}\n\n${popup.text}`,
      contentType: "text/plain",
    });
    await testInfo.attach(`${safeArtifactName(artifactPrefix)}-error-popup.png`, {
      body: await page.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
    await testInfo.attach(`${safeArtifactName(artifactPrefix)}-error-player-state.json`, {
      body: JSON.stringify({ label, popup, ...playerState }, null, 2),
      contentType: "application/json",
    });

    throw new Error(`${label} playback failed with popup: ${popup.text}`);
  }

  const playerState = await getPlayerState(page);
  await testInfo.attach(`${safeArtifactName(artifactPrefix)}-player-state.json`, {
    body: JSON.stringify({ label, ...playerState }, null, 2),
    contentType: "application/json",
  });

  if (!playerState.hasVideo || !playerState.isProbablyPlaying) {
    await testInfo.attach(`${safeArtifactName(artifactPrefix)}-playback-failure.png`, {
      body: await page.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
    await testInfo.attach(`${safeArtifactName(artifactPrefix)}-playback-failure.txt`, {
      body: [
        `${label} playback did not look healthy.`,
        "",
        `hasVideo: ${playerState.hasVideo}`,
        `isProbablyPlaying: ${playerState.isProbablyPlaying}`,
        `reason: ${playerState.reason || ""}`,
        "",
        JSON.stringify(playerState, null, 2),
      ].join("\n"),
      contentType: "text/plain",
    });
  }

  expect(playerState.hasVideo, "Player video element should exist").toBe(true);
  expect(
    playerState.isProbablyPlaying,
    `Player should be playing normally: ${JSON.stringify(playerState)}`
  ).toBe(true);
}
async function inspectPlaybackAfterWait(page, waitSeconds) {
  await page.waitForTimeout(waitSeconds * 1000);

  const popup = await getVisiblePopup(page);
  const playerState = await getPlayerState(page).catch((error) => ({
    hasVideo: false,
    isProbablyPlaying: false,
    reason: error?.message || String(error),
  }));

  return {
    ok: !popup && playerState.hasVideo && playerState.isProbablyPlaying,
    popup,
    playerState,
  };
}
async function getVisiblePopup(page) {
  return page.evaluate((closePatternSource) => {
    const closePattern = new RegExp(closePatternSource, "i");
    const errorPattern = /lỗi|error|không thể|không phát|thất bại|xin lỗi|vui lòng thử lại/i;
    const elements = Array.from(document.querySelectorAll("body *"));

    const visibleElements = elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0
      );
    });

    const closeButton = visibleElements.find((element) => closePattern.test(elementText(element)));
    const errorElement = visibleElements.find((element) => errorPattern.test(elementText(element)));

    if (!closeButton && !errorElement) return null;

    const root =
      [closeButton, errorElement]
        .filter(Boolean)
        .map((element) => closestPopupRoot(element))
        .sort((a, b) => {
          const aRect = a.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          return bRect.width * bRect.height - aRect.width * aRect.height;
        })[0] ||
      closeButton ||
      errorElement;

    const text = elementText(root) || elementText(errorElement) || elementText(closeButton);

    return {
      text,
      closeText: closeButton ? elementText(closeButton) : "",
    };

    function closestPopupRoot(element) {
      let current = element;
      while (current?.parentElement && current.parentElement !== document.body) {
        if (looksLikePopupRoot(current)) {
          return current;
        }

        const rect = current.getBoundingClientRect();
        const parentRect = current.parentElement.getBoundingClientRect();
        if (
          parentRect.width >= rect.width &&
          parentRect.height >= rect.height &&
          parentRect.width <= window.innerWidth &&
          parentRect.height <= window.innerHeight
        ) {
          current = current.parentElement;
          continue;
        }

        break;
      }

      return current;
    }

    function looksLikePopupRoot(element) {
      const marker = `${element.id || ""} ${element.className || ""} ${element.getAttribute("role") || ""}`;
      return /popup|modal|dialog|toast|alert|message|notify|notification|error/i.test(marker);
    }

    function elementText(element) {
      if (!element) return "";

      const attributeNames = [
        "aria-label",
        "title",
        "button-title",
        "data-title",
        "data-message",
        "message",
        "error-message",
        "description",
        "alt",
      ];
      const nodes = [element, ...Array.from(element.querySelectorAll?.("*") || [])];
      const parts = [];

      for (const node of nodes) {
        parts.push((node.textContent || "").replace(/\s+/g, " ").trim());

        for (const name of attributeNames) {
          const value = node.getAttribute?.(name);
          if (value) parts.push(value.replace(/\s+/g, " ").trim());
        }
      }

      return parts
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(" ")
        .trim();
    }
  }, CLOSE_POPUP_TEXT.source);
}

async function getPlayerState(page) {
  return page.evaluate(async () => {
    const videos = Array.from(document.querySelectorAll("video"));
    const video =
      videos.find((item) => {
        const rect = item.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) || videos[0];

    if (!video) {
      return {
        hasVideo: false,
        isProbablyPlaying: false,
        reason: "No video element found",
      };
    }

    const before = {
      currentTime: video.currentTime,
      paused: video.paused,
      ended: video.ended,
      readyState: video.readyState,
      networkState: video.networkState,
      width: video.videoWidth,
      height: video.videoHeight,
      src: video.currentSrc || video.src || "",
    };

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const after = {
      currentTime: video.currentTime,
      paused: video.paused,
      ended: video.ended,
      readyState: video.readyState,
      networkState: video.networkState,
      width: video.videoWidth,
      height: video.videoHeight,
      src: video.currentSrc || video.src || "",
    };

    const timeAdvanced = after.currentTime > before.currentTime + 0.25;
    const hasFrames = after.width > 0 && after.height > 0;
    const hasEnoughData = after.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

    const isProbablyPlaying = !after.paused && !after.ended && hasEnoughData && (timeAdvanced || hasFrames);

    return {
      hasVideo: true,
      before,
      after,
      timeAdvanced,
      hasFrames,
      hasEnoughData,
      isProbablyPlaying,
      reason: isProbablyPlaying
        ? ""
        : playbackReason({ before, after, timeAdvanced, hasFrames, hasEnoughData }),
    };

    function playbackReason({ before, after, timeAdvanced, hasFrames, hasEnoughData }) {
      if (after.ended) return "Video ended";
      if (after.paused) return "Video element is paused";
      if (!hasEnoughData) return `Video does not have enough data: readyState=${after.readyState}`;
      if (!hasFrames) return `Video has no rendered frames: videoWidth=${after.width}, videoHeight=${after.height}`;
      if (!timeAdvanced) {
        return `Video time did not advance: before=${before.currentTime}, after=${after.currentTime}`;
      }
      return "Video playback state is not healthy";
    }
  });
}


module.exports={assertPlayback,assertChannelPlayback,assertMoviePlayback,assertSearchContentPlayback,getVisiblePopup,getPlayerState,inspectPlaybackAfterWait,safeArtifactName};
