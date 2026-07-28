"use strict";

const {normalizeVietnameseText} = require("../text-utils");

const FOCUS_SELECTORS = [".focused", '[data-focused="true"]', ".active"];
const CONTENT_TYPES = new Set(["channel", "movie", "content"]);

function semanticError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

function visibleElement(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
}

function focusProbeScript() {
  return `return (function(){
    /* MYTV_TRUSTED_FOCUS */
    var selectors = ${JSON.stringify(FOCUS_SELECTORS)};
    var focused = null;
    for (var index = 0; index < selectors.length && !focused; index += 1) {
      var candidates = document.querySelectorAll(selectors[index]);
      for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
        var candidate = candidates[candidateIndex];
        var rect = candidate.getBoundingClientRect();
        var style = getComputedStyle(candidate);
        if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') { focused = candidate; break; }
      }
    }
    if (!focused) return {id:'', text:'', rect:{x:0,y:0,width:0,height:0}};
    var bounds = focused.getBoundingClientRect();
    return {id: focused.id || '', text: (focused.textContent || '').replace(/\\s+/g, ' ').trim(), rect:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height}};
  })();`;
}

function elementRectScript(id) {
  return `return (function(){
    /* MYTV_TRUSTED_RECT */
    var element = document.getElementById(${JSON.stringify(id)});
    if (!element) return null;
    var rect = element.getBoundingClientRect();
    var style = getComputedStyle(element);
    if (rect.width <= 0 || rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden') return null;
    return {x:rect.x,y:rect.y,width:rect.width,height:rect.height};
  })();`;
}

function visibleTextScript(text) {
  return `return (function(){
    /* MYTV_TRUSTED_VISIBLE_TEXT */
    var expected = ${JSON.stringify(String(text || ""))};
    var nodes = document.querySelectorAll('body *');
    for (var index = 0; index < nodes.length; index += 1) {
      var element = nodes[index];
      var rect = element.getBoundingClientRect();
      var style = getComputedStyle(element);
      var observed = (element.textContent || '').replace(/\\s+/g, ' ').trim();
      if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && observed === expected && element.id) return element.id;
    }
    return '';
  })();`;
}

function bodyTextScript() {
  return "return (document.body && document.body.innerText) || '';";
}

function searchMenuScript() {
  return `return (function(){
    /* MYTV_TRUSTED_SEARCH_MENU */
    var labels = document.querySelectorAll('[id^="menu_text_"]');
    for (var index = 0; index < labels.length; index += 1) {
      var label = labels[index];
      if ((label.textContent || '').replace(/\\s+/g, ' ').trim() !== 'Tìm kiếm') continue;
      var rect = label.getBoundingClientRect(); var style = getComputedStyle(label);
      if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') return label.id.replace(/^menu_text_/, 'menu_item_');
    }
    var fallback = document.getElementById('menu_item_search');
    return fallback ? fallback.id : '';
  })();`;
}

function searchCandidatesScript() {
  return `return (function(){
    /* MYTV_TRUSTED_SEARCH_CANDIDATES */
    var root = document.querySelector('#clip_search_content #clip_item_row #clip_item_row_move_grid_ver_container');
    if (!root) return [];
    var elements = root.querySelectorAll('[id]'); var results = [];
    for (var index = 0; index < elements.length; index += 1) {
      var element = elements[index]; var rect = element.getBoundingClientRect(); var style = getComputedStyle(element);
      if (rect.width < 120 || rect.height < 80 || style.display === 'none' || style.visibility === 'hidden') continue;
      if (/^(key-|menu_)/.test(element.id) || /keyboard/.test(element.id)) continue;
      var fields = [element.textContent || '', element.getAttribute('title') || '', element.getAttribute('title_text') || '', element.getAttribute('movie_name') || '', element.getAttribute('vod_name') || '', element.getAttribute('content_name') || '', element.getAttribute('channel_name') || ''];
      var label = fields.join(' ').replace(/\\s+/g, ' ').trim();
      if (!label) continue;
      results.push({id:element.id,label:label,type:element.getAttribute('channel_name') ? 'channel' : ((element.getAttribute('movie_name') || element.getAttribute('vod_name')) ? 'movie' : '')});
    }
    return results;
  })();`;
}

function playerStateScript() {
  return `return (function(){
    /* MYTV_TRUSTED_PLAYER */
    var videos = document.querySelectorAll('video'); var video = null;
    for (var index = 0; index < videos.length; index += 1) { if (videos[index].getBoundingClientRect().width > 0) { video = videos[index]; break; } }
    if (!video) return {hasVideo:false,currentTime:0,paused:true,ended:false,readyState:0,width:0,height:0};
    return {hasVideo:true,currentTime:Number(video.currentTime || 0),paused:Boolean(video.paused),ended:Boolean(video.ended),readyState:Number(video.readyState || 0),width:Number(video.videoWidth || 0),height:Number(video.videoHeight || 0)};
  })();`;
}

