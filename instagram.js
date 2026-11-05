/**
 * Instagram placements for a story that already points at one post.
 * Permalinks are read from an optional admin marker stored in the body,
 * from a post or reel link already in the copy, or from an explicit field.
 * Profile URLs are not posts and never become an embed.
 */
const NaMeInstagram = (function () {
  // The handle already linked from the magazine footer.
  const MAGAZINE_INSTAGRAM_URL = "https://www.instagram.com/name_magazine_/";
  const PERMALINK_RE =
    /(?<![A-Za-z0-9])(?:https?:\/\/)?(?:www\.)?instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)/i;
  const PERMALINK_RE_G =
    /(?<![A-Za-z0-9])(?:https?:\/\/)?(?:www\.)?instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)/gi;
  const MARKER_RE = /<p\b[^>]*\bdata-name-instagram=(["'])([^"']*)\1[^>]*>\s*<\/p>/gi;
  const COMMENT_RE = /<!--\s*name-ig:\s*([\s\S]*?)\s*-->/gi;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function decodeBasic(value) {
    return String(value ?? "")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">");
  }

  function canonicalInstagramPermalink(value) {
    const match = decodeBasic(value).trim().match(PERMALINK_RE);
    if (!match) return "";
    const kind = match[1].toLowerCase() === "reel" ? "reel" : "p";
    return `https://www.instagram.com/${kind}/${match[2]}/`;
  }

  function firstPermalink(value) {
    const text = decodeBasic(value);
    PERMALINK_RE_G.lastIndex = 0;
    const match = PERMALINK_RE_G.exec(text);
    if (!match) return "";
    return canonicalInstagramPermalink(match[0]);
  }

  function markerPermalink(html) {
    const source = String(html || "");
    MARKER_RE.lastIndex = 0;
    const attr = MARKER_RE.exec(source);
    if (attr) {
      const found = canonicalInstagramPermalink(attr[2]);
      if (found) return found;
    }
    COMMENT_RE.lastIndex = 0;
    const comment = COMMENT_RE.exec(source);
    if (comment) return canonicalInstagramPermalink(comment[1]);
    return "";
  }

  function permalink(post) {
    if (!post || typeof post !== "object") return "";
    const fields = [post.instagramUrl, post.instagram_url, post.instagram, post.igUrl, post.sourceUrl];
    for (const field of fields) {
      const found = canonicalInstagramPermalink(field);
      if (found) return found;
    }
    const marked = markerPermalink(post.body);
    if (marked) return marked;
    return firstPermalink(post.body) || firstPermalink(post.meta);
  }

  function stripMarker(html) {
    return String(html || "")
      .replace(MARKER_RE, "")
      .replace(COMMENT_RE, "")
      .trim();
  }

  function applyMarker(html, url) {
    const clean = stripMarker(html);
    const canonical = canonicalInstagramPermalink(url);
    if (!canonical) return clean;
    const tag = `<p data-name-instagram="${escapeHtml(canonical)}" hidden></p>`;
    return clean ? `${clean}\n${tag}` : tag;
  }

  function textOf(key, fallback) {
    if (typeof NaMeI18n === "undefined") return fallback;
    return NaMeI18n.t(NaMeI18n.getLang(), key);
  }

  function safeImage(url) {
    const raw = String(url ?? "").trim();
    if (!raw) return "";
    if (/^(?:https?:|blob:|data:image\/)/i.test(raw)) return raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return "";
    if (raw.startsWith("//")) return "";
    return raw;
  }

  function captionExcerpt(post) {
    const html = stripMarker(post?.body || "");
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(PERMALINK_RE_G, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return "";
    return text.length > 160 ? `${text.slice(0, 157).trim()}…` : text;
  }

  function sourceHtml(url) {
    const href = escapeHtml(canonicalInstagramPermalink(url) || url);
    const label = textOf("igSeeOriginal", "See the original post on Instagram ↗");
    return `<p class="post-ig-source"><a href="${href}" target="_blank" rel="noopener noreferrer" data-i18n="igSeeOriginal">${escapeHtml(label)}</a></p>`;
  }

  function placementHtml(post, url) {
    const href = canonicalInstagramPermalink(url) || "";
    if (!href) return "";
    const safeHref = escapeHtml(href);
    const label = textOf("igOnInstagram", "On Instagram");
    const view = textOf("igViewPost", "View on Instagram");
    const follow = textOf("igFollow", "Follow NaMe Magazine");
    const caption = captionExcerpt(post);
    const image = safeImage(post?.imageUrl || post?.image_url);
    const imageHtml = image
      ? `<img class="post-ig-card__img" src="${escapeHtml(image)}" alt="" />`
      : "";
    const captionHtml = caption ? `<p class="post-ig-card__caption">${escapeHtml(caption)}</p>` : "";
    return `<aside class="post-instagram" data-ig-placement>
      <p class="post-instagram__label" data-i18n="igOnInstagram">${escapeHtml(label)}</p>
      <blockquote class="instagram-media" cite="${safeHref}" data-instgrm-permalink="${safeHref}" data-instgrm-version="14">
        <div class="post-ig-card">
          ${imageHtml}
          <div class="post-ig-card__copy">
            ${captionHtml}
            <a class="post-ig-card__link" href="${safeHref}" target="_blank" rel="noopener noreferrer" data-i18n="igViewPost">${escapeHtml(view)}</a>
          </div>
        </div>
      </blockquote>
      <p class="post-ig-follow"><a href="${escapeHtml(MAGAZINE_INSTAGRAM_URL)}" target="_blank" rel="noopener noreferrer" data-i18n="igFollow">${escapeHtml(follow)}</a></p>
    </aside>`;
  }

  function mountEmbed(doc) {
    const root = doc || (typeof document !== "undefined" ? document : null);
    if (!root?.querySelector?.(".instagram-media[data-instgrm-permalink]")) return;
    const win = root.defaultView || (typeof window !== "undefined" ? window : null);
    if (root.querySelector("script[data-name-ig-embed]")) {
      if (win?.instgrm?.Embeds?.process) win.instgrm.Embeds.process();
      return;
    }
    const script = root.createElement("script");
    script.async = true;
    script.src = "https://www.instagram.com/embed.js";
    script.dataset.nameIgEmbed = "1";
    script.addEventListener("load", () => {
      if (win?.instgrm?.Embeds?.process) win.instgrm.Embeds.process();
    });
    root.body.appendChild(script);
  }

  return {
    MAGAZINE_INSTAGRAM_URL,
    canonicalInstagramPermalink,
    permalink,
    stripMarker,
    applyMarker,
    captionExcerpt,
    sourceHtml,
    placementHtml,
    mountEmbed,
  };
})();

if (typeof window !== "undefined") window.NaMeInstagram = NaMeInstagram;
