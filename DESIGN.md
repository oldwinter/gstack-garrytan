# Design System — gstack

## 产品上下文

- **这是什么：** gstack 的 community website。gstack 是一个 CLI 工具，可将 Claude Code 转成虚拟工程团队。
- **面向谁：** 正在发现 gstack 的开发者、现有社区成员。
- **领域/行业：** Developer tools（同类：Linear、Raycast、Warp、Zed）。
- **项目类型：** Community dashboard + marketing site。

## 美学方向

- **方向：** Industrial/Utilitarian。功能优先，信息密度高，monospace 是性格字体。
- **装饰程度：** Intentional。表面使用微妙 noise/grain texture，增加材质感。
- **情绪：** 由在意 craft 的人打造的严肃工具。温暖，不冷漠。CLI 传承就是品牌。
- **参考站点：** formulae.brew.sh（竞品，但我们的是 live 且 interactive）、Linear（dark + restrained）、Warp（warm accents）。

## Typography（字体排印）

- **Display/Hero：** Satoshi（Black 900 / Bold 700）。几何感但有温度，字形有辨识度（小写 `a` 和 `g`）。不是 Inter，不是 Geist。通过 Fontshare CDN 加载。
- **Body：** DM Sans（Regular 400 / Medium 500 / Semibold 600）。干净、易读，比几何 display 稍微更友好。通过 Google Fonts 加载。
- **UI/Labels：** DM Sans（同 body）。
- **Data/Tables：** JetBrains Mono（Regular 400 / Medium 500）。性格字体。支持 tabular-nums。Monospace 应突出，而不是藏在 code blocks 中。通过 Google Fonts 加载。
- **Code：** JetBrains Mono。
- **Loading：** DM Sans + JetBrains Mono 用 Google Fonts，Satoshi 用 Fontshare。使用 `display=swap`。
- **Scale：**
  - Hero: 72px / clamp(40px, 6vw, 72px)
  - H1: 48px
  - H2: 32px
  - H3: 24px
  - H4: 18px
  - Body: 16px
  - Small: 14px
  - Caption: 13px
  - Micro: 12px
  - Nano: 11px（JetBrains Mono labels）

## Color（颜色）

- **方法：** 克制。Amber accent 稀少且有意义。Dashboard data 获得颜色；chrome 保持中性。
- **Primary（dark mode）：** amber-500 #F59E0B。温暖、有能量，读起来像 “terminal cursor”。
- **Primary（light mode）：** amber-600 #D97706。对比白色背景时更深。
- **Primary text accent（dark mode）：** amber-400 #FBBF24。
- **Primary text accent（light mode）：** amber-700 #B45309。
- **Neutrals：** 冷调 zinc grays。
  - zinc-50: #FAFAFA（lightest）
  - zinc-400: #A1A1AA
  - zinc-600: #52525B
  - zinc-800: #27272A
  - Surface（dark）: #141414
  - Base（dark）: #0C0C0C
  - Surface（light）: #FFFFFF
  - Base（light）: #FAFAF9
- **Semantic：** success #22C55E、warning #F59E0B、error #EF4444、info #3B82F6。
- **Dark mode：** 默认。Near-black base（#0C0C0C），surface cards 为 #141414，borders 为 #262626。
- **Light mode：** Warm stone base（#FAFAF9），white surface cards，stone borders（#E7E5E4）。Amber accent 转为 amber-600 以保证对比度。

## Spacing（间距）

- **Base unit：** 4px。
- **Density：** Comfortable。不是拥挤的 Bloomberg Terminal，也不是宽松的 marketing site。
- **Scale：** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

## Layout（布局）

- **方法：** Dashboard 使用 grid-disciplined，landing page 使用 editorial hero。
- **Grid：** lg+ 为 12 columns，mobile 为 1 column。
- **Max content width：** 1200px（6xl）。
- **Border radius：** sm:4px、md:8px、lg:12px、full:9999px。
  - Cards/panels: lg（12px）
  - Buttons/inputs: md（8px）
  - Badges/pills: full（9999px）
  - Skill bars: sm（4px）

## Motion（动效）

- **方法：** Minimal-functional。只使用有助于理解的 transitions。Dashboard 的 live feed 本身就是 motion。
- **Easing：** enter(ease-out / cubic-bezier(0.16,1,0.3,1)) exit(ease-in) move(ease-in-out)
- **Duration：** micro(50-100ms) short(150ms) medium(250ms) long(400ms)
- **Animated elements：** live feed dot pulse（2s infinite）、skill bar fill（600ms ease-out）、hover states（150ms）

## Grain Texture（颗粒纹理）

给整个页面加微妙 noise overlay，增加材质感：

- Dark mode: opacity 0.03
- Light mode: opacity 0.02
- 在 `body::after` 上使用 SVG `feTurbulence` filter 作为 CSS `background-image`
- `pointer-events: none`、`position: fixed`、`z-index: 9999`

## Decisions Log（决策记录）

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-21 | Initial design system | 由 /design-consultation 创建。Industrial aesthetic、warm amber accent、Satoshi + DM Sans + JetBrains Mono。 |
| 2026-03-21 | Light mode amber-600 | amber-500 在白底上太亮/发灰；amber-700 太 brown/umber。amber-600 是 sweet spot。 |
| 2026-03-21 | Grain texture | 给 flat dark surfaces 增加材质感。避免 “generic SaaS template” 的同质化。 |
