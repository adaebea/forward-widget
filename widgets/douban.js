WidgetMetadata = {
  id: "forward.douban.personal",
  title: "豆瓣片单",
  version: "1.1.1",
  requiredVersion: "0.0.1",
  description: "展示豆瓣想看/在看，根据看过推荐，并支持近期热门与类型/平台信息",
  author: "adaebea",
  site: "https://www.douban.com",
  icon: "https://img3.doubanio.com/favicon.ico",
  detailCacheDuration: 3600,
  globalParams: [
    {
      name: "userId",
      title: "豆瓣用户 ID",
      type: "input",
      description: "个人主页 URL 中 people/ 后面的 ID 或个性域名，如 douban_user",
      placeholders: [{ title: "示例: douban_user", value: "douban_user" }],
    },
    {
      name: "minRating",
      title: "推荐种子最低星级",
      type: "enumeration",
      value: "4",
      enumOptions: [
        { title: "3★ 及以上", value: "3" },
        { title: "4★ 及以上", value: "4" },
        { title: "仅 5★", value: "5" },
      ],
    },
  ],
  modules: [
    {
      id: "wishList",
      title: "我想看",
      functionName: "loadWishList",
      cacheDuration: 1800,
      params: [
        { name: "page", title: "页码", type: "page" },
        { name: "count", title: "每页数量", type: "count", value: "20" },
      ],
    },
    {
      id: "watchingList",
      title: "我在看",
      functionName: "loadWatchingList",
      cacheDuration: 1800,
      params: [
        { name: "page", title: "页码", type: "page" },
        { name: "count", title: "每页数量", type: "count", value: "20" },
      ],
    },
    {
      id: "recommendList",
      title: "可能想看",
      functionName: "loadRecommendList",
      cacheDuration: 3600,
      params: [
        { name: "page", title: "页码", type: "page" },
        { name: "count", title: "每页数量", type: "count", value: "20" },
        {
          name: "seedCount",
          title: "种子数量",
          type: "count",
          value: "8",
          description: "用几部高分「看过」去拉相关推荐",
        },
      ],
    },
    {
      id: "hotList",
      title: "近期热门",
      functionName: "loadHotList",
      cacheDuration: 1800,
      params: [
        {
          name: "chart",
          title: "榜单",
          type: "enumeration",
          value: "movie_hot_gaia",
          enumOptions: [
            { title: "热门电影", value: "movie_hot_gaia" },
            { title: "正在热映", value: "movie_showing" },
            { title: "一周口碑榜", value: "movie_weekly_best" },
            { title: "热门剧集", value: "tv_hot" },
            { title: "热门综艺", value: "show_hot" },
          ],
        },
        { name: "page", title: "页码", type: "page" },
        { name: "count", title: "每页数量", type: "count", value: "20" },
      ],
    },
  ],
};

var DOUBAN_API = "https://m.douban.com/rexxar/api/v2";
var DOUBAN_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  Referer: "https://m.douban.com/mine/movie",
};

var VENDOR_NAME_MAP = {
  youku: "优酷",
  iqiyi: "爱奇艺",
  tencent: "腾讯视频",
  bilibili: "哔哩哔哩",
  mango: "芒果TV",
  mgtv: "芒果TV",
  sohu: "搜狐视频",
  le: "乐视",
  pptv: "PP视频",
  cntv: "央视",
  xigua: "西瓜视频",
  acfun: "AcFun",
  freemovie: "免费",
};

function requireUserId(params) {
  var userId = String((params && params.userId) || "").trim();
  if (!userId) {
    throw new Error("请填写豆瓣用户 ID（globalParams.userId）");
  }
  return userId;
}

function pageParams(params) {
  var page = Math.max(1, Number(params.page || 1));
  var count = Math.max(1, Math.min(50, Number(params.count || 20)));
  return { page: page, count: count, start: (page - 1) * count };
}

function toMediaType(subject) {
  var t = String((subject && (subject.type || subject.subtype)) || "movie").toLowerCase();
  return t === "tv" ? "tv" : "movie";
}

