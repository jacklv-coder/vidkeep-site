/* Website counts only: no cookies, user IDs, complete URLs or cross-site profiles. */
(() => {
  "use strict";

  const endpoint = "https://vidkeepapi.timeagain.cn/v1/apps/vidkeep/web/events";
  const siteOrigin = "https://jacklv-coder.github.io";
  const sitePath = "/vidkeep-site/";
  const pages = new Set([
    "/", "/en/", "/privacy/", "/support/", "/terms/",
    "/en/guides/save-videos-offline/",
    "/en/guides/organize-video-library/",
    "/en/guides/lifetime-video-saver/",
  ]);
  const sources = new Set([
    "chatgpt", "google", "bing", "other_search", "social", "other_referral", "direct",
  ]);

  const disabled = () => navigator.globalPrivacyControl === true
    || [navigator.doNotTrack, navigator.msDoNotTrack, window.doNotTrack]
      .some((value) => value === "1" || value === "yes");

  if (disabled() || window.__vidkeepWebsiteCountsV1 || typeof window.fetch !== "function") return;

  let current;
  try { current = new URL(window.location.href); } catch { return; }
  if (current.origin !== siteOrigin) return;
  if (!current.pathname.startsWith(sitePath) && current.pathname !== sitePath.slice(0, -1)) return;
  let page = current.pathname === sitePath.slice(0, -1)
    ? "/" : "/" + current.pathname.slice(sitePath.length);
  page = page.replace(/\/index\.html$/, "/");
  if (!page.endsWith("/")) page += "/";
  if (!pages.has(page)) return;

  window.__vidkeepWebsiteCountsV1 = true;
  const isTest = current.searchParams.get("vk_analytics_test") === "1";
  const storageKey = isTest ? "vidkeep.website.test-source.v1" : "vidkeep.website.source.v1";
  const matchesHost = (host, domain) => host === domain || host.endsWith("." + domain);

  function classifyHost(host) {
    if (["chatgpt.com", "chat.openai.com"].some((domain) => matchesHost(host, domain))) return "chatgpt";
    // A finite domain list avoids classifying google.com.example.org as Google.
    if (["google.com", "google.co.uk", "google.ca", "google.com.au", "google.de", "google.fr",
      "google.co.jp", "google.co.in", "google.com.br", "google.ch", "google.nl", "google.es",
      "google.it", "google.se", "google.com.hk", "google.com.tw"].some((domain) => matchesHost(host, domain))) return "google";
    if (matchesHost(host, "bing.com")) return "bing";
    if (["duckduckgo.com", "search.yahoo.com", "baidu.com", "yandex.com", "yandex.ru", "ecosia.org",
      "search.brave.com"].some((domain) => matchesHost(host, domain))) return "other_search";
    if (["facebook.com", "instagram.com", "tiktok.com", "x.com", "twitter.com", "youtube.com",
      "reddit.com", "linkedin.com", "pinterest.com", "t.co"].some((domain) => matchesHost(host, domain))) return "social";
    return "other_referral";
  }

  function readSource() {
    try {
      const value = window.sessionStorage.getItem(storageKey);
      return sources.has(value) ? value : null;
    } catch { return null; }
  }

  function chooseSource() {
    const campaign = (current.searchParams.get("utm_source") || "").trim().toLowerCase();
    if (["chatgpt", "chatgpt.com", "chat.openai.com"].includes(campaign)) return "chatgpt";
    if (document.referrer) {
      try {
        const referrer = new URL(document.referrer);
        if (referrer.protocol === "https:" || referrer.protocol === "http:") {
          // Other projects on the same GitHub host are outside this website.
          const internal = referrer.origin === siteOrigin
            && (referrer.pathname.startsWith(sitePath) || referrer.pathname === sitePath.slice(0, -1));
          if (!internal) return classifyHost(referrer.hostname.toLowerCase());
        }
      } catch { /* Missing or malformed referrers remain unattributed. */ }
    }
    return readSource() || "direct";
  }

  const source = chooseSource();
  try { window.sessionStorage.setItem(storageKey, source); } catch { /* Counts still work without storage. */ }

  function send(event) {
    if (disabled()) return;
    const body = JSON.stringify({ event, page, source, is_test: isTest });
    try {
      // No await, navigation delay, retry or alternative transport. A failed count
      // must never prevent a visitor from reaching the App Store.
      Promise.resolve(window.fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body,
        keepalive: true,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        redirect: "error",
      })).catch(() => {});
    } catch { /* Network restrictions do not affect the website. */ }
  }

  let viewed = false;
  function viewWhenVisible() {
    if (viewed || document.prerendering || document.visibilityState === "hidden") return;
    viewed = true;
    send("page_view");
  }
  document.addEventListener("visibilitychange", viewWhenVisible);
  document.addEventListener("prerenderingchange", viewWhenVisible);
  viewWhenVisible();

  function countStoreClick(event) {
    if (event.defaultPrevented || event.isTrusted === false || document.prerendering) return;
    if ((event.type === "click" && event.button !== 0)
      || (event.type === "auxclick" && event.button !== 1)) return;
    const target = event.target && (event.target.nodeType === 3 ? event.target.parentElement : event.target);
    const link = target && typeof target.closest === "function" ? target.closest("a[href]") : null;
    if (!link) return;
    let destination;
    try { destination = new URL(link.getAttribute("href"), current.href); } catch { return; }
    if (destination.protocol !== "https:" || destination.hostname !== "apps.apple.com"
      || destination.username || destination.password
      || !/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?app\/(?:[^/]+\/)?id6816571849\/?$/i.test(destination.pathname)) return;
    viewWhenVisible();
    send("app_store_click");
  }
  document.addEventListener("click", countStoreClick);
  document.addEventListener("auxclick", countStoreClick);
})();
