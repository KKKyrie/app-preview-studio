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
npm run verify:export | verify:workflow | verify:fonts | verify:panel | verify:creative
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
- `verify:creative` 断言最多（32 项），动创意素材后必跑

## 架构

### 两个工作台，两套 store + 持久化

| 工作台 | store | localStorage key | 品牌 logo（IndexedDB） |
| :-- | :-- | :-- | :-- |
| App 预览截图 | `stores/project.ts` | `app-preview-studio.project.v1` | `__brand__` |
| 创意素材 | `stores/creative.ts` | `app-preview-studio.creative.v1` | `__creative_brand__` |

工作台模式是 `stores/mode.ts` 的模块级单例（`app-preview-studio.mode`），**没有 vue-router**，默认 `screenshot`。

`app-preview-studio.project.v1` 是历史 key，**不能改**——改了用户已有项目就丢了。

### 共享面板靠门面复用，不要为某个工作台复制面板

`stores/assetStore.ts` 的 `useAssetStore()` 按当前模式返回两个 store 之一，静态类型是 `types/index.ts` 的 `SharedAssetStore`。`ThemePicker` / `TextEditor` / `BrandPanel` / `ProjectPanel` 等只依赖这个接口。

**新增共享面板要用的字段时必须同时改三处**：`SharedAssetStore` 接口 + `project.ts` + `creative.ts`。漏掉任一处 `vue-tsc` 会报错。

### 排版基准是 `designWidth`，不是画布宽度

字号 / 行距 / logo 尺寸 / 所有 px 读数都以 `SharedAssetStore.designWidth` 为比例基数：

- 截图模式 → `canvasSize.width`（画布本身就是排版容器）
- 创意素材 → **`safeArea.width`**（安全区才是排版容器）

安全区占画布宽度的比例在五个尺寸间从 **26.7% 到 56.5%** 不等。若按画布宽度定字号，同一份参数在 5244×2950 上每行只剩 7 个汉字、在 3840×1646 上有 11 个。这个坑踩过一次（`docs` §12），`verify:creative` 有两条断言锁着。

⚠️ 面板里的 px 读数（`TextEditor` / `BrandPanel`）也必须用 `designWidth`；用 `canvasSize.width` 会让创意素材下的读数比实际渲染值大 2.3 倍。

### 画布组件只写内联样式

`components/stage/*Canvas.vue` **一个 Tailwind class 都不能有**。预览与导出共用同一组件、同一套样式，任何依赖外部 CSS 的写法在导出时都会失真。Tailwind 只用于 `panels/`、`ui/` 与外壳（含 `StageZoomBar.vue` / `*Stage.vue`）。

### 预览视口：缩放 / 平移由 `useStageViewport` 统一管

`composables/useStageViewport.ts` 同时服务两个工作台，**不要在 `*Stage.vue` 里另写一份 `fit()`**。

- 缩放 = `fitScale`（窗口自适应）× `zoom`（用户档位，1 = 适应窗口）
- **画布尺寸变化必须重算缩放**：原先只在宿主容器 ResizeObserver 里算，而切换尺寸不会改变宿主尺寸 —— 于是切到 5244×2950 时沿用上一个尺寸的缩放，画布被撑到宿主 2.5 倍、只能看到中间一块（`docs` §13）。`verify:creative` 有断言锁着这条。
- `1:1` 档位对准**安全区**而非画布中心（安全区只占画布 26.7% 宽且垂直偏上 334px）
- 平移量必须夹在内容边界内，否则画布会被拖丢

### 导出路径

`App.vue` 底部有个 `fixed -left-[100000px]` 的隐藏容器，`useExport` 在其中按 1:1 渲染后 `domToPng`。`CreativeCanvas` 在那里必须传 `overlay="false"` —— 安全区叠加层绝不能进导出成品。

## 陷阱清单（都真踩过）

- **导出 PNG 必须无 alpha 通道**（Apple 硬性要求）。像素全不透明 ≠ 没有 alpha 通道：modern-screenshot 输出的是 `colorType 6`（RGBA）。末端由 `flattenToOpaquePng()` 重绘到 `alpha:false` 画布剥离。校验方式是读 PNG 第 25 字节（IHDR colorType），`2` 才是 RGB。
- **剥离 alpha 只能用 `canvas.toBlob()`，不能用 `toDataURL()`**。Chrome 的 `toDataURL('image/png')` 无视 `{alpha: false}`，一律输出 `colorType 6`（实测 Chrome 155）。第一版修复就栽在这里。
- **测元素位置必须用 `getBoundingClientRect()`**，不能用 `offsetWidth/offsetHeight/offsetLeft`。预览区对画布做了 `transform: scale()`（横幅常只有 0.2），`offset*` 返回**未缩放**的布局值，两者混用会得到错误比例。正确做法是用 `rect.width / canvasWidth` 反算真实缩放再除回去（见 `useSafeArea.ts`）。踩过两次。
- **安全区是「每个画布尺寸各自」的值**，不是「每个坑位一个、换尺寸等比缩放」。逐尺寸登记在 `constants/placements.ts`；1920×1280 是推导值（UI 标「推导」）。
- **Sketch 文件的 group `frame` 字段不可信**（有复制残留的过期值）。解析 Apple 官方模板必须用父组 `x/y` + 组内**叶子矩形**的 `w/h`；读组 frame 会让 5244×2950 的安全区错成 1658×1060。
- **`domToPng` 的 `font.cssText` 必须非空**，哪怕只填 `/* comment */`。传空串会 fallback 到库的「全量抓取 @font-face」分支，体积失控（MiSans 每字重 56 个 unicode-range 分片）。
- **`verify-creative.mjs` 取产物必须按 mtime**（`latestPng()`），不能按文件名排序——文件名含比例（`21x9` / `16x9` / `3x2`），字典序与时间顺序无关。

## 约定

- UI 文案、代码注释、commit message **全部中文**。
- commit 用 conventional commits（`feat:` / `fix:` / `docs:`），**body 写清根因与实测数据**，而不是罗列改动。
- 改截图模式相关代码后要确认「截图模式像素级不变」——验证脚本里有对应断言（如 `designWidth === canvasSize.width`）。
- 排版参数一律**存比率**（占画布宽度 / 安全区宽度的比例），不存 px；这样切换尺寸时等比缩放，用户无需重调。
- 公开仓库（`origin` = `KKKyrie/app-preview-studio`）。历史习惯是在本地 `main` 上 commit，**推送前先问用户**。
