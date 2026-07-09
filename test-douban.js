// test-douban.js — offline mock test for widgets/douban.js
// Run: node test-douban.js
const fs = require("fs");
const assert = require("assert/strict");
const path = require("path");

const TARGET = process.argv[2] || "./widgets/douban.js";
const calls = [];

const SUBJECT_MOVIE = {
  id: "1292052",
  title: "肖申克的救赎",
  type: "movie",
  subtype: "movie",
  year: "1994",
  card_subtitle: "1994 / 美国 / 剧情 犯罪",
  genres: ["剧情", "犯罪"],
  has_linewatch: true,
  vendor_icons: [
    "https://img3.doubanio.com/f/frodo/xxx/pics/vendors/youku.png",
    "https://img3.doubanio.com/f/frodo/xxx/pics/vendors/iqiyi.png",
  ],
  pic: {
    normal: "https://img.example.com/shawshank.jpg",
    large: "https://img.example.com/shawshank-l.jpg",
  },
  rating: { value: 9.7, count: 100, max: 10, star_count: 5 },
};

const SUBJECT_TV = {
  id: "26635329",
  title: "火花",
  type: "tv",
  subtype: "tv",
  year: "2016",
  card_subtitle: "2016 / 日本 / 喜剧",
  genres: ["喜剧"],
  has_linewatch: true,
  vendor_icons: ["https://img3.doubanio.com/f/frodo/xxx/pics/vendors/tencent.png"],
  pic: {
    normal: "https://img.example.com/hibana.jpg",
  },
  rating: { value: 9.2, count: 50, max: 10, star_count: 5 },
};

const HOT_ITEM = {
  id: "37450627",
  title: "痴迷",
  type: "movie",
  year: "2025",
  card_subtitle: "2025 / 美国 / 恐怖 / 库里·巴克 / 演员",
  has_linewatch: false,
  rating: { value: 7.7, count: 100, max: 10, star_count: 4 },
  cover: { url: "https://img.example.com/hot.jpg" },
};

const SUBJECT_OWNED = {
  id: "26752088",
  title: "我不是药神",
  type: "movie",
  subtype: "movie",
  year: "2018",
  card_subtitle: "2018 / 中国大陆",
  pic: { normal: "https://img.example.com/dying.jpg" },
  rating: { value: 9.0, count: 80, max: 10, star_count: 5 },
};

const SUBJECT_REC_A = {
  id: "1292720",
  title: "阿甘正传",
  type: "movie",
  subtype: "movie",
  year: "1994",
  card_subtitle: "1994 / 美国",
  pic: { normal: "https://img.example.com/forrest.jpg" },
  rating: { value: 9.5, count: 90, max: 10, star_count: 5 },
};

const SUBJECT_REC_B = {
  id: "1292064",
  title: "楚门的世界",
  type: "movie",
  subtype: "movie",
  year: "1998",
  card_subtitle: "1998 / 美国",
  pic: { normal: "https://img.example.com/truman.jpg" },
  rating: { value: 9.4, count: 70, max: 10, star_count: 5 },
};

function parseUrl(url) {
  const u = new URL(url);
  return {
    path: u.pathname,
    query: Object.fromEntries(u.searchParams.entries()),
  };
}

