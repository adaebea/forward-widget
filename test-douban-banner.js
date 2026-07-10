const fs = require("fs");
const assert = require("assert/strict");
const calls = [];

const hotItems = Array.from({ length: 20 }, function (_, index) {
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
};
global.WidgetMetadata = {};

eval(fs.readFileSync("./widgets/douban.js", "utf8"));

(async function () {
  var hot = await loadHotList({ chart: "movie_hot_gaia", page: 1, count: 20 });
  assert.equal(hot.length, 20);
  hot.forEach(function (item, index) {
    assert.equal(item.type, "url", "hot item " + (index + 1) + " must use direct image rendering");
    assert.equal(item.link, "douban:" + item.id);
    assert.equal(item.coverUrl, hotItems[index].cover.url);
    assert.equal(item.backdropPath, hotItems[index].cover.url);
  });

  var detail = await loadDetail(hot[19].link);
  assert.equal(detail.type, "url");
  assert.equal(detail.id, hot[19].id);
  assert.equal(detail.link, hot[19].link);
  assert.equal(detail.description, "详情简介");
  assert.equal(detail.backdropPath, hotItems[19].cover.url);
  var detailCall = calls.find(function (call) {
    return call.url.endsWith("/subject/" + hot[19].id);
  });
  assert.ok(detailCall, "detail must request the matching subject endpoint");
  assert.equal(detailCall.options.headers.Referer, "https://m.douban.com/mine/movie");

  var wish = await loadWishList({ userId: "test", page: 1, count: 20 });
  assert.equal(wish[0].type, "douban", "non-banner lists must retain built-in Douban details");
  assert.equal(wish[0].link, undefined);

  assert.equal(WidgetMetadata.version, "1.2.2");
  console.log("ok: all 20 hot items provide directly rendered banner images");
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
