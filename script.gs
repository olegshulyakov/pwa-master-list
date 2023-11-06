const selectors = {
  head: "html head",
  url: "head link[rel='canonical']",
  manifest: "head link[rel='manifest']",
  title: "head title",
  description: "head meta[name='description']",
  appleIcon: "head link[rel='apple-touch-icon']",
  openGraph: {
    title: "head meta[property='og:title']",
    type: "head meta[property='og:type']",
    image: "head meta[property='og:image']",
    url: "head meta[property='og:url']",
    description: "head meta[property='og:description']",
    name: "head meta[property='og:site_name']",
    locale: "head meta[property='og:locale']",
    localeAlt: "head meta[property='og:locale:alternate']",
  },
};

function isAbsolute_(url) {
  return url != null && (url.startsWith("http://") || url.startsWith("https://"));
}

function getContent_(url) {
  Logger.log("Fetching " + url);
  const result = UrlFetchApp.fetch(url);
  const contents = result.getContentText();
  return contents;
}

function getHeader_(url) {
  const cacheKey = "header::" + url;
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached != null) {
    return cached;
  }

  const content = getContent_(url);
  const $ = Cheerio.load(content);
  const head = $(selectors.head).html();
  cache.put(url, head, 30 * 60); // cache for 30 minutes
  return head;
}

function getManifest_(url) {
  const cacheKey = "manifest::" + url;
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached != null) {
    return cached;
  }

  const content = getContent_(url);
  cache.put(url, content, 30 * 60); // cache for 30 minutes
  return head;
}

function GET_APP_INFO(url) {
  if (url === null || url === "") {
    return;
  }

  const header = getHeader_(url);
  const $ = Cheerio.load(header);

  const headerUrl = $(selectors.url).attr("href");
  const openGraphUrl = $(selectors.openGraph.url).attr("content");
  let canonicalUrl = headerUrl || openGraphUrl || url;
  if (canonicalUrl.startsWith("http://")) {
    canonicalUrl = canonicalUrl.replace("http://", "https://");
  }

  let manifestUrl = $(selectors.manifest).attr("href");
  if (!manifestUrl || /^\s+$/.test(manifestUrl)) {
    return;
  }
  
  if (!isAbsolute_(manifestUrl)) {
    manifestUrl = canonicalUrl + manifestUrl;
  }

  const manifestRaw = getContent_(manifestUrl);
  const manifest = JSON.parse(manifestRaw);

  const name = $(selectors.openGraph.name).attr("content") 
    || $(selectors.openGraph.title).attr("content") 
    || manifest["name"]
    || $(selectors.title).text();
  const description = $(selectors.openGraph.description).attr("content") 
    || manifest["description"] 
    || $(selectors.description).attr("content");
  let icon = $(selectors.openGraph.image).attr("content") 
    || manifest["icons"]?.find((i) => (i.purpose === "any" || !i.purpose) && i.sizes === "192x192")?.src 
    || manifest["icons"]?.find((i) => (i.purpose === "any" || !i.purpose) && i.sizes === "512x512")?.src 
    || $(selectors.appleIcon).attr("href");
  icon = icon != null ? isAbsolute_(icon) ? icon: canonicalUrl + icon : "";
  
  const results = new Array(1);
  const row = new Array(1);
  row[0] = name;
  row[1] = description;
  row[2] = Array.isArray(manifest["categories"]) ? manifest["categories"].join(",") : "";
  row[3] = icon;
  results[0] = row;
  return results;
}