global.Widget = {
  http: {
    get: async (url, options) => {
      calls.push({ url, options });
      const { path: p, query } = parseUrl(url);

      // user interests
      const interestMatch = p.match(/\/user\/([^/]+)\/interests$/);
      if (interestMatch) {
        const status = query.status;
        if (status === "mark") {
          return {
            data: {
              start: 0,
              count: 20,
              total: 1,
              interests: [
                {
                  status: "mark",
                  rating: null,
                  subject: SUBJECT_MOVIE,
                },
              ],
            },
          };
        }
        if (status === "doing") {
          return {
            data: {
              start: 0,
              count: 20,
              total: 1,
              interests: [
                {
                  status: "doing",
                  rating: null,
                  subject: SUBJECT_TV,
                },
              ],
            },
          };
        }
        if (status === "done") {
          const start = Number(query.start || 0);
          // page0: high-rated seed + low-rated; page1: older watched item that recs may return
          if (start === 0) {
            return {
              data: {
                start: 0,
                count: 50,
                total: 51,
                interests: [
                  {
                    status: "done",
                    rating: { value: 5, max: 5, star_count: 5 },
                    subject: SUBJECT_OWNED,
                  },
                  {
                    status: "done",
                    rating: { value: 3, max: 5, star_count: 3 },
                    subject: {
                      id: "low-rated",
                      title: "低分片",
                      type: "movie",
                      subtype: "movie",
                      pic: { normal: "https://img.example.com/low.jpg" },
                      rating: { value: 6.0 },
                    },
                  },
                ],
              },
            };
          }
          return {
            data: {
              start: start,
              count: 50,
              total: 51,
              interests: [
                {
                  status: "done",
                  rating: { value: 4, max: 5, star_count: 4 },
                  subject: {
                    id: "old-watched-999",
                    title: "很久以前看过",
                    type: "movie",
                    subtype: "movie",
                    pic: { normal: "https://img.example.com/old.jpg" },
                    rating: { value: 8.0 },
                  },
                },
              ],
            },
          };
        }
      }

      // recommendations
      const recMatch = p.match(/\/(?:movie|tv|subject)\/([^/]+)\/recommendations$/);
      if (recMatch) {
        const seedId = recMatch[1];
        // seed 26752088 returns A twice-path and B; also re-suggest owned to test exclude
        if (seedId === "26752088") {
          return {
            data: [
              SUBJECT_REC_A,
              SUBJECT_REC_B,
              SUBJECT_OWNED,
              SUBJECT_MOVIE,
              {
                id: "old-watched-999",
                title: "很久以前看过",
                type: "movie",
                subtype: "movie",
                pic: { normal: "https://img.example.com/old.jpg" },
                rating: { value: 8.0 },
              },
            ],
          };
        }
        return { data: [] };
      }

      // hot charts
      const chartMatch = p.match(/\/subject_collection\/([^/]+)\/items$/);
      if (chartMatch) {
        return {
          data: {
            start: 0,
            count: 20,
            total: 1,
            subject_collection_items: [HOT_ITEM],
          },
        };
      }

      throw new Error("unmocked url: " + url);
    },
    post: async (url) => {
      calls.push({ url });
      return { data: {} };
    },
  },
  storage: {
    _m: {},
    get(k) {
      return this._m[k];
    },
    set(k, v) {
      this._m[k] = v;
    },
  },
  html: { load: () => ({}) },
};

global.WidgetMetadata = {};

const abs = path.resolve(TARGET);
if (!fs.existsSync(abs)) {
  console.error("❌ missing module:", abs);
  process.exit(1);
}
eval(fs.readFileSync(abs, "utf8"));

function assertVideoItemShape(item, expected) {
  assert.equal(item.type, "douban");
  assert.equal(item.id, expected.id);
  assert.equal(item.title, expected.title);
  assert.equal(item.posterPath, expected.poster);
  assert.equal(item.mediaType, expected.mediaType);
  // no raw API field leaks
  assert.equal(item.poster_path, undefined);
  assert.equal(item.cover_url, undefined);
  assert.equal(item.pic, undefined);
  assert.equal(item.stills, undefined);
  assert.equal(item.recommendations, undefined);
}

