WidgetMetadata = {
  id: "forward.douban.personal",
  title: "豆瓣片单",
  version: "1.3.1",
  requiredVersion: "0.0.1",
  description: "展示豆瓣想看/在看，根据看过推荐，并支持近期热门",
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
      cacheDuration: 300,
      params: [
        { name: "page", title: "页码", type: "page" },
        { name: "count", title: "每页数量", type: "count", value: "20" },
      ],
    },
    {
      id: "watchingList",
      title: "我在看",
      functionName: "loadWatchingList",
      cacheDuration: 300,
      params: [
        { name: "page", title: "页码", type: "page" },
        { name: "count", title: "每页数量", type: "count", value: "20" },
      ],
    },
    {
      id: "recommendList",
      title: "可能想看",
      functionName: "loadRecommendList",
      cacheDuration: 300,
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
      sectionMode: true,
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

function resolvePoster(subject) {
  var pic = subject.pic || {};
  if (pic.normal) return pic.normal;
  if (pic.large) return pic.large;
  if (subject.cover_url) return subject.cover_url;
  if (subject.cover && subject.cover.url) return subject.cover.url;
  return "";
}

function buildDescription(subject) {
  var parts = [];
  if (subject.card_subtitle) {
    parts.push(String(subject.card_subtitle));
  } else if (subject.info) {
    parts.push(String(subject.info));
  }
  return parts.join("\n");
}

function doubanSubjectUrl(subject) {
  if (subject && subject.url) return String(subject.url);
  return "https://movie.douban.com/subject/" + encodeURIComponent(subject.id) + "/";
}

function resolveReleaseDate(subject) {
  if (subject && subject.release_date) return String(subject.release_date);
  var dates = (subject && subject.pubdate) || [];
  if (!Array.isArray(dates)) dates = [dates];
  for (var i = 0; i < dates.length; i++) {
    var match = String(dates[i] || "").match(/\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  return subject && subject.year ? String(subject.year) : undefined;
}

function toVideoItem(subject) {
  if (!subject || !subject.id) return null;
  var rating = subject.rating || {};
  var ratingValue = typeof rating.value === "number" ? rating.value : undefined;
  if (ratingValue === 0) ratingValue = undefined;
  var posterUrl = resolvePoster(subject);
  var link = doubanSubjectUrl(subject);
  return {
    // `douban` 类型会由 App 按内置数据源重新匹配，可能覆盖或丢掉
    // 豆瓣接口刚返回的条目。使用 url 保留列表中返回的标题、日期和海报。
    id: link,
    type: "url",
    link: link,
    title: subject.title || "",
    coverUrl: posterUrl,
    posterPath: posterUrl,
    backdropPath: posterUrl,
    rating: ratingValue,
    mediaType: toMediaType(subject),
    description: buildDescription(subject),
    releaseDate: resolveReleaseDate(subject),
  };
}

function tmdbImageUrl(path) {
  if (!path) return "";
  var value = String(path);
  if (/^https?:\/\//i.test(value)) return value;
  return "https://image.tmdb.org/t/p/w500" + value;
}

function findTmdbPosterMatch(subject, results) {
  var subjectTitle = normalizeTitle(subject && subject.title);
  var mediaType = toMediaType(subject);
  var subjectYear = String((subject && subject.year) || "");
  var exactFallback = null;
  var partialFallback = null;
  for (var i = 0; i < results.length; i++) {
    var result = results[i];
    if (!result || (!result.poster_path && !result.backdrop_path)) continue;
    var titles = [result.title, result.name, result.original_title, result.original_name];
    var exactTitleMatch = titles.some(function (title) {
      var normalized = normalizeTitle(title);
      if (!normalized || !subjectTitle) return false;
      return normalized === subjectTitle;
    });
    var partialTitleMatch = titles.some(function (title) {
      var normalized = normalizeTitle(title);
      if (!normalized || !subjectTitle) return false;
      // 豆瓣常把季度写进标题，TMDB 的剧集标题通常是剧名本身。
      return mediaType === "tv" && (subjectTitle.indexOf(normalized) >= 0 || normalized.indexOf(subjectTitle) >= 0);
    });
    if (!exactTitleMatch && !partialTitleMatch) continue;
    var resultDate = result.release_date || result.first_air_date || "";
    var yearMatches = !subjectYear || !resultDate || String(resultDate).slice(0, 4) === subjectYear;
    if (exactTitleMatch && yearMatches) return result;
    if (exactTitleMatch && !exactFallback) exactFallback = result;
    if (partialTitleMatch && !partialFallback) partialFallback = result;
  }
  return exactFallback || partialFallback;
}

function tvBaseTitle(title) {
  return String(title || "")
    .replace(/[（(]\s*(?:第\s*)?[一二三四五六七八九十百千万\d]+\s*季\s*[）)]\s*$/i, "")
    .replace(/\s*(?:第\s*)?[一二三四五六七八九十百千万\d]+\s*季.*$/i, "")
    .replace(/\s*(?:season|s)\s*\d+.*$/i, "")
    // 中文剧名常把季度直接写成末尾数字（如“中国奇谭2”）；
    // 仅在数字前是汉字时才剥离，避免误改纯数字或英文片名。
    .replace(/([\u4e00-\u9fff])\s*\d+\s*$/, "$1")
    .trim();
}

function copySubjectWithTitle(subject, title, year) {
  var copy = {};
  var keys = Object.keys(subject || {});
  for (var i = 0; i < keys.length; i++) {
    copy[keys[i]] = subject[keys[i]];
  }
  copy.title = String(title || "");
  if (year) copy.year = String(year);
  return copy;
}

function addTmdbTitleCandidate(candidates, seen, subject, title, year) {
  var value = String(title || "").trim();
  if (!value) return;
  var variants = [value];
  // 入口卡片要使用整剧海报：对剧集先检索去季名后的总剧名，再保留
  // 原始季名作为兜底。详情入口会跳到命中的 TMDB 整剧详情页。
  if (toMediaType(subject) === "tv") {
    var baseTitle = tvBaseTitle(value);
    if (baseTitle && baseTitle !== value) variants.unshift(baseTitle);
  }
  for (var i = 0; i < variants.length; i++) {
    var normalized = normalizeTitle(variants[i]);
    if (!normalized || seen[normalized]) continue;
    seen[normalized] = true;
    candidates.push({
      subject: copySubjectWithTitle(subject, variants[i], year),
      query: variants[i],
      includeYear: toMediaType(subject) !== "tv" && candidates.length === 0,
    });
  }
}

function buildTmdbTitleCandidates(subject, detail, includeSubjectTitle) {
  var candidates = [];
  var seen = {};
  if (includeSubjectTitle !== false) {
    addTmdbTitleCandidate(candidates, seen, subject, subject && subject.title, subject && subject.year);
  }
  if (!detail) return candidates;
  addTmdbTitleCandidate(candidates, seen, subject, detail.original_title || detail.original_name, detail.year || (subject && subject.year));
  var aliases = Array.isArray(detail.aka) ? detail.aka : [];
  for (var i = 0; i < aliases.length; i++) {
    addTmdbTitleCandidate(candidates, seen, subject, aliases[i], detail.year || (subject && subject.year));
  }
  return candidates;
}

async function findTmdbPosterFromCandidates(candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    var match = await findTmdbPoster(candidate.subject, candidate.query, candidate.includeYear);
    if (match) return match;
  }
  return null;
}

function tmdbDetailLink(link, mediaType, tmdbId) {
  if (!link || !tmdbId) return link;
  return String(link) + "#forward-tmdb=" + mediaType + "." + tmdbId;
}

function toNativeTmdbItem(subject, match) {
  var mediaType = toMediaType(subject);
  var rating = typeof match.vote_average === "number" && match.vote_average > 0
    ? match.vote_average
    : undefined;
  var nativeTitle = match.title || match.name || match.original_title || match.original_name || subject.title || "";
  // 列表入口必须和 TMDB 详情、资源匹配使用同一个“整剧”标题，
  // 不能继续沿用豆瓣的“第一季/第二季”等季名。
  if (mediaType === "tv") nativeTitle = tvBaseTitle(nativeTitle) || tvBaseTitle(subject.title) || nativeTitle;
  // 使用 Forward 的标准 TMDB 身份，而不是把 TMDB 图片塞进 url 条目。
  // 这样 App 会走与本地视频文件相同的内置媒体识别、封面和详情路径。
  return {
    id: mediaType + "." + match.id,
    type: "tmdb",
    title: nativeTitle,
    mediaType: mediaType,
    // 对 tmdb 类型传原始路径，由 App 自己拼接并管理图片缓存。
    posterPath: match.poster_path || undefined,
    backdropPath: match.backdrop_path || match.poster_path || undefined,
    rating: rating,
    releaseDate: match.release_date || match.first_air_date || resolveReleaseDate(subject),
  };
}

async function toVideoItemWithTmdbPoster(subject) {
  var item = toVideoItem(subject);
  if (!item || !Widget.tmdb || typeof Widget.tmdb.get !== "function") return item;
  try {
    var mediaType = toMediaType(subject);
    var match = await findTmdbPosterFromCandidates(buildTmdbTitleCandidates(subject));
    if (!match) {
      var detail = await fetchSubjectDetail(subject.id);
      // 初始中文标题已经查过，此处只补查豆瓣详情中的原名和别名，
      // 避免每个未命中条目重复发起同一条 TMDB 搜索。
      match = await findTmdbPosterFromCandidates(buildTmdbTitleCandidates(subject, detail, false));
    }
    if (!match) return item;
    if (!match.poster_path && !match.backdrop_path) return item;
    return toNativeTmdbItem(subject, match);
  } catch (error) {
    console.error("[douban] TMDB poster lookup failed", subject && subject.id, error.message || error);
    return item;
  }
}

async function findTmdbPoster(subject, query, includeYear) {
  var mediaType = toMediaType(subject);
  var searchParams = {
    query: query,
    language: "zh-CN",
    include_adult: false,
  };
  if (includeYear && subject.year) {
    if (mediaType === "tv") searchParams.first_air_date_year = String(subject.year);
    else searchParams.year = String(subject.year);
  }
  var data = await Widget.tmdb.get("search/" + mediaType, { params: searchParams });
  var subjectForMatch = {};
  var keys = Object.keys(subject);
  for (var i = 0; i < keys.length; i++) {
    subjectForMatch[keys[i]] = subject[keys[i]];
  }
  subjectForMatch.title = String(query || subject.title || "");
  return findTmdbPosterMatch(subjectForMatch, (data && data.results) || []);
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

async function fetchSubjectDetail(subjectId) {
  var url = DOUBAN_API + "/subject/" + encodeURIComponent(subjectId);
  var res = await Widget.http.get(url, { headers: DOUBAN_HEADERS });
  return res && res.data;
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

async function mapInterestsWithTmdbPosters(data) {
  var list = (data && data.interests) || [];
  var tasks = list.map(function (interest) {
    return toVideoItemWithTmdbPoster(interest && interest.subject);
  });
  var items = await Promise.all(tasks);
  return items.filter(Boolean);
}

async function loadDetail(link) {
  var tmdbMatch = String(link || "").match(/#forward-tmdb=(tv|movie)\.(\d+)$/);
  if (tmdbMatch) {
    return {
      id: tmdbMatch[1] + "." + tmdbMatch[2],
      type: "tmdb",
      mediaType: tmdbMatch[1],
    };
  }
  var match = String(link || "").match(/movie\.douban\.com\/subject\/(\d+)/);
  if (!match) return null;
  try {
    var subject = await fetchSubjectDetail(match[1]);
    var item = await toVideoItemWithTmdbPoster(subject);
    if (item && subject && subject.intro) item.description = String(subject.intro);
    return item;
  } catch (error) {
    console.error("[douban] loadDetail 失败:", error.message || error);
    throw error;
  }
}

async function toTmdbBannerItem(subject) {
  if (!subject || !subject.id || !subject.title) return null;
  var mediaType = toMediaType(subject);
  var searchParams = {
    query: subject.title,
    language: "zh-CN",
    include_adult: false,
  };
  if (subject.year) {
    if (mediaType === "tv") searchParams.first_air_date_year = String(subject.year);
    else searchParams.year = String(subject.year);
  }
  var data = await Widget.tmdb.get("search/" + mediaType, {
    params: searchParams,
  });
  var results = (data && data.results) || [];
  var subjectTitle = normalizeTitle(subject.title);
  var subjectYear = String(subject.year || "");
  var match = null;
  for (var i = 0; i < results.length; i++) {
    var result = results[i];
    if (!result || !result.backdrop_path) continue;
    var titles = [result.title, result.name, result.original_title, result.original_name];
    var titleMatches = titles.some(function (title) {
      return normalizeTitle(title) === subjectTitle;
    });
    if (!titleMatches) continue;
    var resultDate = result.release_date || result.first_air_date || "";
    if (subjectYear && resultDate && String(resultDate).slice(0, 4) !== subjectYear) continue;
    match = result;
    break;
  }
  if (!match) return null;
  var rating = typeof match.vote_average === "number" && match.vote_average > 0
    ? match.vote_average
    : undefined;
  return {
    id: match.id,
    type: "tmdb",
    title: subject.title,
    posterPath: match.poster_path || undefined,
    backdropPath: match.backdrop_path,
    rating: rating,
    mediaType: mediaType,
    description: match.overview || buildDescription(subject),
    releaseDate: match.release_date || match.first_air_date || undefined,
  };
}

function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[\s·・:：,，.。!！?？'"“”‘’《》〈〉【】（）()\-—_]+/g, "");
}

async function mapChartItemsForBanner(data, neededCount) {
  var list = (data && data.subject_collection_items) || [];
  var items = [];
  for (var start = 0; start < list.length && items.length < neededCount; start += 10) {
    var batch = list.slice(start, start + 10);
    var matched = await Promise.all(batch.map(toTmdbBannerItem));
    for (var i = 0; i < matched.length; i++) {
      if (matched[i]) items.push(matched[i]);
    }
  }
  return items;
}

async function loadStatusList(params, status) {
  try {
    var userId = requireUserId(params);
    var p = pageParams(params);
    var data = await fetchInterests(userId, status, p.start, p.count);
    var items = await mapInterestsWithTmdbPosters(data);
    return items;
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

// 推荐结果必须排除用户已经标记过的条目。豆瓣接口单页最多返回 50 条，
// 因此不能只取首页，也不能用固定页数截断（片单超过 1,000 条时会漏过滤）。
var EXCLUDE_PAGE_SIZE = 50;
var EXCLUDE_FETCH_CONCURRENCY = 2;
// 完整索引每月重建一次；每次推荐仍会补查每个状态的最新 50 条，
// 所以最近标记的内容不会等到下个月才被排除。
var EXCLUDE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
var EXCLUDE_CACHE_PREFIX = "forward.douban.personal.exclude.v1:";

function addInterestIds(data, set) {
  var interests = (data && data.interests) || [];
  for (var i = 0; i < interests.length; i++) {
    var subject = interests[i] && interests[i].subject;
    if (subject && subject.id) set[String(subject.id)] = true;
  }
}

function copyIdSet(ids) {
  var set = {};
  if (!ids || typeof ids !== "object") return set;
  var keys = Object.keys(ids);
  for (var i = 0; i < keys.length; i++) {
    if (ids[keys[i]]) set[keys[i]] = true;
  }
  return set;
}

function excludeCacheKey(userId) {
  return EXCLUDE_CACHE_PREFIX + encodeURIComponent(userId);
}

async function readExcludeCache(userId) {
  if (!Widget.storage || typeof Widget.storage.get !== "function") return null;
  try {
    var cached = await Widget.storage.get(excludeCacheKey(userId));
    var updatedAt = Number(cached && cached.updatedAt);
    if (!cached || !cached.ids || !updatedAt) return null;
    if (Date.now() - updatedAt > EXCLUDE_CACHE_TTL) return null;
    return cached;
  } catch (error) {
    console.error("[douban] exclude cache read failed", error.message || error);
    return null;
  }
}

async function writeExcludeCache(userId, ids) {
  if (!Widget.storage || typeof Widget.storage.set !== "function") return;
  try {
    await Widget.storage.set(excludeCacheKey(userId), {
      updatedAt: Date.now(),
      ids: ids,
    });
  } catch (error) {
    console.error("[douban] exclude cache write failed", error.message || error);
  }
}

async function fetchAllInterestIds(userId, status, firstPageData) {
  var ids = {};
  var firstPage = firstPageData || await fetchInterests(userId, status, 0, EXCLUDE_PAGE_SIZE);
  addInterestIds(firstPage, ids);

  var total = Number(firstPage && firstPage.total);
  if (!isFinite(total) || total <= EXCLUDE_PAGE_SIZE) return ids;

  var starts = [];
  for (var start = EXCLUDE_PAGE_SIZE; start < total; start += EXCLUDE_PAGE_SIZE) {
    starts.push(start);
  }
  for (var index = 0; index < starts.length; index += EXCLUDE_FETCH_CONCURRENCY) {
    var batch = starts.slice(index, index + EXCLUDE_FETCH_CONCURRENCY);
    var pages = await Promise.all(batch.map(function (pageStart) {
      return fetchInterests(userId, status, pageStart, EXCLUDE_PAGE_SIZE);
    }));
    for (var p = 0; p < pages.length; p++) {
      addInterestIds(pages[p], ids);
    }
  }
  return ids;
}

function mergeIdSets(target, source) {
  var keys = Object.keys(source || {});
  for (var i = 0; i < keys.length; i++) {
    target[keys[i]] = true;
  }
  return target;
}

async function collectExcludeIds(userId, doneFirstPage) {
  var cached = await readExcludeCache(userId);
  var firstPages = await Promise.all([
    fetchInterests(userId, "mark", 0, EXCLUDE_PAGE_SIZE),
    fetchInterests(userId, "doing", 0, EXCLUDE_PAGE_SIZE),
  ]);
  var markFirstPage = firstPages[0];
  var doingFirstPage = firstPages[1];

  if (cached) {
    var recentIds = copyIdSet(cached.ids);
    addInterestIds(doneFirstPage, recentIds);
    addInterestIds(markFirstPage, recentIds);
    addInterestIds(doingFirstPage, recentIds);
    return recentIds;
  }

  var idSets = await Promise.all([
    fetchAllInterestIds(userId, "done", doneFirstPage),
    fetchAllInterestIds(userId, "mark", markFirstPage),
    fetchAllInterestIds(userId, "doing", doingFirstPage),
  ]);
  var ids = {};
  for (var i = 0; i < idSets.length; i++) {
    mergeIdSets(ids, idSets[i]);
  }
  await writeExcludeCache(userId, ids);
  return ids;
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

    var exclude = await collectExcludeIds(userId, doneData);
    for (var s = 0; s < seeds.length; s++) {
      exclude[String(seeds[s].id)] = true;
    }

    var scoreMap = {};
    var itemMap = {};
    var subjectMap = {};
    var tasks = seeds.map(function (seed) {
      return fetchRecommendations(seed.id).then(function (recs) {
        for (var r = 0; r < recs.length; r++) {
          var rec = recs[r];
          if (!rec || !rec.id) continue;
          var id = String(rec.id);
          if (exclude[id]) continue;
          scoreMap[id] = (scoreMap[id] || 0) + 1;
          if (!itemMap[id]) {
            var video = toVideoItem(rec);
            if (video) {
              itemMap[id] = video;
              subjectMap[id] = rec;
            }
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

    var pageRows = ranked.slice(p.start, p.start + p.count);
    return Promise.all(pageRows.map(function (row) {
      return toVideoItemWithTmdbPoster(subjectMap[row.id]);
    }));
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
    // 豆瓣图片有防盗链，Banner 改用 TMDB 横图并跳过无法匹配的条目。
    var data = await fetchChartItems(chart, 0, 100);
    var allItems = await mapChartItemsForBanner(data, p.start + p.count);
    var items = allItems.slice(p.start, p.start + p.count);
    return items;
  } catch (error) {
    console.error("[douban] loadHotList 失败:", error.message || error);
    throw error;
  }
}