function chooseDirection(from, to) {
  const fromCenter = {x: from.x + from.width / 2, y: from.y + from.height / 2};
  const toCenter = {x: to.x + to.width / 2, y: to.y + to.height / 2};
  const horizontal = Math.abs(toCenter.x - fromCenter.x) >= Math.abs(toCenter.y - fromCenter.y);
  return horizontal ? (toCenter.x >= fromCenter.x ? "ArrowRight" : "ArrowLeft") : (toCenter.y >= fromCenter.y ? "ArrowDown" : "ArrowUp");
}

function fallbackDirection(key) {
  return {ArrowRight: "ArrowDown", ArrowDown: "ArrowRight", ArrowLeft: "ArrowUp", ArrowUp: "ArrowLeft"}[key];
}

function keyIds(character) {
  const mapping = {".": ["key-dot-v2"], " ": ["key-space-v2", "space"], "-": ["key-dash-v2"], "_": ["key-underline-v2"]};
  return mapping[character] || [`key-${String(character).toLowerCase()}-v2`];
}

function scoreCandidate(label, name) {
  const candidate = normalizeVietnameseText(label);
  const expected = normalizeVietnameseText(name);
  if (!candidate || !expected) return 0;
  if (candidate === expected) return 100;
  if (candidate.includes(expected)) return 90;
  const tokens = expected.split(/[^a-z0-9]+/).filter((token) => token.length > 1);
  return tokens.length && tokens.every((token) => candidate.includes(token)) ? 80 : 0;
}

function bestSearchCandidate(candidates, {name, type}) {
  return (candidates || [])
    .filter((candidate) => candidate && candidate.id && candidate.label && (type === "content" || candidate.type === type || !candidate.type))
    .map((candidate) => ({...candidate, score: scoreCandidate(candidate.label, name)}))
    .filter((candidate) => candidate.score >= 80)
    .sort((left, right) => right.score - left.score || left.label.length - right.label.length)[0] || null;
}

