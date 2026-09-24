<div align="center">

# 📱 App Preview Studio

**App Store 预览截图生成器**

上传 App 截图 → 选择官方尺寸 → 套用版式 / 手机边框 / 主题 → 一键导出**精确像素**、**不带透明通道**的 PNG

纯前端 · 本地运行 · 数据不出你的机器

<p>
  <img src="https://img.shields.io/badge/Vue-3.5-42b883?style=flat-square&logo=vuedotjs&logoColor=white" alt="Vue 3.5">
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 8">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4">
  <img src="https://img.shields.io/badge/App%20Store%20Connect-%E5%B0%BA%E5%AF%B8%E5%AE%9E%E6%B5%8B-0071E3?style=flat-square" alt="尺寸实测">
</p>

<img src="docs/ui.png" width="900" alt="App Preview Studio 工作台">

<p>
  <img src="docs/sample-minimal.png" width="255" alt="极简白主题导出成品">
  <img src="docs/sample-dark.png" width="255" alt="深色高级主题导出成品">
  <img src="docs/sample-aurora.png" width="255" alt="Aurora 主题导出成品">
</p>
<p align="center">
  <sub>同一套文案 × 三种主题：<b>极简白</b> / <b>深色高级</b> / <b>Aurora + 得意黑标题</b> —— 均为真实导出的 1284 × 2778 PNG</sub>
</p>

</div>

---

## ✨ 特色

### 📐 官方尺寸，开箱即用

- **iPhone 6.5"**（1284 × 2778 / 1242 × 2688）与 **iPad 13"**（2064 × 2752 / 2048 × 2732）四档，按 App Store Connect 后台**实测**收敛
- 竖屏 / 横屏一键切换（交换宽高），同档位内自由切换分辨率

### 🎨 版式 · 边框 · 主题

- **6 种版式**：文案在上 / 文案在下 / 左文右机 / 手机出血 / 居中夹持 / 多机错落，间距、宽度、比例全部滑杆微调
- **5 种手机边框**：灵动岛 / 刘海 / Home 键 / iPad 窄边框 / 裸屏圆角 —— 纯 CSS/SVG 自绘，任意分辨率下保持锐利
- **10 套主题**：极简白、深色高级、品牌纯色、Aurora、摄影棚、粗排版海报、马卡龙、neon 辉光、纸感噪点、Mesh 渐变

### 🔤 字体与品牌

- **10 种字体**：系统默认 / 苹方（PingFang SC）/ MiSans / 得意黑 / 阿里巴巴普惠体 / 思源黑体 / Inter / Montserrat / Playfair Display / Bebas Neue
- 主副标题**各自独立**选字体、选字重；字重按钮按字体实际字重**过滤**，切换字体自动钳制到最近可用字重；字体 chips 用本字体渲染实时预览
- **品牌 Logo + 品牌名**展示在每张截图的主标题上方（项目级，全组共用）：圆角（直角 → iOS 图标 → 圆形）、高度、字号滑杆可调

### 🖼 导出与工程

- 隐藏容器按 **1:1 原始像素**渲染后截图，输出**精确尺寸、不带 Alpha 通道**的 PNG（符合 Apple 上架规格）；多张可打包 **ZIP** 批量导出
- **webfont 按用量内嵌**：字体族 + CSS 字重匹配 + unicode-range ∩ 实际字符，三层过滤后转 base64 注入 —— 导出图在任何机器上渲染一致，不依赖本机字体
- 截图组最多 10 张（App Store 单尺寸上限），可新增 / 复制 / 删除；编辑内容**自动保存**（配置存 localStorage、图片存 IndexedDB），项目可导出 / 导入 JSON 跨设备迁移
- 图片**点击选择 / 拖拽到窗口 / ⌘V 粘贴**均可；左侧表单面板宽度可**拖拽调节**（双击恢复默认）

## 🚀 快速开始

```bash
git clone https://github.com/KKKyrie/app-preview-studio.git
cd app-preview-studio
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # vue-tsc 类型检查 + 产物构建（dist/）
npm run preview    # 预览构建产物
```

## 📐 导出尺寸

