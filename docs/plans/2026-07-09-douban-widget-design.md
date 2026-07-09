# 豆瓣个人片单 Widget 设计

**日期:** 2026-07-09  
**状态:** 已确认

## 目标

ForwardWidget 模块：展示用户豆瓣「想看」「在看」，并根据「看过」高分片的「喜欢这部的人也喜欢」推荐可能想看的内容。

## 决策

| 项 | 选择 |
|----|------|
| 账号 | 全局参数 `userId`（豆瓣用户 ID / 个性域名） |
| 内容 | 电影 + 剧集（`type=movie` 影视域） |
| 推荐 | 看过高分种子 → 官方相关推荐 → 合并去重排序 |
| 详情 | `type: "douban"`，走 App 内置详情页 |

## 模块

1. `wishList` — 我想看（status=mark）
2. `watchingList` — 我在看（status=doing）
3. `recommendList` — 可能想看（基于 done + recommendations）

## 数据源

- 片单: `GET https://m.douban.com/rexxar/api/v2/user/{userId}/interests?type=movie&status={mark|doing|done}&start=&count=`
- 相关推荐: `GET https://m.douban.com/rexxar/api/v2/movie/{subjectId}/recommendations?count=20`
- Headers: 移动端 UA + `Referer: https://m.douban.com/mine/movie`

## VideoItem

```js
{
  id: subject.id,          // 豆瓣 subject id 字符串
  type: "douban",
  title: subject.title,
  posterPath: subject.pic.normal,
  rating: subject.rating.value,
  mediaType: subject.type === "tv" ? "tv" : "movie",
  description: subject.card_subtitle,
  releaseDate: subject.year,
}
```

## 推荐算法

1. 拉看过（done），取 `interest.rating.value >= minRating`（默认 4★）的前 `seedCount`（默认 8）部为种子
2. 并行拉每部种子的 recommendations
3. 排除 mark/doing/done 中已出现的 id
4. 按出现次数降序，同分按豆瓣分降序
5. 按 page 切片返回

## 错误

- 缺 userId → throw 明确错误
- 接口失败 / 空 → log + throw 或返回 []（推荐部分源失败则跳过）