function createWebOsMyTvAutomation({execute, pressKey, wait} = {}) {
  if (typeof execute !== "function" || typeof pressKey !== "function" || typeof wait !== "function") {
    throw new TypeError("Trusted LG MyTV automation requires execute(), pressKey(), and wait().");
  }
  let selectedSearchResult = null;

  async function readFocus() { return execute(focusProbeScript(), []); }
  async function waitForVisibleId(id, {timeoutMs = 15_000, pollIntervalMs = 250} = {}) {
    const attempts = Math.max(1, Math.floor(timeoutMs / pollIntervalMs) + 1);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const target = await execute(elementRectScript(id), []);
      if (target) return target;
      if (attempt < attempts - 1) await wait(pollIntervalMs);
    }
    throw semanticError("CONTENT_NOT_FOUND", "The requested MyTV control is not visible.");
  }
  async function focusId(id, maxMoves = 80) {
    const target = await waitForVisibleId(id);
    for (let attempt = 0; attempt < maxMoves; attempt += 1) {
      const focus = await readFocus();
      if (focus.id === id) return;
      const key = chooseDirection(focus.rect || {x: 0, y: 0, width: 0, height: 0}, target);
      const before = focus.id;
      await pressKey(key);
      await wait(160);
      const after = await readFocus();
      if (after.id === before) { await pressKey(fallbackDirection(key)); await wait(160); }
    }
    throw semanticError("REMOTE_FOCUS_FAILED", "The required MyTV control did not receive native remote focus.");
  }
  async function waitForBody(predicate, timeoutMs, message) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      const text = String(await execute(bodyTextScript(), []));
      if (predicate(text)) return text;
      await wait(250);
    }
    throw semanticError("DOM_STATE_TIMEOUT", message);
  }
  async function waitForSearchCandidate({name, type}, {timeoutMs = 20_000, pollIntervalMs = 250} = {}) {
    const attempts = Math.max(1, Math.floor(timeoutMs / pollIntervalMs) + 1);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const candidate = bestSearchCandidate(await execute(searchCandidatesScript(), []), {name, type});
      if (candidate) return candidate;
      if (attempt < attempts - 1) await wait(pollIntervalMs);
    }
    return null;
  }
  async function focusVisibleText(text) {
    const id = await execute(visibleTextScript(text), []);
    if (!id) throw semanticError("CONTENT_NOT_FOUND", "The requested MyTV text is not visible.");
    return focusId(id);
  }
  async function focusLogin() {
    await focusId("btn-welcome-0-1");
    await pressKey("Enter");
    await waitForBody((text) => text.includes("Đăng nhập"), 10_000, "MyTV account login was not available.");
    await focusId("remote-login-method");
    await pressKey("Enter");
    await waitForBody((text) => text.includes("Nhập số điện thoại") || text.includes("Tài khoản MyTV"), 15_000, "MyTV account-name keyboard was not available.");
  }
  async function enterVirtualKey(character) {
    const value = String(character || "");
    if (Array.from(value).length !== 1) throw semanticError("VIRTUAL_KEY_INVALID", "A single virtual-key character is required.");
    for (const id of keyIds(value)) {
      if (await execute(elementRectScript(id), [])) { await focusId(id); await pressKey("Enter"); await wait(250); return; }
    }
    throw semanticError("VIRTUAL_KEY_NOT_FOUND", "The requested MyTV virtual-key character is unavailable.");
  }
  async function submitVirtualField(field) {
    await focusId("new_ui_login_btn_ok");
    await pressKey("Enter");
    if (field === "username") return waitForBody((text) => text.includes("Nhập mật khẩu"), 15_000, "MyTV password keyboard was not available.");
    if (field === "password") return undefined;
    throw semanticError("VIRTUAL_FIELD_UNSUPPORTED", "The requested MyTV virtual field is unsupported.");
  }
  async function completeLogin() {
    await waitForBody((text) => !text.includes("Nhập mật khẩu"), 30_000, "MyTV login did not complete.");
    const body = String(await execute(bodyTextScript(), []));
    if (body.includes("Vượt quá số lượng thiết bị cho phép")) { await focusVisibleText("Tiếp tục"); await pressKey("Enter"); }
  }
  async function openHome() {
    const profile = await execute(elementRectScript("item_0"), []);
    if (profile) { await focusId("item_0"); await pressKey("Enter"); }
    await wait(1_000);
  }
  async function openSearch() {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await pressKey("ArrowLeft"); await wait(500);
      const id = await execute(searchMenuScript(), []);
      if (!id) continue;
      await focusId(id); await pressKey("Enter"); await wait(1_000);
      if (await execute(elementRectScript("callSearch"), [])) return;
    }
    throw semanticError("SEARCH_UNAVAILABLE", "The MyTV search screen could not be opened with native remote keys.");
  }
  async function searchContent({name, type}) {
    if (!CONTENT_TYPES.has(type)) throw semanticError("CONTENT_TYPE_INVALID", "The MyTV content type is invalid.");
    await focusId("callSearch"); await pressKey("Enter"); await wait(3_000);
    const candidate = await waitForSearchCandidate({name, type});
    if (!candidate) throw semanticError("CONTENT_NOT_FOUND", "No matching visible MyTV search result was found.");
    await focusId(candidate.id); selectedSearchResult = candidate;
    return {name: candidate.label, type: candidate.type};
  }
  async function assessPlayback() {
    const before = await execute(playerStateScript(), []); await wait(6_000); const after = await execute(playerStateScript(), []);
    if (!after.hasVideo || after.paused || after.ended || after.readyState < 2 || after.currentTime <= before.currentTime + 0.25) {
      throw semanticError("PLAYBACK_FAILED", "MyTV player did not reach a healthy playing state.");
    }
    return {playing: true};
  }
  async function playSearchResult() {
    if (!selectedSearchResult) throw semanticError("CONTENT_NOT_FOUND", "No focused MyTV search result is available to play.");
    await pressKey("Enter"); await wait(3_500);
    return assessPlayback();
  }
  async function logout() {
    await execute("return window.processLogOut ? window.processLogOut() : Promise.reject(new Error('window.processLogOut is unavailable'));", []);
    await wait(2_000);
    await waitForBody((text) => text.includes("Đăng nhập"), 30_000, "MyTV logout did not return to an account-login screen.");
  }
  async function waitForReady(name) {
    if (name === "app") return waitForBody((text) => Boolean(text.trim()), 15_000, "MyTV app readiness did not appear.");
    if (name === "home") return waitForBody((text) => !text.includes("Nhập mật khẩu") && !text.includes("Tìm kiếm"), 15_000, "MyTV home readiness did not appear.");
    if (name === "content") return waitForBody((text) => !text.includes("Nhập mật khẩu") && Boolean(text.trim()), 15_000, "MyTV content readiness did not appear.");
    if (name === "player") {
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const player = await execute(playerStateScript(), []);
        if (player?.hasVideo && !player.paused && !player.ended && player.readyState >= 2) return player;
        await wait(250);
      }
      throw semanticError("DOM_STATE_TIMEOUT", "MyTV player readiness did not appear.");
    }
    throw semanticError("READY_STATE_UNSUPPORTED", "The requested MyTV readiness state is unsupported.");
  }
  function unsupported() { throw semanticError("SEMANTIC_NOT_IMPLEMENTED", "This MyTV TV action is not yet available for the approved LG terminal gate."); }

  return Object.freeze({
    waitForReady,
    focusLogin,
    enterVirtualKey,
    submitVirtualField,
    completeLogin,
    openHome,
    openSearch,
    searchContent,
    playSearchResult,
    playContent: unsupported,
    playRow: unsupported,
    focusRow: unsupported,
    focusRowFirstItem: unsupported,
    focusText: unsupported,
    openService: unsupported,
    logout,
  });
}

module.exports = {createWebOsMyTvAutomation};
