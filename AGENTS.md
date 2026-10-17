# AGENTS.md

App Store 预览图生成器 —— 纯前端 Vue 3 SPA，无后端、无网络请求、无 CI。画布在隐藏容器中按 1:1 原始像素渲染后导出 PNG。

只写「不看就会做错」的信息。功能说明见 `README.md`，创意素材的设计推导见 `docs/creative-assets-design.md`。

## 命令

```bash
npm run dev         # Vite，默认 5173；被占用会自动跳 5174 / 5175 …
npm run typecheck   # vue-tsc -b
npm run build       # vue-tsc -b && vite build —— 已含 typecheck，不必先单独跑
```

仓库**没有** eslint / prettier / vitest / 单测。唯一的测试手段是下面的验证脚本。

## 验证脚本

```bash
npm run verify:export | verify:workflow | verify:fonts | verify:panel | verify:creative | verify:crop
```

两个硬前提，缺一个就会以假失败告终：

1. **dev server 必须在跑**（脚本打开真实页面操作）
2. Chrome 在硬编码路径 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`（仅 macOS）

脚本默认打 `http://localhost:5173/`。**Vite 在端口被占用时会自动跳号**，这时必须显式指定，否则脚本会连到别人的服务上：

```bash
APP_URL=http://localhost:5175/ npm run verify:creative
```

- 临时下载目录由 `mkdtemp` 创建、结束时自清；`KEEP=1` 保留产物供排查
- 失败时置 `process.exitCode = 1`
- `verify:creative`（46 项）动创意素材后必跑；`verify:crop`（59 项）动裁剪后必跑
- **断言要挑「跑不了假的」**：`verify:crop` 会解码导出的 PNG 逐点比色（源图用纯色），量出「成品里有多少像素不是源图颜色」。裁剪图片被外部 CSS 截断那条 bug 只有这种断言抓得到 —— 画布 box、DOM 宽高、比例全都正常。

## 架构

### 三个工作台，三套 store + 持久化

| 工作台 | store | localStorage key | 品牌 logo（IndexedDB） |
| :-- | :-- | :-- | :-- |
| App 预览截图 | `stores/project.ts` | `app-preview-studio.project.v1` | `__brand__` |
| 创意素材 | `stores/creative.ts` | `app-preview-studio.creative.v1` | `__creative_brand__` |
| 图片裁剪 | `stores/crop.ts` | `app-preview-studio.crop.v1` | 无（`brandKey: null`） |

工作台模式是 `stores/mode.ts` 的模块级单例（`app-preview-studio.mode`），**没有 vue-router**，默认 `screenshot`。

`app-preview-studio.project.v1` 是历史 key，**不能改**——改了用户已有项目就丢了。

`usePersistence.ts` 的 `wireStore` 收 `PersistableStore`（`brand` 与 `brandKey` 都可选），因此没有品牌图片的裁剪工作台能直接接入。

### 共享面板靠门面复用，不要为某个工作台复制面板

`stores/assetStore.ts` 里是三个门面，按需选：

| 门面 | 服务的面板 | 覆盖工作台 |
| :-- | :-- | :-- |
| `useAssetStore()` → `SharedAssetStore` | `ThemePicker` / `TextEditor` / `BrandPanel` 等做设计的面板 | 截图 / 创意素材 |
| `useProjectPanelStore()` → `ProjectStoreLike` | `ProjectPanel` | **全部三个** |
| `usePlacementStore()` → `PlacementStoreLike` | `PlacementPicker` | 创意素材 / 图片裁剪 |

**新增共享面板要用的字段时必须同时改三处**：`SharedAssetStore` 接口 + `project.ts` + `creative.ts`。漏掉任一处 `vue-tsc` 会报错。

⚠️ 裁剪工作台**不满足** `SharedAssetStore`（没有主题 / 文案 / 品牌），别为了复用面板去伪造一个空 `brand`——那会把「本工作台只做裁剪」这个边界弄糊。

### 排版基准是 `designWidth`，不是画布宽度

字号 / 行距 / logo 尺寸 / 所有 px 读数都以 `SharedAssetStore.designWidth` 为比例基数：

- 截图模式 → `canvasSize.width`（画布本身就是排版容器）
- 创意素材 → **`safeArea.width`**（安全区才是排版容器）

安全区占画布宽度的比例在五个尺寸间从 **26.7% 到 56.5%** 不等。若按画布宽度定字号，同一份参数在 5244×2950 上每行只剩 7 个汉字、在 3840×1646 上有 11 个。这个坑踩过一次（`docs` §12），`verify:creative` 有两条断言锁着。