function parseGenresFromText(text) {
  if (!text) return [];
  var parts = String(text)
    .split("/")
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  // card_subtitle: year / region / genres / director / actors
  if (parts.length >= 3) {
    var genrePart = parts[2];
    // skip if looks like a person name only (no spaces and short) — genres usually space-separated
    return genrePart
      .split(/\s+/)
      .map(function (g) {
        return g.trim();
      })
      .filter(function (g) {
        return g && g.length <= 8;
      });
  }
  return [];
}

function buildGenreItems(subject) {
  var names = [];
  if (Array.isArray(subject.genres) && subject.genres.length) {
    names = subject.genres.map(function (g) {
      return typeof g === "string" ? g : g && (g.name || g.title || g.id);
    });
  } else {
    names = parseGenresFromText(subject.card_subtitle || subject.info || "");
  }
  var items = [];
  var seen = {};
  for (var i = 0; i < names.length; i++) {
    var name = String(names[i] || "").trim();
    if (!name || seen[name]) continue;
    seen[name] = true;
    items.push({ id: name, title: name });
  }
  return items;
}

function vendorKeyFromUrl(url) {
  var m = String(url || "").match(/\/vendors\/([^/?#]+)\.(?:png|jpg|webp)/i);
  if (!m) return "";
  return m[1].toLowerCase().replace(/[_-].*$/, "");
}

function buildPlatformNames(subject) {
  var icons = subject.vendor_icons || [];
  var names = [];
  var seen = {};
  for (var i = 0; i < icons.length; i++) {
    var key = vendorKeyFromUrl(icons[i]);
    var name = VENDOR_NAME_MAP[key] || (key ? key : "");
    if (!name || seen[name]) continue;
    seen[name] = true;
    names.push(name);
  }
  return names;
}

function buildDescription(subject, genreItems, platforms) {
  var parts = [];
  if (subject.card_subtitle) {
    parts.push(String(subject.card_subtitle));
  } else if (subject.info) {
    parts.push(String(subject.info));
  }
  if (platforms.length) {
    parts.push("可播: " + platforms.join(" / "));
  } else if (subject.has_linewatch) {
    parts.push("可在线观看");
  }
  return parts.join("\n");
}

function resolvePoster(subject) {
  var pic = subject.pic || {};
  if (pic.normal) return pic.normal;
  if (pic.large) return pic.large;
  if (subject.cover_url) return subject.cover_url;
  if (subject.cover && subject.cover.url) return subject.cover.url;
  return "";
}

function toVideoItem(subject) {
  if (!subject || !subject.id) return null;
  var rating = subject.rating || {};
  var genreItems = buildGenreItems(subject);
  var platforms = buildPlatformNames(subject);
  var ratingValue = typeof rating.value === "number" ? rating.value : undefined;
  if (ratingValue === 0) ratingValue = undefined;
  return {
    id: String(subject.id),
    type: "douban",
    title: subject.title || "",
    posterPath: resolvePoster(subject),
    rating: ratingValue,
    mediaType: toMediaType(subject),
    description: buildDescription(subject, genreItems, platforms),
    releaseDate: subject.year ? String(subject.year) : subject.release_date || undefined,
    genreItems: genreItems,
  };
}

function hasGenre(item, genreId) {
  if (!genreId) return true;
  var list = item.genreItems || [];
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].id) === String(genreId)) return true;
  }
  return false;
}

function filterByGenre(items, genreId) {
  if (!genreId) return items;
  var out = [];
  for (var i = 0; i < items.length; i++) {
    if (hasGenre(items[i], genreId)) out.push(items[i]);
  }
  return out;
}

async function fetchInterests(userId, status, start, count) {
  var url =
    DOUBAN_API +
    "/user/" +
    encodeURIComponent(userId) +
    "/interests?type=movie&status=" +
    encodeURIComponent(status) +
    "&start=" +
    start +
    "&count=" +
    count;
  var res = await Widget.http.get(url, { headers: DOUBAN_HEADERS });
  var data = res && res.data;
  if (!data) {
    throw new Error("豆瓣片单接口无响应");
  }
  return data;
}

async function fetchRecommendations(subjectId) {
  var url =
    DOUBAN_API +
    "/movie/" +
    encodeURIComponent(subjectId) +
    "/recommendations?count=100";
  try {
    var res = await Widget.http.get(url, { headers: DOUBAN_HEADERS });
    var data = res && res.data;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.subjects)) return data.subjects;
    return [];
  } catch (error) {
    console.error("[douban] recommendations failed for", subjectId, error.message || error);
    return [];
  }
}

