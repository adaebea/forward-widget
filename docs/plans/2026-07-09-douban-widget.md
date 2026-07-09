# 豆瓣个人片单 Widget Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 `widgets/douban.js`：想看、在看、基于看过的相关推荐；本地 mock 回测通过。

**Architecture:** 单一 JS 模块；`globalParams.userId`；三个 list 模块调用 rexxar interests / recommendations API；返回 `type:"douban"` VideoItem。

**Tech Stack:** ForwardWidget runtime (`Widget.http`)、Node mock 测试（无 deps）

**Skill:** @writing-forward-widgets

---

### Task 1: Offline test scaffold

**Files:**
- Create: `test-douban.js`
- Create: `widgets/douban.js` (stub)

**Step 1: Write failing test** covering:
- `loadWishList` maps interests → VideoItem (`type:"douban"`, no raw API leaks)
- `loadWatchingList` uses status=doing URL
- `loadRecommendList` threads seed id into recommendations URL, excludes owned ids
- missing userId throws

**Step 2: Run** `node test-douban.js` → expect FAIL

**Step 3: Implement minimal `widgets/douban.js` to pass**

**Step 4: Re-run** → PASS

---

### Task 2: Full module implementation

**Files:**
- Modify: `widgets/douban.js`

Implement:
- WidgetMetadata (globalParams + 3 modules)
- `fetchInterests(userId, status, page, count)`
- `toVideoItem(subject)`
- `loadWishList` / `loadWatchingList` / `loadRecommendList`
- recommend: seeds from done, exclude mark+doing+done, score by hit count

**Step 5: Run tests again** → PASS

---

### Task 3: Optional live smoke (manual)

`node -e` live fetch with a public uid like `ahbei` if network allows; not required for CI.

---