⚠️ 面板里的 px 读数（`TextEditor` / `BrandPanel`）也必须用 `designWidth`；用 `canvasSize.width` 会让创意素材下的读数比实际渲染值大 2.3 倍。

### 画布组件只写内联样式

`components/stage/*Canvas.vue` **一个 Tailwind class 都不能有**。预览与导出共用同一组件、同一套样式，任何依赖外部 CSS 的写法在导出时都会失真。Tailwind 只用于 `panels/`、`ui/` 与外壳（含 `StageZoomBar.vue` / `*Stage.vue`）。

### 预览视口：缩放 / 平移由 `useStageViewport` 统一管

`composables/useStageViewport.ts` 同时服务三个工作台，**不要在 `*Stage.vue` 里另写一份 `fit()`**。

- 缩放 = `fitScale`（窗口自适应）× `zoom`（用户档位，1 = 适应窗口）
- **画布尺寸变化必须重算缩放**：原先只在宿主容器 ResizeObserver 里算，而切换尺寸不会改变宿主尺寸 —— 于是切到 5244×2950 时沿用上一个尺寸的缩放，画布被撑到宿主 2.5 倍、只能看到中间一块（`docs` §13）。`verify:creative` 有断言锁着这条。
- `1:1` 档位对准**安全区**而非画布中心（安全区只占画布 26.7% 宽且垂直偏上 334px；裁剪工作台同理——用户要核对的正是安全区里有没有关键内容）
- 平移量必须夹在内容边界内，否则画布会被拖丢
- 该模块**不自己挂监听**，只导出 `onWheel` / `onPointerDown`，由各 stage 绑到宿主上（因此每个 stage 只有一个滚轮处理器）
- 裁剪工作台的滚轮要**分流**：裸滚轮改构图、`⌘/Ctrl + 滚轮`才转交 `onWheel`（`CropStage.vue` 是唯一的区分点）。反过来，按在画布上拖拽时 `onPointerDown` 必须被 `stopPropagation` 挡住（那是调整构图，不是平移预览）

### 横幅版式必须声明 `usesImage`

`data/bannerLayouts.ts` 每个版式都要写 `usesImage: boolean`，**不能靠读 `resolve` 的结果推断** —— 面板要在「有图但版式不画图」时提前提示，那时没有可信的 ctx 可算。

- 记忆点：`resolve` 里返回 `image: null` 的版式（默认的「居中主张」就是），`usesImage` 必须为 `false`
- 上传主体图走 `stores/creative.ts` 的 **`setImage()`**，不要直接 `patchActive({ image })` —— 只有 `setImage` 会在当前版式不画图时自动换版式（否则上传后画布毫无变化，用户只能判定为 bug，`docs` §14）
- 拖拽 / 粘贴与点击选择两条上传路径必须共用 `setImage()`，否则行为不一致
- `verify:creative` 逐个版式交叉验证「标注 vs 实际渲染」，两个方向都锁着：既防「标了用图却不画」，也防「画了却标纯排版」

### 裁剪工作台：画框锁定比例，构图存相对量

`stores/crop.ts` + `utils/cropGeometry.ts`（纯函数，无 Vue 依赖）。核心是把构图存成**相对量**而不是像素：

- `zoom` = 相对「刚好铺满画框」的倍数，下限 **1** —— 不允许缩到露底，露底就得替用户选一个他从未表达过的背景色；上限 4（再多源图必然糊）
- `offset` = 归一化到「多余空间」的比例，两个轴各自 ∈ [-1, 1]：`-1` 贴左上 / `0` 居中 / `+1` 贴右下
- 于是切画框尺寸时构图意图自动保留（21:9 上「看右边」，切到 3:2 还是「看右边」），不需要重裁四遍
- 某轴没有多余空间（`slack = 0`）时该轴偏移锁 0，且**面板不显示那个滑杆** —— 否则「滑了画布不动」就是「用户看不到反馈」

**两层缩放必须分清**：画布上的滚轮改**构图**（源图在框内多大），`⌘/Ctrl + 滚轮`改**预览**（画布在屏幕上多大）。`CropStage.vue` 是唯一区分它们的地方。

导入统一走 `composables/useCropImport.ts` 的 `importFiles()`（点击 / 拖拽 / 粘贴三条路径共用，空位优先 + 上限 12）。

### 导出路径

`App.vue` 底部有个 `fixed -left-[100000px]` 的隐藏容器，`useExport` 在其中按 1:1 渲染后 `domToPng`。`CreativeCanvas` 与 `CropCanvas` 在那里必须传 `overlay="false"` —— 安全区叠加层绝不能进导出成品。