async function fetchChartItems(chartId, start, count) {
  var url =
    DOUBAN_API +
    "/subject_collection/" +
    encodeURIComponent(chartId) +
    "/items?start=" +
    start +
    "&count=" +
    count;
  var res = await Widget.http.get(url, { headers: DOUBAN_HEADERS });
  var data = res && res.data;
  if (!data) {
    throw new Error("豆瓣榜单接口无响应");
  }
  return data;
}

function mapInterests(data) {
  var list = (data && data.interests) || [];
  var items = [];
  for (var i = 0; i < list.length; i++) {
    var item = toVideoItem(list[i] && list[i].subject);
    if (item) items.push(item);
  }
  return items;
}

function mapChartItems(data) {
  var list = (data && data.subject_collection_items) || [];
  var items = [];
  for (var i = 0; i < list.length; i++) {
    var item = toVideoItem(list[i]);
    if (item) items.push(item);
  }
  return items;
}

async function loadStatusList(params, status) {
  try {
    var userId = requireUserId(params);
    var p = pageParams(params);
    var data = await fetchInterests(userId, status, p.start, p.count);
    var items = mapInterests(data);
    return filterByGenre(items, params.genreId);
  } catch (error) {
    console.error("[douban] loadStatusList(" + status + ") 失败:", error.message || error);
    throw error;
  }
}

async function loadWishList(params) {
  return loadStatusList(params || {}, "mark");
}

async function loadWatchingList(params) {
  return loadStatusList(params || {}, "doing");
}

async function loadRecommendList(params) {
  try {
    params = params || {};
    var userId = requireUserId(params);
    var p = pageParams(params);
    var minRating = Number(params.minRating || 4);
    var seedCount = Math.max(1, Math.min(20, Number(params.seedCount || 8)));

    var doneData = await fetchInterests(userId, "done", 0, 50);
    var doneInterests = (doneData && doneData.interests) || [];
    var seeds = [];
    for (var i = 0; i < doneInterests.length; i++) {
      var interest = doneInterests[i];
      var userRating = interest && interest.rating;
      var star = userRating && typeof userRating.value === "number" ? userRating.value : 0;
      if (star < minRating) continue;
      var sub = interest.subject;
      if (sub && sub.id) seeds.push(sub);
      if (seeds.length >= seedCount) break;
    }

    var scoreMap = {};
    var itemMap = {};
    var tasks = seeds.map(function (seed) {
      return fetchRecommendations(seed.id).then(function (recs) {
        for (var r = 0; r < recs.length; r++) {
          var rec = recs[r];
          if (!rec || !rec.id) continue;
          var id = String(rec.id);
          scoreMap[id] = (scoreMap[id] || 0) + 1;
          if (!itemMap[id]) {
            var video = toVideoItem(rec);
            if (video) itemMap[id] = video;
          }
        }
      });
    });
    await Promise.all(tasks);

    var ranked = Object.keys(itemMap).map(function (id) {
      return { id: id, hits: scoreMap[id] || 0, item: itemMap[id] };
    });
    ranked.sort(function (a, b) {
      if (b.hits !== a.hits) return b.hits - a.hits;
      var ra = typeof a.item.rating === "number" ? a.item.rating : 0;
      var rb = typeof b.item.rating === "number" ? b.item.rating : 0;
      return rb - ra;
    });

    var items = ranked.slice(p.start, p.start + p.count).map(function (row) {
      return row.item;
    });
    return filterByGenre(items, params.genreId);
  } catch (error) {
    console.error("[douban] loadRecommendList 失败:", error.message || error);
    throw error;
  }
}

async function loadHotList(params) {
  try {
    params = params || {};
    var chart = String(params.chart || "movie_hot_gaia").trim() || "movie_hot_gaia";
    var p = pageParams(params);
    // 一次性拉取100条，本地做分页
    var data = await fetchChartItems(chart, 0, 100);
    var allItems = mapChartItems(data);
    // 本地切片分页
    var items = allItems.slice(p.start, p.start + p.count);
    return filterByGenre(items, params.genreId);
  } catch (error) {
    console.error("[douban] loadHotList 失败:", error.message || error);
    throw error;
  }
}