(async () => {
  // --- missing userId ---
  await assert.rejects(
    () => loadWishList({ page: 1 }),
    /userId|用户/,
    "loadWishList should require userId"
  );

  // --- wish list ---
  calls.length = 0;
  const wish = await loadWishList({ userId: "ahbei", page: 1 });
  assert.equal(wish.length, 1);
  assertVideoItemShape(wish[0], {
    id: "1292052",
    title: "肖申克的救赎",
    poster: "https://img.example.com/shawshank.jpg",
    mediaType: "movie",
  });
  assert.ok(typeof wish[0].rating === "number");
  assert.ok(Array.isArray(wish[0].genreItems));
  assert.deepEqual(
    wish[0].genreItems.map((g) => g.id),
    ["剧情", "犯罪"]
  );
  assert.ok(wish[0].genreItems.every((g) => g.id && g.title), "genreItems need id+title");
  assert.ok(
    String(wish[0].description).includes("优酷") && String(wish[0].description).includes("爱奇艺"),
    "description should include platform names"
  );
  assert.equal(wish[0].genres, undefined, "raw genres must not leak");
  assert.equal(wish[0].vendor_icons, undefined, "raw vendor_icons must not leak");
  assert.ok(
    calls.some((c) => /status=mark/.test(c.url) && /user\/ahbei\/interests/.test(c.url)),
    "wish must request status=mark"
  );

  // --- genre filter ---
  const wishCrime = await loadWishList({ userId: "ahbei", page: 1, genreId: "犯罪" });
  assert.equal(wishCrime.length, 1);
  const wishAction = await loadWishList({ userId: "ahbei", page: 1, genreId: "动作" });
  assert.equal(wishAction.length, 0, "genre filter should drop non-matching");

  // --- watching list ---
  calls.length = 0;
  const watching = await loadWatchingList({ userId: "ahbei", page: 1 });
  assert.equal(watching.length, 1);
  assertVideoItemShape(watching[0], {
    id: "26635329",
    title: "火花",
    poster: "https://img.example.com/hibana.jpg",
    mediaType: "tv",
  });
  assert.ok(String(watching[0].description).includes("腾讯"), "tv platform name");
  assert.ok(
    calls.some((c) => /status=doing/.test(c.url)),
    "watching must request status=doing"
  );

  // --- hot list (no userId required) ---
  calls.length = 0;
  const hot = await loadHotList({ chart: "movie_hot_gaia", page: 1, count: "20" });
  assert.equal(hot.length, 1);
  assert.equal(hot[0].type, "douban");
  assert.equal(hot[0].id, "37450627");
  assert.equal(hot[0].posterPath, "https://img.example.com/hot.jpg");
  assert.ok(Array.isArray(hot[0].genreItems));
  assert.ok(
    hot[0].genreItems.some((g) => g.id === "恐怖"),
    "should parse genres from card_subtitle when genres missing"
  );
  assert.ok(
    calls.some((c) => /subject_collection\/movie_hot_gaia\/items/.test(c.url)),
    "hot list must hit chart collection API"
  );

  // --- recommend: only high-rated seeds, exclude owned/wish/doing ---
  calls.length = 0;
  const recs = await loadRecommendList({
    userId: "ahbei",
    page: 1,
    minRating: "4",
    seedCount: "8",
  });
  const recIds = recs.map((r) => String(r.id));
  assert.ok(recIds.includes("1292720"), "should include 阿甘正传");
  assert.ok(recIds.includes("1292064"), "should include 楚门的世界");
  assert.ok(!recIds.includes("26752088"), "must exclude already-watched seed");
  assert.ok(!recIds.includes("1292052"), "must exclude wish list item");
  assert.ok(!recIds.includes("26635329"), "must exclude watching item");
  assert.ok(!recIds.includes("old-watched-999"), "must exclude watched beyond first page");
  assert.ok(!recIds.includes("low-rated"), "low-rated should not be a seed output");
  assert.ok(
    calls.filter((c) => /status=done/.test(c.url)).length >= 2,
    "must paginate done list for exclude set"
  );
  for (const item of recs) {
    assert.equal(item.type, "douban");
    assert.equal(item.poster_path, undefined);
  }
  // request assertions: done + mark + doing + recommendations for high-rated seed only
  assert.ok(calls.some((c) => /status=done/.test(c.url)), "need done list");
  assert.ok(
    calls.some((c) => /\/movie\/26752088\/recommendations|\/subject\/26752088\/recommendations/.test(c.url)),
    "must fetch recommendations for high-rated seed 26752088"
  );
  assert.ok(
    !calls.some((c) => /\/movie\/low-rated\/recommendations|\/subject\/low-rated\/recommendations/.test(c.url)),
    "must NOT seed from low-rated (< minRating)"
  );

  // pagination: page 2 empty when few recs
  const page2 = await loadRecommendList({
    userId: "ahbei",
    page: 2,
    minRating: "4",
    seedCount: "8",
  });
  assert.ok(Array.isArray(page2));
  assert.equal(page2.length, 0, "page 2 should be empty with only 2 recs");

  console.log("✅ ok", {
    wish: wish.length,
    watching: watching.length,
    recs: recs.length,
    hot: hot.length,
  });
})().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
