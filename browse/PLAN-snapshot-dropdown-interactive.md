# Plan: Snapshot Dropdown/Autocomplete Interactive Element Detection

## 问题

`snapshot -i` 会漏掉现代 web apps 中的 dropdown/autocomplete items。这些 elements：
1. 通常是带 click handlers 的 `<div>`/`<li>`，但没有 semantic ARIA roles
2. 位于 dynamically-created portals/popovers（floating containers）内部
3. 不出现在 Playwright 的 accessibility tree（`ariaSnapshot()`）中

`-C` flag（cursor-interactive scan）本来就是为此设计的，但：
- 需要单独 flag，使用 `-i` 的 agents 不会自动获得它
- 会跳过有 ARIA role 的 elements（即使 ARIA tree 漏掉了它们）
- 不会优先处理 dropdown items 所在的 popover/portal containers

## Root Cause

Playwright 的 `ariaSnapshot()` 基于浏览器 accessibility tree 构建。Dynamically-rendered popovers（React portals、Radix Popover 等）在以下情况下可能不在 accessibility tree 中：
- Component 没有设置 ARIA roles
- Portal render 在 scoped `body` locator 的 subtree timing 之外
- DOM mutation 后，浏览器尚未更新 accessibility tree

## Changes

### 1. `-i` flag 自动启用 cursor-interactive scan

**File:** `browse/src/snapshot.ts`

当传入 `-i`（interactive）时，自动包含 cursor-interactive scan。这意味着 agents 请求 interactive elements 时，总能看到 clickable non-ARIA elements。

`-C` flag 仍作为 non-interactive snapshots 的 standalone option 保留。

```
if (opts.interactive) {
  opts.cursorInteractive = true;
}
```

### 2. 添加 popover/portal priority scanning

**File:** `browse/src/snapshot.ts`（inside cursor-interactive evaluate block）

在 general cursor:pointer scan 之前，专门扫描 visible floating containers（popovers、dropdowns、menus），并把它们的 ALL direct children 作为 interactive include：

Floating containers 的 detection heuristics：
- `position: fixed` 或 `position: absolute`，且 `z-index >= 10`
- 有 `role="listbox"`、`role="menu"`、`role="dialog"`、`role="tooltip"`、`[data-radix-popper-content-wrapper]`、`[data-floating-ui-portal]` 等
- 最近出现在 DOM 中（不在 initial page load 中）
- Visible（`offsetParent !== null` 或 `position: fixed`）

对每个 floating container，include 满足以下条件的 child elements：
- 有 text content
- Visible
- 有 cursor:pointer 或 onclick 或 role="option" 或 role="menuitem"
- 为 clarity 标记 reason `popover-child`

### 3. 移除 cursor-interactive scan 中的 `hasRole` skip

**File:** `browse/src/snapshot.ts`

当前：`if (hasRole) continue;` — 会跳过任何有 ARIA role 的 element，假设 ARIA tree 已经捕获它。

问题：如果 ARIA tree 漏掉该 element（timing、portal、bad DOM structure），它会同时从两个 systems 中漏掉。

Fix：只有当 element 的 role 在 `INTERACTIVE_ROLES` 中，且它确实被 main refMap 捕获时才 skip。否则 include。

由于我们不能轻易从 `page.evaluate()` 内部检查 refMap，更简单的修复是：对 detected floating containers 内部的 elements，完全移除 `hasRole` skip。对 floating containers 外部的 elements，保留现有 `hasRole` skip（避免 normal page content 中 duplicates）。

### 4. 添加 dropdown test fixture 和 tests

**File:** `browse/test/fixtures/dropdown.html`

HTML page 包含：
- 一个 focus/type 时显示 dropdown 的 combobox input
- 作为 `<div>` 且带 click handlers 的 dropdown items（无 ARIA roles）
- 作为 `<li>` 且带 `role="option"` 的 dropdown items
- 一个 React-portal-style container（`position: fixed`，high z-index）

**File:** `browse/test/snapshot.test.ts`

新增 test cases：
- Dropdown page 上的 `snapshot -i` 通过 cursor scan 找到 dropdown items
- Dropdown page 上的 `snapshot -i` 包含 popover-child elements
- Dropdown scan 产生的 `@c` refs 可点击
- Floating containers 内带 ARIA roles 的 elements 即使被 ARIA tree 漏掉，也会被捕获

## Rollout Risk

**Low。** `-C` scan 是 additive，只会添加 `@c` refs，永远不移除 `@e` refs。自动在 `-i` 下启用会增加 output size，但 agents 已经能处理 mixed ref types。

**One concern:** `-C` scan 会 query ALL elements（`document.querySelectorAll('*')`），在 heavy pages 上可能慢。对 popover-specific scan，我们限制在 detected floating containers 内部 elements，因此很快（small subtree）。

## Testing

```bash
cd /data/gstack/browse && bun test snapshot
```

## Files Changed

1. `browse/src/snapshot.ts` — auto-enable -C with -i、popover scanning、remove hasRole skip in floating containers
2. `browse/test/fixtures/dropdown.html` — new test fixture
3. `browse/test/snapshot.test.ts` — new dropdown/popover test cases