## 陷阱清单（都真踩过）

- **导出 PNG 必须无 alpha 通道**（Apple 硬性要求）。像素全不透明 ≠ 没有 alpha 通道：modern-screenshot 输出的是 `colorType 6`（RGBA）。末端由 `flattenToOpaquePng()` 重绘到 `alpha:false` 画布剥离。校验方式是读 PNG 第 25 字节（IHDR colorType），`2` 才是 RGB。
- **剥离 alpha 只能用 `canvas.toBlob()`，不能用 `toDataURL()`**。Chrome 的 `toDataURL('image/png')` 无视 `{alpha: false}`，一律输出 `colorType 6`（实测 Chrome 155）。第一版修复就栽在这里。
- **画布里的 `<img>` 必须显式写 `maxWidth: 'none'`**。Tailwind preflight 给所有 `img` 设了 `max-width: 100%`，于是超出容器的图片会被**静默裁到容器宽度**。裁剪工作台的图片按设计必然超出画框（铺满后再放大），实测放大 180% 时右侧 31% 变成空白 —— 而画布 box、`img.style.width`、宽高比全部正常，只有**逐像素比色**才看得出来（`verify:crop` 有这条断言）。另外两个画布撞不到，因为它们的图片始终在画布内。
- **画布里的 `<img>` 必须写 `draggable="false"`**。Chrome 默认允许拖拽 `<img>`，而 `useImageUpload` 在 window 上监听 `drop`：在画布上拖图会变成「拖出一张图再 drop 回来」，凭空多导入一条（裁剪工作台尤其明显），或把当前截图/主体图重新导入一次。`PhoneFrame.vue` 早就有这个属性，其余画布是后补的。
- **测元素位置必须用 `getBoundingClientRect()`**，不能用 `offsetWidth/offsetHeight/offsetLeft`。预览区对画布做了 `transform: scale()`（横幅常只有 0.2），`offset*` 返回**未缩放**的布局值，两者混用会得到错误比例。正确做法是用 `rect.width / canvasWidth` 反算真实缩放再除回去（见 `useSafeArea.ts`）。踩过两次。
- **安全区是「每个画布尺寸各自」的值**，不是「每个坑位一个、换尺寸等比缩放」。逐尺寸登记在 `constants/placements.ts`；1920×1280 是推导值（UI 标「推导」）。
- **Sketch 文件的 group `frame` 字段不可信**（有复制残留的过期值）。解析 Apple 官方模板必须用父组 `x/y` + 组内**叶子矩形**的 `w/h`；读组 frame 会让 5244×2950 的安全区错成 1658×1060。
- **`domToPng` 的 `font.cssText` 必须非空**，哪怕只填 `/* comment */`。传空串会 fallback 到库的「全量抓取 @font-face」分支，体积失控（MiSans 每字重 56 个 unicode-range 分片）。
- **验证脚本取产物必须按 mtime**（`latestPng()` / `latestFile()`），不能按文件名排序——文件名含比例（`21x9` / `16x9` / `3x2`）与像素尺寸，字典序与时间顺序无关。
- **验证脚本往 store 里塞假数据必须塞「能真正解码」的**。为填满条目数而 `importImage('data:image/png;base64,x', …)` 会引发 `ERR_INVALID_URL`，把「页面无错误」那条断言污染成假失败——用 canvas 现画一个 4×4 的合法 dataURL。
- **「用户看不到反馈」按 bug 处理**：上传主体图后画布毫无变化，根因是默认版式不绘制图片而无人告知。版式意图合法要保留，但交互必须补出口——上传后自动换版式、画布上给一键切换、版式卡片标注「用图 / 纯排版」（`docs` §14）。同类信号：任何「操作成功但界面无变化」的路径都要检查（`slack = 0` 的滑杆也属于此类，见 `docs` §15）。

## 约定

- UI 文案、代码注释、commit message **全部中文**。
- commit 用 conventional commits（`feat:` / `fix:` / `docs:`），**body 写清根因与实测数据**，而不是罗列改动。
- 改截图模式相关代码后要确认「截图模式像素级不变」——验证脚本里有对应断言（如 `designWidth === canvasSize.width`）。
- 排版参数一律**存比率**（占画布宽度 / 安全区宽度的比例），不存 px；这样切换尺寸时等比缩放，用户无需重调。
- 公开仓库（`origin` = `KKKyrie/app-preview-studio`）。历史习惯是在本地 `main` 上 commit，**推送前先问用户**。
