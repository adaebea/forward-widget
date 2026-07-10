const fs = require("fs");
const assert = require("assert/strict");
const calls = [];

const hotItems = Array.from({ length: 21 }, function (_, index) {
  var number = index + 1;
  return {
    id: String(37000000 + number),
    title: "热门影片 " + number,
    type: "movie",
    year: "2026",
    cover: { url: "https://img.example.com/hot-" + number + ".jpg" },
  };
});

global.Widget = {
  http: {
    get: async function (url, options) {
      calls.push({ url: url, options: options });
      if (url.indexOf("/subject_collection/") >= 0) {
        return { data: { subject_collection_items: hotItems } };
      }
      if (url.indexOf("/user/test/interests") >= 0) {
        return { data: { interests: [{ subject: hotItems[0] }] } };
      }
      var detailMatch = url.match(/\/(?:movie|subject)\/(\d+)$/);
      if (detailMatch) {
        var subject = hotItems.find(function (item) {
          return item.id === detailMatch[1];
        });
        return { data: Object.assign({}, subject, { intro: "详情简介" }) };
      }
      throw new Error("unmocked url: " + url);
    },
  },
  tmdb: {
    get: async function (api, options) {
      calls.push({ api: api, options: options });
      var title = options.params.query;
      var number = Number(title.split(" ").pop());
      if (number === 1) return { results: [] };
      if (number === 99) throw new Error("TMDB unavailable");
      return {
        results: [
          {
            id: 9000 + number,
            title: "错误匹配 " + number,
            poster_path: "/wrong-poster-" + number + ".jpg",
            backdrop_path: "/wrong-backdrop-" + number + ".jpg",
            release_date: "2026-01-01",
          },
          {
            id: 1000 + number,
            title: title,
            media_type: "movie",
            poster_path: "/poster-" + number + ".jpg",
            backdrop_path: "/backdrop-" + number + ".jpg",
            release_date: "2026-01-01",
            vote_average: 8,
            overview: "TMDB 简介",
          },
        ],
      };
    },
  },
};
global.WidgetMetadata = {};

eval(fs.readFileSync("./widgets/douban.js", "utf8"));

(async function () {
  var hot = await loadHotList({ chart: "movie_hot_gaia", page: 1, count: 20 });
  assert.equal(hot.length, 20);
  hot.forEach(function (item, index) {
    var number = index + 2;
    assert.equal(item.type, "tmdb", "hot item " + (index + 1) + " must use TMDB image rendering");
    assert.equal(item.id, 1000 + number);
    assert.equal(item.mediaType, "movie");
    assert.equal(item.posterPath, "/poster-" + number + ".jpg");
    assert.equal(item.backdropPath, "/backdrop-" + number + ".jpg");
    assert.equal(item.link, undefined);
  });
  assert.ok(calls.some(function (call) {
    return call.api === "search/movie" &&
      call.options.params.query === "热门影片 21" &&
      call.options.params.year === "2026";
  }), "must continue matching until 20 image-backed items are available");

  await assert.rejects(
    function () {
      return toTmdbBannerItem({ id: "99", title: "热门影片 99", type: "movie", year: "2026" });
    },
    /TMDB unavailable/,
    "TMDB failures must not be converted into silent empty banner results"
  );

  var wish = await loadWishList({ userId: "test", page: 1, count: 20 });
  assert.equal(wish[0].type, "douban", "non-banner lists must retain built-in Douban details");
  assert.equal(wish[0].link, undefined);

  assert.equal(WidgetMetadata.version, "1.2.3");
  console.log("ok: all 20 hot items use TMDB-backed banner images");
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
