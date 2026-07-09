WidgetMetadata = {
  id: "forward.douban.personal",
  title: "豆瓣片单",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  description: "展示豆瓣想看/在看，并根据看过记录推荐可能想看的内容",
  author: "adaebea",
  site: "https://www.douban.com",
  icon: "https://img3.doubanio.com/favicon.ico",
  detailCacheDuration: 3600,
  globalParams: [
    {
      name: "userId",
      title: "豆瓣用户 ID",
      type: "input",
      description: "个人主页 URL 中 people/ 后面的 ID 或个性域名，如 ahbei",
      placeholders: [{ title: "示例: ahbei", value: "ahbei" }],
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

function toVideoItem(subject) {
  if (!subject || !subject.id) return null;
  var pic = subject.pic || {};
  var rating = subject.rating || {};
  return {
    id: String(subject.id),
    type: "douban",
    title: subject.title || "",
    posterPath: pic.normal || pic.large || subject.cover_url || "",
    rating: typeof rating.value === "number" ? rating.value : undefined,
    mediaType: toMediaType(subject),
    description: subject.card_subtitle || "",
    releaseDate: subject.year ? String(subject.year) : undefined,
  };
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
    "/recommendations?count=20";
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

function mapInterests(data) {
  var list = (data && data.interests) || [];
  var items = [];
  for (var i = 0; i < list.length; i++) {
    var item = toVideoItem(list[i] && list[i].subject);
    if (item) items.push(item);
  }
  return items;
}

async function loadStatusList(params, status) {
  try {
    var userId = requireUserId(params);
    var p = pageParams(params);
    var data = await fetchInterests(userId, status, p.start, p.count);
    return mapInterests(data);
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

async function collectExcludeIds(userId) {
  var statuses = ["mark", "doing", "done"];
  var set = {};
  for (var i = 0; i < statuses.length; i++) {
    try {
      var data = await fetchInterests(userId, statuses[i], 0, 50);
      var interests = (data && data.interests) || [];
      for (var j = 0; j < interests.length; j++) {
        var sub = interests[j] && interests[j].subject;
        if (sub && sub.id) set[String(sub.id)] = true;
      }
    } catch (error) {
      console.error("[douban] exclude fetch failed", statuses[i], error.message || error);
    }
  }
  return set;
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

    var exclude = await collectExcludeIds(userId);
    // also exclude seeds themselves (already in done, but keep explicit)
    for (var s = 0; s < seeds.length; s++) {
      exclude[String(seeds[s].id)] = true;
    }

    var scoreMap = {};
    var itemMap = {};
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

    return ranked.slice(p.start, p.start + p.count).map(function (row) {
      return row.item;
    });
  } catch (error) {
    console.error("[douban] loadRecommendList 失败:", error.message || error);
    throw error;
  }
}
