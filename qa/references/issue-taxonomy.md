# QA Issue Taxonomy（QA 问题分类）

## Severity Levels（严重程度）

| Severity | Definition（定义） | Examples（示例） |
|----------|------------|----------|
| **critical** | 阻塞核心 workflow、造成 data loss，或让 app crash | Form submit 导致 error page、checkout flow broken、未确认就删除 data |
| **high** | 主要 feature broken 或 unusable，且没有 workaround | Search 返回错误结果、file upload 静默失败、auth redirect loop |
| **medium** | Feature 可用但有明显问题，存在 workaround | Slow page load（>5s）、缺少 form validation 但仍可 submit、只在 mobile 上 layout broken |
| **low** | 轻微 cosmetic 或 polish issue | footer typo、1px alignment issue、hover state inconsistent |

## Categories（类别）

### 1. Visual/UI
- Layout breaks（elements overlap、clipped text、horizontal scrollbar）
- Broken 或 missing images
- Incorrect z-index（elements 出现在其他元素后面）
- Font/color inconsistencies
- Animation glitches（jank、incomplete transitions）
- Alignment issues（off-grid、uneven spacing）
- Dark mode / theme issues

### 2. Functional
- Broken links（404、wrong destination）
- Dead buttons（click 后无事发生）
- Form validation（missing、wrong、bypassed）
- Incorrect redirects
- State not persisting（refresh 或 back button 后 data lost）
- Race conditions（double-submit、stale data）
- Search 返回 wrong 或 no results

### 3. UX
- Confusing navigation（no breadcrumbs、dead ends）
- Missing loading indicators（user 不知道某件事正在发生）
- Slow interactions（>500ms 且无 feedback）
- Unclear error messages（"Something went wrong" 且无 detail）
- Destructive actions 前没有 confirmation
- 跨 pages 的 interaction patterns 不一致
- Dead ends（no way back、no next action）

### 4. Content
- Typos 和 grammar errors
- Outdated 或 incorrect text
- 残留 placeholder / lorem ipsum text
- Truncated text（被截断但没有 ellipsis 或 "more"）
- Buttons 或 form fields 上的 labels 错误
- Empty states 缺失或没帮助

### 5. Performance
- Slow page loads（>3 seconds）
- Janky scrolling（dropped frames）
- Layout shifts（load 后 content jumping）
- Excessive network requests（single page 上 >50）
- Large unoptimized images
- Blocking JavaScript（load 期间 page unresponsive）

### 6. Console/Errors
- JavaScript exceptions（uncaught errors）
- Failed network requests（4xx、5xx）
- Deprecation warnings（upcoming breakage）
- CORS errors
- Mixed content warnings（HTTPS 上的 HTTP resources）
- CSP violations

### 7. Accessibility
- Images 缺少 alt text
- Form inputs 没有 label
- Keyboard navigation broken（无法 tab 到 elements）
- Focus traps（无法 escape modal 或 dropdown）
- ARIA attributes 缺失或 incorrect
- Color contrast 不足
- Screen reader 无法 reach content

## Per-Page Exploration Checklist（逐页探索清单）

QA session 中访问的每个 page 都检查：

1. **Visual scan** — 截取 annotated screenshot（`snapshot -i -a -o`）。查找 layout issues、broken images、alignment。
2. **Interactive elements** — 点击每个 button、link 和 control。每个元素是否做到 label 所说的事？
3. **Forms** — Fill 并 submit。测试 empty submission、invalid data、edge cases（long text、special characters）。
4. **Navigation** — 检查所有 in/out paths。Breadcrumbs、back button、deep links、mobile menu。
5. **States** — 检查 empty state、loading state、error state、full/overflow state。
6. **Console** — Interactions 后运行 `console --errors`。是否有新的 JS errors 或 failed requests？
7. **Responsiveness** — 如 relevant，检查 mobile 和 tablet viewports。
8. **Auth boundaries** — Logged out 时会发生什么？不同 user roles 呢？
