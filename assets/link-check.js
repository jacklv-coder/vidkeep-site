/* Identifies the platform of a pasted link inside this page only.
   Nothing is uploaded, fetched or downloaded; the link never leaves the browser. */
(() => {
  "use strict";

  const root = document.querySelector("[data-link-check]");
  if (!root) return;
  const zh = (document.documentElement.lang || "").startsWith("zh");
  const t = (zhText, enText) => (zh ? zhText : enText);

  // Host lists mirror apps/ios/Shared/VideoPlatform.swift.
  const platforms = [
    { id: "douyin", hosts: ["douyin.com", "iesdouyin.com"], name: t("抖音", "Douyin"),
      note: t("可尝试保存公开视频、图文，以及公开合集中所选的集数。", "Try saving public videos, photo posts and selected episodes of public collections."),
      guide: t("guides/save-douyin-video/", "guides/save-douyin-video-iphone/") },
    { id: "xiaohongshu", hosts: ["xiaohongshu.com", "xhslink.com", "xhslink.cn"], name: t("小红书", "Xiaohongshu (RedNote)"),
      note: t("无需登录，可尝试保存公开的视频和图文笔记。", "Try saving public video and photo notes without signing in."),
      guide: t("guides/save-xiaohongshu/", "guides/save-rednote-xiaohongshu-iphone/") },
    { id: "x", hosts: ["x.com", "twitter.com"], name: t("X（推特）", "X (Twitter)"),
      note: t("无需登录，可尝试下载公开帖子里的视频。", "Try downloading videos from public posts without signing in."),
      guide: t("guides/save-x-twitter-video/", "guides/save-x-twitter-video-iphone/") },
    { id: "tiktok", hosts: ["tiktok.com"], name: "TikTok",
      note: t("可尝试下载公开视频，暂不支持图文作品。", "Try downloading public videos. Photo posts are not supported yet."),
      guide: zh ? null : "guides/save-videos-offline/#tiktok" },
    { id: "bilibili", hosts: ["bilibili.com", "b23.tv"], name: t("哔哩哔哩", "Bilibili"),
      note: t("无需登录，按来源提供的清晰度下载公开视频；付费、会员专享和番剧不支持。", "Download public videos in the quality offered without signing in. Paid, member-only and bangumi episodes are not supported.") },
    { id: "kuaishou", hosts: ["kuaishou.com", "gifshow.com", "kwai.com", "kw.ai"], name: t("快手", "Kuaishou"),
      note: t("可尝试下载单个公开视频。", "Try downloading individual public videos.") },
    { id: "youtube", hosts: ["youtube.com", "youtu.be"], name: "YouTube",
      note: t("可尝试下载公开视频，全程需保持 App 打开；直播、会员专享和年龄限制视频不支持。", "Try downloading public videos; keep VidKeep open throughout. Live streams, members-only and age-restricted videos are not supported.") },
    { id: "facebook", hosts: ["facebook.com", "fb.watch"], name: "Facebook",
      note: t("无需登录，可尝试下载公开视频和 Reels。", "Try downloading public videos and Reels without signing in.") },
  ];
  const unsupported = [
    { hosts: ["instagram.com", "instagr.am"], name: "Instagram" },
    { hosts: ["weixin.qq.com", "channels.weixin.qq.com"], name: t("微信视频号", "WeChat Channels") },
    { hosts: ["netflix.com", "disneyplus.com", "primevideo.com", "iq.com", "iqiyi.com", "youku.com", "v.qq.com"], name: t("付费影视平台", "Streaming services") },
  ];

  const matches = (host, domain) => host === domain || host.endsWith("." + domain);
  const find = (list, host) => list.find((item) => item.hosts.some((domain) => matches(host, domain)));

  // Share text often wraps the link in a sentence, e.g. Douyin's "复制打开抖音…".
  function extractUrl(text) {
    const found = text.match(/https?:\/\/[^\s<>"'，。！？、）】」]+/i);
    let candidate = found ? found[0] : text.trim();
    if (!found && /^[a-z0-9.-]+\.[a-z]{2,}\//i.test(candidate)) candidate = "https://" + candidate;
    try {
      const url = new URL(candidate);
      if (url.protocol === "http:") url.protocol = "https:";
      // Match the app: plain HTTPS on the default port, no embedded credentials.
      if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
      return url;
    } catch { return null; }
  }

  const form = root.querySelector("form");
  const input = root.querySelector("textarea");
  const pasteButton = root.querySelector("[data-paste]");
  const result = root.querySelector(".check-result");
  const storeUrl = root.getAttribute("data-store-url");
  const prefix = root.getAttribute("data-prefix") || "";
  const supportedNames = platforms.map((item) => item.name).join(t("、", ", "));

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function nextSteps() {
    const list = el("ol", "check-steps");
    list.append(
      el("li", "", t("在 App Store 获取 VidKeep（免费，每天可下载 5 个视频）。", "Get VidKeep from the App Store (free, with 5 video downloads a day).")),
      el("li", "", t("打开 VidKeep，粘贴这个链接；也可以在来源 App 里点“分享”，选择 VidKeep。", "Open VidKeep and paste the link, or tap Share in the source app and choose VidKeep.")),
      el("li", "", t("保持 App 打开，等下载完成后就能离线观看。", "Keep the app open and wait for the download to finish; then it plays offline.")),
    );
    return list;
  }

  function actions(url) {
    const row = el("div", "check-actions");
    const store = el("a", "button", t("在 App Store 获取", "Get it on the App Store"));
    store.href = storeUrl;
    row.append(store);
    if (url && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      const copy = el("button", "button secondary", t("复制链接", "Copy link"));
      copy.type = "button";
      copy.addEventListener("click", () => {
        navigator.clipboard.writeText(url.href).then(
          () => { copy.textContent = t("已复制，去 App 里粘贴", "Copied. Paste it in the app"); },
          () => { copy.textContent = t("复制失败，请手动复制", "Copy failed. Copy it manually"); },
        );
      });
      row.append(copy);
    }
    return row;
  }

  function show(state, title, body, url, platform) {
    result.replaceChildren();
    result.dataset.state = state;
    result.append(el("p", "check-title", title));
    if (body) result.append(el("p", "check-body", body));
    if (state === "supported") {
      result.append(nextSteps(), actions(url));
      result.append(el("p", "small muted", t(
        "能否保存还取决于具体作品：私密、需登录、付费、受限、需验证、已删除和直播内容不支持。请只保存你拥有或获准保存的内容。",
        "Each work is different: private, sign-in-only, paid, restricted, verification-required, removed and live content is unsupported. Only save content you own or have permission to keep.")));
      if (platform.guide) {
        const guide = el("a", "text-link", t(`查看${platform.name}保存教程 →`, `Read the ${platform.name} guide →`));
        guide.href = prefix + platform.guide;
        result.append(guide);
      }
    }
    result.hidden = false;
  }

  function check() {
    const text = input.value.trim();
    if (!text) {
      show("empty", t("先粘贴一个分享链接。", "Paste a share link first."),
        t(`目前支持：${supportedNames}。`, `Supported sources: ${supportedNames}.`));
      return;
    }
    const url = extractUrl(text);
    if (!url) {
      show("unknown", t("没有找到链接。", "No link found."),
        t("请在来源 App 里点“分享”→“复制链接”，再粘贴到这里。", "In the source app, tap Share → Copy link, then paste it here."));
      return;
    }
    const host = url.hostname.toLowerCase();
    const platform = find(platforms, host);
    if (platform) {
      show("supported", t(`✓ 识别为${platform.name}链接，VidKeep 支持这个来源。`, `✓ ${platform.name} link. VidKeep supports this source.`), platform.note, url, platform);
      return;
    }
    const blocked = find(unsupported, host);
    show("unsupported",
      blocked ? t(`暂不支持${blocked.name}。`, `${blocked.name} is not supported.`)
        : t("这个网站暂不在支持列表里。", "This site is not on the supported list."),
      t(`目前支持：${supportedNames}。`, `Supported sources: ${supportedNames}.`));
  }

  form.addEventListener("submit", (event) => { event.preventDefault(); check(); });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); check(); }
  });
  input.addEventListener("paste", () => setTimeout(check, 0));

  if (pasteButton && navigator.clipboard && typeof navigator.clipboard.readText === "function") {
    pasteButton.hidden = false;
    pasteButton.addEventListener("click", () => {
      navigator.clipboard.readText().then((text) => { input.value = text; check(); }, () => input.focus());
    });
  }
})();