| 设备 | 尺寸（px） | 对应机型（部分） |
| :-- | :-- | :-- |
| iPhone 6.5" | **1284 × 2778** | iPhone 14/13/12 Pro Max、15/16 Plus、16 Pro 等 |
| iPhone 6.5" | **1242 × 2688** | iPhone 11 Pro Max、XS Max、11、XR 等 |
| iPad 13" | **2064 × 2752** | iPad Pro 13"（M4）等 |
| iPad 13" | **2048 × 2732** | iPad Pro 12.9"（M1–M2）等 |

> 横屏 = 交换宽高；同档位内 App Store 会自动缩放，每个尺寸组最多 10 张。

## 🧪 验证脚本

需要本机安装 Chrome，且 `npm run dev` 正在运行：

| 命令 | 覆盖内容 |
| :-- | :-- |
| `npm run verify:export` | 单张导出 → 校验 PNG 像素尺寸与不透明输出 |
| `npm run verify:workflow` | 批量 ZIP 导出 + 刷新后项目状态恢复 |
| `npm run verify:fonts` | 字体选择 + 品牌 Logo / 名字（导出、刷新恢复、视觉产物） |
| `npm run verify:panel` | 左侧面板拖拽调宽（默认 / 最小 320、双击复位、刷新保留） |
| `npm run capture:styles` | 6 布局 × 5 边框 × 10 主题 对比图 contact sheet |
| `npm run docs:capture` | 重新生成本 README 的界面截图与主题样张（`docs/`） |

## 🔤 字体与授权

- **苹方 PingFang SC**：Apple 系统字体，随 macOS / iOS 分发（仅本机渲染，不内嵌）
- **MiSans**（小米）、**得意黑 Smiley Sans**、**阿里巴巴普惠体**、**思源黑体 Noto Sans SC**、**Inter**、**Montserrat**、**Playfair Display**、**Bebas Neue**：均为免费商用 / SIL OFL 开源字体
- 得意黑与普惠体已按 **GB2312 + ASCII 子集化**后随包分发（`src/assets/fonts/`），其余走 npm 字体包由 Vite 处理
- 「腾讯字体」为腾讯品牌定制字体（Monotype），不可自由分发，**未收录**

## 🛠 技术栈

- **框架**：Vue 3.5 · TypeScript · Vite 8 · Tailwind CSS 4 · Pinia
- **导出**：modern-screenshot（1:1 渲染 + 字体内嵌注入）· fflate（ZIP 打包）
- **验证**：puppeteer-core 无头 Chrome 驱动全流程

导出管线：TreeWalker 收集画布实际用字 → 按 CSS Fonts 规范挑选字重 → unicode-range 与实际字符求交 → `url(...)` 转 base64 → 强制 `document.fonts` 就绪后截图。

## 📁 目录结构

```
src/
  constants/sizes.ts        # App Store Connect 实测截图尺寸表
  data/{layouts,frames,themes,fonts}.ts   # 注册表：版式 / 边框 / 主题 / 字体
  stores/project.ts         # 项目状态 + 品牌 + 截图组管理 + 快照/恢复
  composables/
    useExport.ts            # 1:1 渲染导出 / 批量 ZIP / 字体按用量内嵌
    usePersistence.ts       # localStorage + IndexedDB 自动保存
    useImageUpload.ts       # 拖拽 / 粘贴上传
    usePanelWidth.ts        # 左侧面板拖拽调宽（最小 = 默认 320px）
  assets/
    fonts.css               # 随包子集化字体 @font-face（得意黑 / 普惠体）
    fonts/                  # GB2312+ASCII 子集化 woff2（pyftsubset 生成）
  components/
    stage/                  # 画布渲染（内部仅内联样式，保证导出一致）
    panels/                 # 左侧功能面板（含 BrandPanel 品牌面板）
    ui/                     # 面板基础组件
scripts/                    # 无头浏览器验证 / 配图生成脚本
docs/                       # README 配图（界面截图 + 主题样张）
```

## 📝 备注

- 尺寸表以 **2026-09 App Store Connect** 后台实际要求为准，并对照 [Apple 官方截图规格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications) 核验
- 所有数据只保存在本机浏览器，应用无任何后端、无网络请求
