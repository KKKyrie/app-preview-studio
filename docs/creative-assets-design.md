# 创意素材（Creative Assets）设计文档

> 状态：**Phase 1 已实现并通过验证** · 范围：静态图（不含视频）
> 关联：[Apple 素材最佳实践](https://developer.apple.com/app-store/asset-best-practices/) · [Creative assets specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications)
>
> 实现与本文档的差异见 §11「实现记录」。

---

## 1. 背景与目标

iOS 27 / iPadOS 27 起，App Store 新增两个**创意素材（Creative Assets）**坑位：标题图（Product Page Header）与搜索结果图（Search Results）。它们与截图、预览视频**并列而非替代**，用于表达品牌、季节性内容与新功能，而非展示 App 在用状态。

**目标**：在 App Preview Studio 中新增一个独立的「创意素材」工作台，生成符合 Apple 硬性规格（精确像素、无 alpha 通道、关键元素在安全区内、合规）的图片素材。

**非目标（本期不做）**：视频导出、设备裁切模拟器、In-App Event 素材、Asset Library API 对接。

---

## 2. 官方规格（已核验）

### 2.1 尺寸与格式

来源：Apple 官方 Creative assets specifications 页面表格。

**官方表格中每个 Placement 单元格横跨 2 个子行**（HTML 为 `row-span-2`），第二个子行是「16:9 · 5244 × 2950 · 仅 PNG」，**同时挂在两个坑位下**。因此实际结构是 **2 个坑位 × 各自 2~3 种尺寸**：

| 坑位 | 比例 | 图片尺寸 | 格式 | 视频 |
|:--|:--|:--|:--|:--|
| **标题图** Product Page Header | 21:9 | **3840 × 1646**（固定） | .jpeg / .jpg / .png | 3840×1646，5–30s，30/60fps |
| ↑ 同一坑位 | 16:9 | **5244 × 2950**（固定） | **仅 .png** | — |
| **搜索结果图** Search Results | 3:2 | **3840 × 2560** 或 **1920 × 1280** | .jpeg / .jpg / .png | 同尺寸，5–30s，30/60fps |
| ↑ 同一坑位 | 16:9 | **5244 × 2950**（固定） | **仅 .png** | — |

去重后共 **5 个尺寸选项**（5244 × 2950 在两个坑位下各出现一次）。

硬性约束：

- **图片不能含 alpha 通道或任何透明**（导出管线已修复，见 §7）
- 一张图通吃 iPhone / iPad、横屏 / 竖屏，**没有分机型尺寸**
- 仅对运行 iOS 27 / iPadOS 27+ 的 iPhone 与 iPad 应用生效
- 5244 × 2950 同时出现在两个坑位下，意味着**同一份文件可以同时填两处**（对应 ASC 版本页的「Use header asset in search results」）。它不是第三个独立坑位，而是两个坑位**共用的一个尺寸**（代码中标记 `universal`）

> ⚠️ 本文档早期版本把 5244 × 2950 建模成独立的第三个坑位「通用素材」，这是对规格表的误读（把跨两行的表格读成了三个 placement），现已按官方表格结构修正。

### 2.2 安全区（Apple 官方模板实测）

Apple **从不公布**安全区像素值，官方只有定性规则：

> *"Design key elements with a safe area in mind to accommodate different devices and orientations. Be sure your focal point artwork is within the center of your composition to prevent any unwanted clipping."*

数值藏在官方设计模板里。我们从 **Apple 自己的 Sketch 文件**中直接解析得到：

```
https://devimages-cdn.apple.com/design/resources/download/app-store/creative_assets-templates.sketch
```

该文件包含 3 个画板，与官方规格表逐一吻合。

**实测结果：**

| 画布 | 用于坑位 | 安全区 (x, y, w, h) | 边距 上/右/下/左 | 面积占比 | 来源 |
|:--|:--|:--|:--|:--|:--|
| 3840 × 1646 | 标题图 | **(1097, 493, 1646, 661)** | 493 / 1097 / 492 / 1097 | 17.2% | 实测 |
| 3840 × 2560 | 搜索结果图 | **(836, 765, 2168, 1030)** | 765 / 836 / 765 / 836 | 22.7% | 实测 |
| 5244 × 2950 | **两个坑位共用** | **(1921, 660, 1402, 962)** | 660 / 1921 / 1328 / 1921 | **8.7%** | 实测 |
| 1920 × 1280 | 搜索结果图 | **(418, 383, 1084, 515)** | 383 / 418 / 382 / 418 | 22.7% | 推导 |

**1920 × 1280 的推导依据**：Apple 模板只提供了 3840 × 2560 的安全区。两者**同为 3:2**，而裁切行为由宽高比与设备决定，因此同一比例下安全区在画布上的**相对位置完全一致**，按 0.5 等比缩放即可精确还原：

- 水平：`418 + 1084 = 1502 = 1920 − 418` ✓ 仍完美居中
- 垂直：`765 × 0.5 = 382.5` 取整到 383，产生 1px 误差，可忽略

**校验结果（三重验证通过）：**

1. **对称性**：三个实测画布的安全区**水平方向完美居中**（左/右边距完全相等）；标题图与搜索结果**垂直方向也居中**。
2. **5244 × 2950 垂直偏上**：上边距 660 / 下边距 1328，安全区中心比画布中心**偏上 334px**。⚠️ 「肉眼看着居中」的排版在共用尺寸上是错的，这是最隐蔽的坑。
3. **跨源一致**：与三家第三方独立测量（storeheader.com、blakecrosley.com、Stoot）的结果逐像素一致；并用 Apple 的 Photoshop 模板独立确认了画布尺寸（3840×1646 / 5244×2950）。

### 2.3 解析模板时的陷阱（务必注意）

Sketch 文件里的 **group frame 字段不可信**，存在未同步的过期值：

- Header 画板的 `Artwork` 组 frame 写的是 `1658×1060`，但它内部的 `Background` 矩形实际是 `3840×1646`。
- Universal 画板的 `Art Safe Area` 组 frame 写的是 `1658×1060`（与 Search Result 的组**完全相同的数值**，明显是复制残留），但其内部叶子矩形 `Art Area/Art Safe Area` 实际是 `1402×962`。

**正确取法**：用父组的 `x/y` 作为原点（相对画板），用组内**叶子矩形**的 `width/height` 作为尺寸。若直接读组 frame，5244×2950 画板会得到错误的 1658×1060。

### 2.4 全部官方模板地址

页面上的 8 个模板链接均为 `/go/?id=...` 跳转，已解析：

| 工具 | 用途 | 直链 |
|:--|:--|:--|
| Figma | Universal | `…/app-store/creative_assets-templates.fig` |
| Photoshop | Header | `…/app-store/creative_assets-product_page_header_template-static.psd` |
| Photoshop | Universal | `…/app-store/creative_assets-universal_asset_template-static.psd` |
| Photoshop | Search results | `…/app-store/creative_assets-search_results_template-static.psd` |
| Pixelmator | Header / Universal / Search results | `…/app-store/creative_assets-product_page_header_template-static.pxd` 等 |
| Sketch | 三个画板合一 | `…/app-store/creative_assets-templates.sketch` |

（前缀均为 `https://devimages-cdn.apple.com/design/resources/download`）

> 注：`-static` 后缀的 PSD 是**已拼合的无图层**文件，只含烘焙后的像素，不含可解析的图层信息。因此**安全区只能从 Sketch 文件取**。

### 2.5 格式与尺寸的处理决策

| 项 | 官方说明 | 本工具的处理 |
|:--|:--|:--|
| 5244 × 2950 的格式 | 规格表该行明确写 `.png`（其他行是 `.jpeg/.jpg/.png`） | 按 **png-only** 实现，并在尺寸卡片上标注「仅支持 .png」 |
| 3840×1646 / 3:2 的格式 | 规格表写 `.jpeg/.jpg/.png` | 统一导出 **PNG**——三处格式均合法，且无损、无压缩伪影，中文小字更清晰 |
| 3:2 是否只认这两个分辨率 | 规格表给的是 min/max 区间（1920×1280 ~ 3840×2560）而非枚举 | 提供 **3840×2560** 与 **1920×1280** 两个端点值；**不开放自定义**，避免区间内未列举的值被拒 |

> 早期曾提供过 `2880×1920` 这个中间值。因其既非规格表列举值也无实测安全区依据，已移除。

---

## 3. 交互设计

### 3.1 核心原则：两个工作台，不是一个工作台的两个尺寸

两者不是同一件事，塞进同一个面板列表只会互相拖累：

| | App 预览截图 | 创意素材 |
|:--|:--|:--|
| **表达什么** | 展示 App **在用**（Apple 强制要求） | 表达**品牌 / 季节 / 新内容** |
| **几何** | 竖屏设备尺寸，宽高比 ≈ 0.46 | 超宽横幅，宽高比 2.33 / 1.78 / 1.50 |
| **设计规则** | 信息密度高是优点 | Apple 明令 *"visually dense or cluttered assets dilute your impact"* |
| **素材输入** | 必须有 App 截图 | **常常完全不需要截图**，纯品牌排版也合法 |

由此推出一条硬约束：**现有的 6 个截图版式不可复用到创意素材**。「多机错落」（3 台手机 + 主副标题 + logo）恰恰是 Apple 对标题图警告的「视觉过载」样板。创意素材必须建立独立的版式体系。

### 3.2 整体框架

```
┌──────────────────────────────────────────────────────────────────────┐
│ ▣ App Preview Studio  [项目名]       3840 × 1646   [批量ZIP] [导出PNG] │ ← 顶栏（共享）
├──────────────────────────────────────────────────────────────────────┤
│  ▣ App 预览截图    │   ◇ 创意素材         安全区 1646×661 · ✓ 4/4     │ ← 工作台切换条
├───────────────┬──────────────────────────────────────────────────────┤
│ ① 坑位        │                                                     │
│ ② 变体组      │                                                     │
│ ③ 素材上传    │                  画布预览区                         │
│ ④ 版式        │                                                     │
│ ⑤ 主题        │                                                     │
│ ⑥ 品牌        │                                                     │
│ ⑦ 文案        │                                                     │
│ ⑧ 安全区检查 ⭐│                                                     │
│ ⑨ 合规检查   ⭐│                                                     │
│ ⑩ 项目        │                                                     │
└───────────────┴──────────────────────────────────────────────────────┘
```

**为什么切换条放第二行而不是塞进顶栏**：顶栏已有 logo / 项目名 / 尺寸徽章 / 两个按钮，再塞分段控件会很挤，且会让「项目名」的归属变模糊。第二行既能容纳清晰的 2 段切换，右侧还空得出位置放**当前模式的上下文信息**——这在截图模式下没有意义，正好强化两种模式的差异。

### 3.3 模式切换

- **2 段**：`App 预览截图` / `创意素材`。3 个坑位放在左侧面板顶部，因为坑位与截图模式的「导出尺寸」是同一层级（项目级设置）。
- **首次访问默认「App 预览截图」**，与现状行为逐像素一致。
- 记忆上次所在模式（localStorage key `app-preview-studio.mode`），下次直接回到该模式。
- 切换是即时的，**不重置任何数据**：两个 store 常驻，图片与配置互不干扰。

### 3.4 坑位（项目级）

坑位决定画布尺寸，与截图模式的 `sizeId` 同构。

| 卡片内容 | 说明 |
|:--|:--|
| 标题图 · 21:9 · 3840×1646 | 进入产品页的第一眼，表达品牌与季节内容 |
| 标题图 · 16:9 · 5244×2950 | 与搜索结果图共用，安全区最小（8.7%），最考验排版 |
| 搜索结果图 · 3:2 · 3840×2560 | 搜索列表里的首图，建议直观展示产品用途 |
| 搜索结果图 · 3:2 · 1920×1280 | 同上，较小尺寸（安全区由 3840×2560 等比推导） |
| 搜索结果图 · 16:9 · 5244×2950 | 与标题图共用 |

**尺寸选择方式**：两个坑位各自列出全部支持尺寸，点击即同时切换坑位与画布。5244 × 2950 在两处都会出现，标注「一份文件同时填标题图与搜索结果图」。

**切换尺寸不丢数据**：字号以「画布宽度比例」存储，3840 宽 → 5244 宽是 1.365 倍，画布显示宽度同为 1.365 倍，**屏幕上视觉大小完全不变**。版式参数以**安全区**为基准，同样等比缩放。用户在任意尺寸间切换都是无损的视觉转换，无需重调任何参数。

### 3.5 变体组（条目级）

对应截图模式的「截图组」，但语义不同：

- **为什么叫变体**：呼应 Asset Library 工作流——预先备好多套素材（如夏季版 / 冬季版 / 新版本），审核通过后上线时直接替换，**无需提交新版本**。这正是 Asset Library 存在的意义。
- **上限 12**（截图模式为 10），且**主体图可以留空**（纯品牌排版也合法）。
- 交互完全复用 `ScreenshotList.vue` 的缩略图条 + 新增/复制/删除模式，只是文案改为「变体」。

### 3.6 素材上传

复用 `ImageUploader.vue`，但**文案与语义不同**：

- 截图模式：`上传 App 截图`（拖拽 / ⌘V 粘贴），未上传时提示「当前显示的是示例界面」
- 创意素材：`上传主体图（可选）` + 副标题「不上传也可以，纯品牌排版同样合法」

主体图在版式中作为一个**自由视觉元素**出现（带可调圆角的圆角矩形），可以出血、可以压边。

> **关于取消手机边框面板**：按决策，创意素材模式**不提供手机边框（Phone Frame）面板**。因此版式体系从「手机 + 文字」改为「图片 + 文字」。这更贴合 Apple 对标题图的指导（表达品牌而非展示在用状态）。
> 需注意 Apple 对搜索结果的指导是 *"Showcase the firsthand experience"*——若搜索结果素材需要展示界面，用户上传真实 UI 截图即可满足，无需手机 mockup。

### 3.7 版式（几何以安全区为基准）

**关键设计决策：所有位置参数相对「安全区」定义，而非画布边缘。** 背景与出血元素仍相对画布，允许自由发挥。

| 版式 | 描述 | 参数（相对安全区） |
|:--|:--|:--|
| **居中主张** | logo + 主标题 + 副标题居中于安全区，无图 | 文本纵向位置、宽度 |
| **左文右图** | 文案在安全区左侧，主体图在右侧并可出血 | 文本宽度、文本位置、图尺寸、图位置、圆角 |
| **上文下图** | 文字占安全区上半，主体图在下半出血 | 文本位置、图尺寸、出血程度 |
| **纯品牌** | 仅 logo + 主张 + 背景，无图 | 文本纵向位置、宽度 |

这样做的收益：**版式天生不会越界**。越界只可能来自用户把文案写太长或字号调太大——而那正是安全区检查该抓的。

### 3.8 安全区检查 ⭐（核心差异化）

安全区 = Apple 所有裁切方式的**交集**。只要关键元素都在里面，任何设备任何方向都不会裁掉。因此**逻辑上它已经解决了约 80% 的正确性问题**——这也是本期不做设备裁切模拟器的理由（模拟器解决的是「能看到损失多少」的体验增强，不解决正确性）。

**三层反馈：**

**① 画布叠加层**
- 安全区外的区域压一层极淡遮罩（降低对比）
- 安全区边界 1px 虚线
- 越界元素描红边 + 半透明红色高亮
- 眼睛图标可切换叠加层（默认开启）

**② 面板列表**
逐元素校验，✓ / ✗ 标注具体超出量：

```
品牌 Logo        ✓
主标题           ✗  超出安全区 214px（下）
副标题           ✓
主体图           ✓
```

点击任意行 → 画布上对应元素闪烁一次定位。

**③ 顶栏徽章**
`安全区 ✓ 4/4`（绿） / `⚠ 2 项越界`（红），点击滚动到面板。

**测量方案**：用 `offsetWidth` / `offsetHeight` 取真实布局盒——**不受 CSS transform 影响**，因此预览区缩放到 0.2 时依然测得准确——与安全区矩形求交。无需新增测量机制，与现有架构天然契合。

> **顺带解决一个真实痛点**：标题图安全区只有 1646px 宽，主标题按 `0.05 × 3840 = 192px` 计算，一行仅约 8 个汉字，**2 行封顶**。截图模式那种长文案切过来必然撑爆。安全区检查会自动发现「文本换行后撑出安全区」，并可显示每行实际容量——中文用户不必自己算。

### 3.9 合规检查 ⭐（核心差异化）

Apple 对商店素材的硬性规则，实时扫描文案 + 品牌名 + 主体图文案：

| 规则 | 触发示例 | 依据 |
|:--|:--|:--|
| 禁止价格 / 折扣 | `¥` `$` `￥` `% off` 限时 折扣 立减 免费 特价 | Don't include specific pricing, discounts |
| 禁止网址 | `http` `www.` `.com` | Don't include website URLs |
| 禁止版权符号 | `©` `®` `™` | …copyright symbols |
| 禁止奖项 / 榜单 | `Editor's Choice` `App of the Day` `Game of the Day` `最佳应用` `年度` | Avoid unverifiable claims |
| 4+ 内容分级 | 少量敏感词弱提示 | Assets must meet a 4+ age rating |

全部通过显示绿色 ✓；命中则高亮对应文本并给出改写建议。**竞品目前都只是把这几条写成文字说明，无人做成机器校验**——这是最实在的差异化点。

### 3.10 空状态引导

进入创意素材模式后必须明确「这不是截图」：

- 切换条右侧提示：`标题图 · 表达品牌与季节内容，不是 App 截图`
- 首次进入自动展开「坑位」面板
- 画布占位沿用现有 `PlaceholderScreen`，文案改为 `上传主体图（可选），或直接用纯品牌排版`

---

## 4. 数据模型

```ts
// src/constants/placements.ts
export interface CanvasOption {
  width: number
  height: number
  label: string
}

export interface Placement {
  id: 'header' | 'search' | 'universal'
  name: string
  /** 比例标签，如 '21:9' */
  aspect: string
  /** 该坑位支持的画布尺寸（标题图 2 种、搜索结果图 3 种） */
  canvasOptions: CanvasOption[]
  /** 关键元素安全区（来自 Apple Sketch 模板实测） */
  safeArea: { x: number; y: number; width: number; height: number }
  /** 该素材可填的坑位 */
  fills: Array<'product-page-header' | 'search-results'>
  /** 坑位用途一句话说明 */
  note: string
  /** 特殊提示（如 5244×2950 安全区偏上） */
  warning?: string
}
```

```ts
// src/stores/creative.ts
export interface CreativeItem {
  id: string
  /** 主体图 dataURL；null = 纯品牌排版（合法） */
  image: string | null
  imageName: string | null
  bannerLayoutId: string
  themeId: string
  themeOverrides: Partial<ThemeTokens>
  headline: TextSpec
  subtitle: TextSpec
  /** 版式参数（相对安全区的比率） */
  params: Record<string, number>
  /** 主体图圆角 */
  imageRadius: number
}

export interface CreativeSnapshot {
  version: 1
  projectName: string
  placementId: string
  canvasId: string
  activeItemId: string
  /** 品牌独立于截图项目存储（见下） */
  brand: BrandSpec
  items: CreativeItem[]
}
```

**品牌为何独立存储**：保持两种素材完全隔离，避免交叉污染；且用户可能希望标题图用简化的单色 logo、截图用完整彩色版本。`BrandPanel` 在创意素材模式下额外提供一个「从截图项目复制品牌」按钮，既隔离又方便。

**上限**：`MAX_VARIANTS = 12`。

---

## 5. 隔离与兼容保障

**核心要求：不破坏任何现有功能。**

| 风险 | 保障措施 |
|:--|:--|
| **老用户项目丢失** | `app-preview-studio.project.v1` key **一个字不动**；创意素材使用新 key `app-preview-studio.creative.v1` |
| **现有 store 被污染** | **新建 `stores/creative.ts`**，不修改 `stores/project.ts` |
| **现有版式 / 尺寸被破坏** | `layouts.ts` / `sizes.ts` / 现有 9 个 panel 组件**全部不改**；新增 `bannerLayouts.ts` / `placements.ts` |
| **共享组件的改动风险** | `ThemePicker` / `TextEditor` / `BrandPanel` / `ImageUploader` / `ProjectPanel` **原样复用**。确需改文案时只加**可选 prop，默认值 = 现状** |
| **导出逻辑分叉** | `useExport` 截图路径完全保留。`ExportJob` 仅增加 `kind` 字段，隐藏容器用 `<component :is>` 挂载对应画布，**不复制逻辑** |
| **默认行为改变** | 首次访问模式 = 截图，与现状逐像素一致 |
| **项目 JSON 串味** | 截图项目导出**不含**创意素材，反之亦然（完全隔离） |
| **IndexedDB 冲突** | 变体 id 复用现有 `uid()`，天然不冲突，`imageStore.ts` **无需改动** |
| **零新依赖** | 模式切换是 store 状态，**不引入 vue-router** |

**回归验证**：现有 4 个 `verify:*` 脚本全部保持通过。

---

## 6. 文件清单

### 新增

```
src/constants/placements.ts             2 个坑位 × 5 个尺寸 + 各自安全区（数据驱动，便于修正）
src/data/bannerLayouts.ts               4 个横幅版式（以安全区为基准）
src/stores/creative.ts                  独立 store（items = 变体组）
src/components/stage/CreativeCanvas.vue 创意素材画布
src/components/stage/SafeAreaOverlay.vue 安全区叠加层 + 越界高亮
src/components/ModeSwitch.vue           工作台切换条
src/components/panels/PlacementPicker.vue   ① 坑位
src/components/panels/CompliancePanel.vue   ⑨ 合规检查
src/components/panels/SafeAreaPanel.vue     ⑧ 安全区检查
scripts/verify-creative.mjs             独立验证脚本
```

### 修改（增量）

```
src/composables/useExport.ts             ExportJob 增加 kind 字段
src/composables/usePersistence.ts        新增 creative store 的持久化
src/App.vue                              渲染切换条 + 隐藏容器动态挂载 + 顶栏徽章
src/components/panels/BrandPanel.vue     可选 prop：显示「从截图项目复制品牌」
```

### 零改动

```
src/stores/project.ts          src/constants/sizes.ts      src/data/layouts.ts
src/data/themes.ts             src/data/fonts.ts           src/data/frames.ts
src/utils/imageStore.ts        src/components/stage/ScreenshotCanvas.vue
src/components/stage/PreviewStage.vue  现有其余 panel 组件
```

---

## 7. 已完成：导出 alpha 通道修复（前置项）

新素材规格第一条就是 *"Images can't include alpha channels or transparencies"*，因此先修复了既有的导出问题。

**根因**：`modern-screenshot` 即使传入 `backgroundColor`，输出 PNG 始终为 `colorType 6 (RGBA)`。像素确实全不透明（实测 `minAlpha = 255`，0 个半透明采样），但**文件格式层面带 alpha 通道**。原 `verify-export.mjs` 仅用 `sips` 校验像素宽高，故长期未被发现。

**修复过程中的关键发现**——Chrome 对 PNG 编码的策略差异（Chrome 155 实测）：

| 方案 | colorType |
|:--|:--|
| `toDataURL('image/png')` + `alpha:false` 画布 | 6 ❌ |
| `putImageData` + `toDataURL` | 6 ❌ |
| 默认 alpha 画布 + `toDataURL` | 6 ❌ |
| **`toBlob('image/png')` + `alpha:false` 画布** | **2 ✅** |
| `OffscreenCanvas.convertToBlob` | 2 ✅ |

`toDataURL` 对 PNG **硬编码输出 RGBA**，不理会 context 的 alpha 设置；只有 `toBlob` 会尊重。第一版修复用了 `toDataURL`，被新增的断言直接测出 FAIL。

**改动**：
- `src/composables/useExport.ts` — 新增 `flattenToOpaquePng()`，导出末端重绘到 `alpha:false` 画布并用 `toBlob` 编码
- `scripts/verify-export.mjs` — 新增直读 PNG IHDR 的 colorType 断言（真正防回归的那道防线）
- `docs/sample-*.png` — 重新生成，现为 `colorType 2 (RGB)`

**验证**：`verify:export` / `verify:workflow` / `verify:fonts` / `verify:panel` 全部通过，`npm run build` 通过。附带收益：去掉 alpha 后样张体积下降约 18–20%。

---

## 8. 验证方案

`scripts/verify-creative.mjs`（`npm run verify:creative`），**23 项全部通过**：

| 用例 | 断言 | 结果 |
|:--|:--|:--|
| 模式切换 | 两种工作台可来回切换，截图项目数据完全不受影响 | ✅ |
| 尺寸矩阵 | 标题图 = 3840×1646 + 5244×2950；搜索结果图 = 3840×2560 + 1920×1280 + 5244×2950；去重共 5 项 | ✅ |
| 尺寸切换 | 切换后条目数据不丢；刷新后坑位与尺寸恢复 | ✅ |
| **Alpha 通道** | 导出 PNG `colorType = 2` | ✅ |
| **安全区** | 默认版式全部在安全区内；超长文案触发越界告警 | ✅ |
| 合规检查 | 价格 / 折扣、网址被命中 | ✅ |
| 持久化 | 刷新后工作台、坑位、尺寸恢复 | ✅ |
| 隔离性 | 两份项目 JSON 互不串味（截图 JSON 无 `bannerLayoutId`，创意 JSON 无 `frameId`） | ✅ |

**回归**：`verify:export` / `verify:workflow` / `verify:fonts` / `verify:panel` 全部保持通过；`npm run build` 通过。

**截图模式零影响（像素级证明）**：`TextLayer` 的行间距被抽成 `gapRatio` / `logoGapRatio` 两个可选 prop，取值默认 **0.032 / 0.022**——与原先硬编码的常量完全一致，因此截图模式渲染结果不变。实测：改动前后导出的 `docs/sample-minimal.png` 逐通道比对，**1070 万个通道最大差异 = 0**。

---

## 9. 风险与开放问题

| 项 | 说明 |
|:--|:--|
| 3:2 区间内非列举值是否受理 | 官方只给 min/max，未枚举；本期只提供 3840×2560 与 1920×1280 两个端点值，不开放自定义 |
| 各尺寸是否收 jpg | Help 写 jpg/png，但 5244×2950 那行明确 png-only；本期统一导出 PNG（三处均合法） |
| 安全区数值随模板更新而变 | 已数据化在 `placements.ts` 并注明出处，Apple 更新模板时改一处即可 |
| 5244×2950 安全区偏上 334px | 版式以安全区为基准可自动规避，但需在 UI 上明确提示，避免用户手动按视觉居中 |
| Apple 审核尺度 | 合规检查基于官方文档明文规则，Apple 实际审核可能有更严的内部标准，工具无法完全替代人工判断 |

---

## 10. 后续阶段（不在本期范围）

- **Phase 2**：设备裁切模拟器（iPhone / iPad × 横竖屏，模板中无裁切参考线，需另行推导）、多变体的 Asset Library 对接说明文案
- **Phase 3**：视频导出（5–30s / 30-60fps，需 `MediaRecorder` 或 ffmpeg.wasm）、In-App Event 素材（16:9 卡片 / 9:16 详情页）、ASC API 上传

---

## 11. 实现记录

Phase 1 落地时相对本文档的**修正与补充**：

| 项 | 设计时 | 实现后 | 原因 |
|:--|:--|:--|:--|
| 文案行间距 | 沿用截图模式的 `canvasW × 0.032` | 抽成 `TextLayer` 的可选 `gapRatio` / `logoGapRatio` prop，创意素材传 0.008 / 0.012 | 标题图安全区仅 661px 高，按 0.032 算间距是 123px，会把整块文案顶出安全区。默认值保持 0.032 / 0.022，**截图模式像素级不变** |
| 字号默认值 | 暂定 | 主标题 0.072→**0.034**、副标题 0.019→**0.015**、logo 0.05→**0.028** | 同上，默认值下「品牌 + 主标题 + 副标题」实测约 419px，在 661px 安全区内留有余量 |
| 遮罩强度 | 未定 | 安全区外压暗 **0.18**，边界用品牌蓝 + 白色描边 | 原先 0.36 的黑会把浅色主题压成中灰（用户会误以为主题坏了）；白色虚线在浅色主题上完全不可见 |
| 「上文下图」版式 | 图片按比例定位 | 增加 `BannerCtx.textBottom`，由画布实测文案块底边回填 | 实测发现图文重叠。文本高度随字体与换行变化，只有测量才知道。图片取「比例位置」与「文案底边下方」的较大者，自动避开 |
| 满幅图底版式 | 未考虑 | 满幅时**强制反色文字**为白色 | 主题 token 假定背景是自己的浅色渐变，深色文字压在深色遮罩上不可读（实测副标题几乎看不清）。用户仍可逐段覆盖 |
| 圆角语义 | px | `imageRadius` 存**画布宽度比例** | 与字号、版式参数一致，切坑位时等比缩放 |
| 安全区测量 | 用 `offsetWidth/Height` | 改用 `getBoundingClientRect` + 反算视觉缩放 | `offset*` 返回未缩放的布局值，而预览区对画布做了 `transform: scale()`；两者混用会得到错误比例（实现中确实踩过一次） |

**已知取舍**

- 主体图**默认不参与安全区检查**（可手动开启）。出血是常见设计意图，若一律判为越界会大量误报。
- 合规检查基于官方文档明文条款，Apple 实际审核尺度可能更严，无法完全替代人工判断（面板内已注明）。
- 1920 × 1280 的安全区是**推导值**（由 3840×2560 按 0.5 等比缩放），非 Apple 模板直接给出。UI 中标注「推导」以示区分。
- 创意素材的品牌与截图项目**独立存储**，另提供「从截图项目复制品牌」按钮，避免重复上传 logo。