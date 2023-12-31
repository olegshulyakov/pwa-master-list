const selectors = {
  head: "html head",
  url: "head link[rel='canonical']",
  manifest: "head link[rel='manifest']",
  title: "head title",
  description: "head meta[name='description']",
  appleIcon: "head link[rel='apple-touch-icon']",
  icon192: "head link[rel='icon'][sizes='192x192']",
  openGraph: {
    url: "head meta[property='og:url']",
    name: "head meta[property='og:site_name']",
    title: "head meta[property='og:title']",
    description: "head meta[property='og:description']",
    image: "head meta[property='og:image']",
  },
  twitter: {
    title: "head meta[property='twitter:title']",
    description: "head meta[property='twitter:description']",
    image: "head meta[property='twitter:image']",
  }
};

/**
* Checks if URL is absolute
* @param url the url you want to check
*/
function isAbsolute_(url) {
  return url != null && /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/.test(url);
}

/**
* Fetch URL content
* @param url the url you want to download
*/
function getContent_(url) {
  Logger.log("Fetching " + url);
  const result = UrlFetchApp.fetch(url, {validateHttpsCertificates: false, muteHttpExceptions: true});
  const contents = result.getContentText();
  return contents;
}

/**
* Fetch URL header
* @param url
*/
function getHeader_(url) {
Logger.log("Get header " + url);
  const cacheKey = "header::" + url;
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached != null) {
    return cached;
  }

  let content = getContent_(url);
  const $ = Cheerio.load(content);
  $('script').remove();
  $('style').remove();
  content = $(selectors.head).html();
  cache.put(cacheKey, content, 7 * 24 * 60 * 60); // cache for 7 days
  return content;
}

/**
* Fetch URL manifest
* @param url
*/
function getManifest_(url) {
Logger.log("Get manifest " + url);
  const cacheKey = "manifest::" + url;
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached != null) {
    return cached;
  }

  const content = getContent_(url);
  cache.put(cacheKey, content, 7 * 24 * 60 * 60); // cache for 7 days
  return content;
}

/**
* Returns URL information
* @param {"https://developer.mozilla.org/en-US/docs/Web/"} url the url you want to parse
*/
function GET_APP_INFO(url) {
  const results = new Array(1);
  const row = new Array(1);
  row[0] = ""; // name
  row[1] = ""; // description
  row[2] = ""; // categories
  row[3] = ""; // icon

  if (url === null || url === "") {
  Logger.log("No url");
    row[0] = "NO URL";
    return results;
  }

  const header = getHeader_(url);
  const $ = Cheerio.load(header);

  const headerUrl = $(selectors.url).attr("href");
  const openGraphUrl = $(selectors.openGraph.url).attr("content");
  let canonicalUrl = (isAbsolute_(headerUrl) ? headerUrl : null)
  || (isAbsolute_(openGraphUrl) ? openGraphUrl : null)
  || url;
  if (canonicalUrl.startsWith("http://")) {
    canonicalUrl = canonicalUrl.replace("http://", "https://");
  }

  let manifest = {};
  let manifestUrl = $(selectors.manifest).attr("href");
  if (manifestUrl != null && !/^\s+$/.test(manifestUrl)) {
    if (!isAbsolute_(manifestUrl)) {
      manifestUrl = urlResolve(canonicalUrl, manifestUrl);
    }

    const manifestRaw = getManifest_(manifestUrl);
    manifest = JSON.parse(manifestRaw);

    if (manifest["start_url"] == null) {
      Logger.log("No start url");
    }
  } else {
    Logger.log("No manifest");
  }

  const name = manifest["short_name"]
    || manifest["name"]
    || $(selectors.openGraph.name).attr("content")
    || $(selectors.openGraph.title).attr("content")
    || $(selectors.twitter.title).attr("content")
    || $(selectors.title).text();
  const description = manifest["description"]
    || $(selectors.openGraph.description).attr("content")
    || $(selectors.twitter.description).attr("content")
    || $(selectors.description).attr("content");
  let icon = manifest["icons"]?.find((i) => (i.purpose === "any" || !i.purpose) && i.sizes === "192x192")?.src
    || manifest["icons"]?.find((i) => (i.purpose === "any" || !i.purpose) && i.sizes === "512x512")?.src
    || $(selectors.appleIcon).attr("href")
    || $(selectors.icon192).attr("href")
    || $(selectors.twitter.image).attr("content")
    || $(selectors.openGraph.image).attr("content");
  icon = icon != null ? isAbsolute_(icon) ? icon: urlResolve(canonicalUrl, icon) : "";

  row[0] = name;
  row[1] = description;
  row[2] = Array.isArray(manifest["categories"]) ? manifest["categories"].join(",") : "";
  row[3] = icon;
  row[4] = manifest["start_url"] != null ? urlResolve(canonicalUrl, manifest["start_url"]) : ""
  results[0] = row;
  return results;
}
