---
name: hackernews-frontpage
description: 抓取 Hacker News front page（titles、points、comment counts）。
host: news.ycombinator.com
trusted: true
source: human
version: 1.0.0
args: []
triggers:
  - scrape hacker news frontpage
  - scrape hn frontpage
  - get hn top stories
  - latest hacker news stories
---

# Hacker News front-page scraper

抓取 Hacker News（`news.ycombinator.com`）front page，并以 JSON 返回 top 30 stories。每条 story 包含 rank、title、link URL、point count 和 comment count。

## Usage

```
$ $B skill run hackernews-frontpage
{
  "stories": [
    { "rank": 1, "title": "...", "url": "...", "points": 412, "comments": 87 },
    ...
  ],
  "count": 30
}
```

## How it works

1. 通过 daemon navigate 到 `https://news.ycombinator.com`。
2. 读取 page HTML。
3. 将每个 story row（HN 稳定的 `tr.athing` structure）parse 成 typed `Story` record。
4. 在 stdout 输出单个 JSON document。

## Why this is the reference skill

`hackernews-frontpage` 是最小但有代表性的 browser-skill：no auth、stable HTML、deterministic output、file-fixture-friendly。每个 Phase 1 component（SDK、scoped tokens、three-tier lookup、spawn lifecycle）都会被 `$B skill run hackernews-frontpage` 和 bundled `script.test.ts` 覆盖。

当 HN HTML rotation 导致 selectors 失效时，test 会先在 captured fixture 上失败，而不是等 users 发现问题。这正是它的意义。
