// check_poster_images: walks every row of the current page with the remote and
// reports each poster whose image is broken. A poster is broken when its image
// failed to load, or when the app swapped in its own "no image" placeholder
// (build-app/images/no-image-channel.png, no-image-movie.png) - the app does
// that from the image's error handler, so the placeholder is a load failure too.
//
// Rows scrolled past are detached from the DOM and the next rows are rendered
// while focus approaches them, so the page cannot be read in one pass: every
// remote step is observed and the verdicts are accumulated by poster id.
const navigation = require("./navigation");

const POSTER_CARD_SELECTOR = ".cate_content_item, .homepage_channel_item";
const POSTER_ROW_SELECTOR = ".cate_content_row, .channellist_item_row_new";
const POSTER_ROW_TITLE_SELECTOR = ".cate_content_row_title";
const PLACEHOLDER_IMAGE_PATTERN = /(?:^|\/)no-image-(?:channel|movie)\.png(?:$|[?#])/iu;
const CARD_LABEL_ATTRIBUTES = Object.freeze([
  "title_text",
  "title",
  "content_name",
  "channel_name",
  "movie_name",
  "vod_name",
  "service_title",
  "service_name",
  "cate_name",
]);
// Badges, logos and rating icons share the card with the poster; they are
// smaller than this, so the poster is the largest image of the card.
const MIN_POSTER_IMAGE_SIDE_PX = 40;
const DEFAULT_IMAGE_LOAD_TIMEOUT_MS = 8000;
const IMAGE_LOAD_POLL_MS = 300;
const VERTICAL_STEP_DELAY_MS = 1000;
const HORIZONTAL_STEP_DELAY_MS = 400;
// Home's last row answers Down with nothing; the page may still be fetching
// the next batch of rows, so a few idle presses are allowed before the end is
// accepted. A service page wraps instead: Down on its last row focuses the
// first row again, which is caught by the visited-row check, not by idling.
const END_OF_PAGE_IDLE_PRESSES = 3;
const MAX_VERTICAL_STEPS = 150;
const MAX_HORIZONTAL_STEPS_PER_ROW = 120;
const FOCUS_ENTRY_MAX_PRESSES = 6;

const FAILED_STATUSES = new Set(["broken", "placeholder"]);
const REASON_LABELS = Object.freeze({
  load_failed: "hình không tải được",
  placeholder: "hiển thị hình mặc định no-image",
  missing_src: "poster không có đường dẫn hình",
  timeout: "hình không tải xong",
});

function delay(page, ms) {
  if (typeof page?.waitForTimeout === "function") return page.waitForTimeout(ms);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One read of every poster currently in the DOM. Pending means "no verdict
// yet": the image is still loading, or the card has not been given a source
// because it is far outside the viewport.
async function observePosterImages(page) {
  return page.evaluate((config) => {
    const placeholder = new RegExp(config.placeholderSource, config.placeholderFlags);
    const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
    const compact = (value) => String(value || "").replace(/\s+/gu, " ").trim();
    const probes = (window.__mytvPosterImageProbes ||= new Map());

    const isRendered = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 &&
        style.display !== "none" && style.visibility !== "hidden";
    };
    const inViewport = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.right > 0 && rect.bottom > 0 && rect.left < viewportWidth && rect.top < viewportHeight;
    };
    const cssUrl = (value) => String(value || "").match(/url\(["']?(.+?)["']?\)/u)?.[1] || "";

    // A background poster has no load state of its own; an Image probe of the
    // same URL answers whether the browser can load it.
    const probeBackground = (url) => {
      if (!probes.has(url)) {
        probes.set(url, "pending");
        const probe = new Image();
        probe.onload = () => probes.set(url, probe.naturalWidth > 0 ? "ok" : "broken");
        probe.onerror = () => probes.set(url, "broken");
        probe.src = url;
      }
      return probes.get(url);
    };

    const posterImage = (card) => {
      const images = Array.from(card.querySelectorAll("img")).filter((image) => {
        const rect = image.getBoundingClientRect();
        return getComputedStyle(image).display !== "none" &&
          (rect.width >= config.minSide || rect.height >= config.minSide || (rect.width === 0 && rect.height === 0));
      });
      if (!images.length) return null;
      return images.reduce((best, image) => {
        const area = (element) => {
          const rect = element.getBoundingClientRect();
          return rect.width * rect.height;
        };
        return area(image) > area(best) ? image : best;
      });
    };

    const verdict = (card) => {
      const image = posterImage(card);
      if (image) {
        const src = image.currentSrc || image.getAttribute("src") || "";
        if (placeholder.test(src)) return {src, status: "placeholder", reason: "placeholder"};
        if (!src.trim()) return {src, status: "pending", reason: "missing_src"};
        if (!image.complete) return {src, status: "pending", reason: "timeout"};
        if (image.naturalWidth === 0) return {src, status: "broken", reason: "load_failed"};
        return {src, status: "ok", reason: ""};
      }

      const backgroundHolder = [card, ...card.querySelectorAll("*")]
        .find((element) => cssUrl(getComputedStyle(element).backgroundImage));
      const src = backgroundHolder ? cssUrl(getComputedStyle(backgroundHolder).backgroundImage) : "";
      if (!src) return {src, status: "pending", reason: "missing_src"};
      if (placeholder.test(src)) return {src, status: "placeholder", reason: "placeholder"};
      const probe = probeBackground(src);
      if (probe === "pending") return {src, status: "pending", reason: "timeout"};
      return probe === "ok"
        ? {src, status: "ok", reason: ""}
        : {src, status: "broken", reason: "load_failed"};
    };

    const cardName = (card) => {
      for (const name of config.labelAttributes) {
        const value = compact(card.getAttribute(name));
        if (value) return value;
      }
      const image = card.querySelector("img");
      return compact(image?.getAttribute("alt")) || compact(image?.getAttribute("title")) || compact(card.textContent);
    };

    const focused = (() => {
      const byClass = Array.from(document.querySelectorAll(".focused")).find(isRendered);
      if (byClass) return byClass;
      return Array.from(document.querySelectorAll('[is_focus="1"]')).find(isRendered) || null;
    })();
    const focusedCard = focused?.closest(config.cardSelector) || focused?.querySelector?.(config.cardSelector) || null;
    const focusedRow = focusedCard?.closest(config.rowSelector) || null;

    const cards = Array.from(document.querySelectorAll(config.cardSelector))
      .filter((card) => !card.parentElement?.closest(config.cardSelector) && isRendered(card))
      .map((card, index) => {
        const row = card.closest(config.rowSelector);
        const rowId = row?.id || "";
        return {
          key: card.id || `${rowId}#${index}`,
          id: card.id || "",
          rowId,
          rowTitle: compact(row?.querySelector(config.rowTitleSelector)?.textContent),
          name: cardName(card),
          contentId: card.getAttribute("content_id") || card.getAttribute("content-id") ||
            card.getAttribute("data-content-id") || "",
          inViewport: inViewport(card),
          ...verdict(card),
        };
      });

    return {
      route: location.hash.replace(/^#/u, "").split("?")[0],
      focusedId: focused?.id || "",
      focusedCardId: focusedCard?.id || "",
      focusedRowId: focusedRow?.id || "",
      rowIds: Array.from(new Set(cards.map((card) => card.rowId).filter(Boolean))),
      cards,
    };
  }, {
    cardSelector: POSTER_CARD_SELECTOR,
    rowSelector: POSTER_ROW_SELECTOR,
    rowTitleSelector: POSTER_ROW_TITLE_SELECTOR,
    placeholderSource: PLACEHOLDER_IMAGE_PATTERN.source,
    placeholderFlags: PLACEHOLDER_IMAGE_PATTERN.flags,
    labelAttributes: CARD_LABEL_ATTRIBUTES,
    minSide: MIN_POSTER_IMAGE_SIDE_PX,
  });
}

// Waits for the on-screen posters to reach a verdict. Whatever is still
// loading on screen after the timeout is what a viewer would see as broken.
async function observeSettledPosterImages(page, {timeoutMs = DEFAULT_IMAGE_LOAD_TIMEOUT_MS} = {}) {
  const deadline = Date.now() + timeoutMs;
  let observation = await observePosterImages(page);
  while (observation.cards.some((card) => card.inViewport && card.status === "pending") && Date.now() < deadline) {
    await delay(page, Math.min(IMAGE_LOAD_POLL_MS, Math.max(0, deadline - Date.now())));
    observation = await observePosterImages(page);
  }

  observation.cards = observation.cards.map((card) => (
    card.inViewport && card.status === "pending" ? {...card, status: "broken"} : card
  ));
  return observation;
}

function createPosterLedger() {
  const posters = new Map();
  const rows = new Map();

  return {
    record(observation) {
      for (const card of observation.cards) {
        if (card.rowId && !rows.has(card.rowId)) rows.set(card.rowId, card.rowTitle);
        const previous = posters.get(card.key);
        // A failure a viewer saw stays a failure; "ok" only replaces a
        // poster that had no verdict yet.
        if (previous && (FAILED_STATUSES.has(previous.status) || card.status === "pending")) continue;
        posters.set(card.key, {...card, order: previous?.order ?? posters.size});
      }
    },
    hasPendingInRow(observation, rowId) {
      return Boolean(rowId) && observation.cards.some((card) =>
        card.rowId === rowId && posters.get(card.key)?.status === "pending"
      );
    },
    posters: () => [...posters.values()].sort((a, b) => a.order - b.order),
    rowCount: () => rows.size,
  };
}

async function focusFirstPoster(page, observation) {
  if (observation.focusedCardId) return observation;

  const target = observation.cards.find((card) => card.inViewport && card.id);
  if (target) {
    try {
      await navigation.remoteFocusById(page, target.id, 60);
      return observePosterImages(page);
    } catch {
      // Fall through to plain Down presses from wherever the focus is.
    }
  }

  let current = observation;
  for (let press = 0; press < FOCUS_ENTRY_MAX_PRESSES && !current.focusedCardId; press += 1) {
    await navigation.remotePress(page, "ArrowDown", VERTICAL_STEP_DELAY_MS);
    current = await observePosterImages(page);
  }
  return current;
}

// Posters far to the right of a carousel may never be given an image until
// the row scrolls to them, so a row with posters still waiting is walked to
// its end before moving on.
async function walkFocusedRow(page, ledger, observation, options) {
  const rowId = observation.focusedRowId;
  const visitedCards = new Set([observation.focusedCardId]);
  let current = observation;
  for (let step = 0; step < MAX_HORIZONTAL_STEPS_PER_ROW && ledger.hasPendingInRow(current, rowId); step += 1) {
    await navigation.remotePress(page, "ArrowRight", HORIZONTAL_STEP_DELAY_MS);
    current = await observeSettledPosterImages(page, options);
    ledger.record(current);
    // No move, a move out of the row, or a wrap back to a poster already
    // passed: the row has no more posters to the right.
    if (!current.focusedCardId || visitedCards.has(current.focusedCardId) || current.focusedRowId !== rowId) break;
    visitedCards.add(current.focusedCardId);
  }
  return current;
}

function stepSignature(observation) {
  return `${observation.focusedId}|${observation.rowIds.join(",")}`;
}

// Down moved focus back onto a row (or, without row ids, a poster) that the
// walk already left: the page wrapped from its last row to the top.
function wrappedToVisitedRow(before, after, visited) {
  if (after.focusedRowId) {
    return after.focusedRowId !== before.focusedRowId && visited.rows.has(after.focusedRowId);
  }
  return Boolean(after.focusedCardId) &&
    after.focusedCardId !== before.focusedCardId && visited.cards.has(after.focusedCardId);
}

function describeBrokenPosters(failed) {
  const listed = failed
    .map((poster) => `${poster.id || "(không có id)"} - ${poster.name || "(không có tên)"}`)
    .join("; ");
  return `Có ${failed.length} poster bị lỗi hình: ${listed}`;
}

async function checkPagePosterImages(page, testInfo, options = {}) {
  const settleOptions = {timeoutMs: options.imageLoadTimeoutMs ?? DEFAULT_IMAGE_LOAD_TIMEOUT_MS};
  const ledger = createPosterLedger();

  let observation = await observeSettledPosterImages(page, settleOptions);
  const route = observation.route;
  ledger.record(observation);
  observation = await focusFirstPoster(page, observation);

  const visited = {rows: new Set(), cards: new Set()};
  let idlePresses = 0;
  let endReason = "max_steps";
  for (let step = 0; step < MAX_VERTICAL_STEPS; step += 1) {
    observation = await observeSettledPosterImages(page, settleOptions);
    ledger.record(observation);
    if (observation.focusedRowId) visited.rows.add(observation.focusedRowId);
    if (observation.focusedCardId) visited.cards.add(observation.focusedCardId);
    observation = await walkFocusedRow(page, ledger, observation, settleOptions);
    if (observation.focusedCardId) visited.cards.add(observation.focusedCardId);

    await navigation.remotePress(page, "ArrowDown", VERTICAL_STEP_DELAY_MS);
    const next = await observePosterImages(page);
    if (wrappedToVisitedRow(observation, next, visited)) {
      endReason = "wrapped";
      break;
    }
    idlePresses = stepSignature(next) === stepSignature(observation) ? idlePresses + 1 : 0;
    if (idlePresses >= END_OF_PAGE_IDLE_PRESSES) {
      endReason = "last_row";
      break;
    }
  }
  // After a wrap the screen shows the top rows again, already checked.
  if (endReason !== "wrapped") ledger.record(await observeSettledPosterImages(page, settleOptions));

  const posters = ledger.posters();
  if (!posters.length) {
    throw new Error("Không tìm thấy poster nào trên trang để kiểm tra hình.");
  }

  const failed = posters.filter((poster) => FAILED_STATUSES.has(poster.status));
  const result = {
    type: "check_poster_images",
    route,
    rowCount: ledger.rowCount(),
    endReason,
    checkedCount: posters.filter((poster) => poster.status !== "pending").length,
    // Posters that never received an image while the page was walked. They
    // are listed for the record but no viewer saw them broken.
    uncheckedCount: posters.filter((poster) => poster.status === "pending").length,
    brokenCount: failed.length,
    results: failed.map((poster, index) => ({
      index: index + 1,
      id: poster.id,
      name: poster.name,
      contentId: poster.contentId,
      rowTitle: poster.rowTitle,
      poster: poster.src,
      status: "failed",
      reason: REASON_LABELS[poster.reason] || poster.reason,
    })),
  };

  if (testInfo && typeof testInfo.attach === "function") {
    await testInfo.attach("poster-image-check.json", {
      body: JSON.stringify(result, null, 2),
      contentType: "application/json",
    }).catch(() => {});
  }

  if (failed.length) {
    const error = new Error(describeBrokenPosters(failed));
    error.details = result;
    throw error;
  }
  return result;
}

module.exports = {
  checkPagePosterImages,
  observePosterImages,
  __internal: {
    PLACEHOLDER_IMAGE_PATTERN,
    createPosterLedger,
    describeBrokenPosters,
    observeSettledPosterImages,
  },
};
