import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { useProjectStore } from './stores/project'
import './assets/main.css'

// ── 字体包样式（JS import 让 Vite 处理字体 URL 与代码分割） ──
// MiSans（小米开源）：400 / 500 / 600 / 700 / 900 五个静态字重
import 'misans/lib/Normal/MiSans-Regular.min.css'
import 'misans/lib/Normal/MiSans-Medium.min.css'
import 'misans/lib/Normal/MiSans-Demibold.min.css'
import 'misans/lib/Normal/MiSans-Bold.min.css'
import 'misans/lib/Normal/MiSans-Heavy.min.css'
// 可变字体（SIL OFL）：思源黑体 / Inter / Montserrat / Playfair Display
import '@fontsource-variable/noto-sans-sc'
import '@fontsource-variable/inter'
import '@fontsource-variable/montserrat'
import '@fontsource-variable/playfair-display'
// Bebas Neue 单字重
import '@fontsource/bebas-neue/400.css'
// 子集化随包字体：得意黑 / 阿里巴巴普惠体（见 assets/fonts.css）
import './assets/fonts.css'

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.mount('#app')

// 开发期暴露 store，供 e2e / 视觉验证脚本驱动状态（生产构建会摇掉）
if (import.meta.env.DEV) {
  ;(window as unknown as { __studio?: unknown }).__studio = {
    store: useProjectStore(pinia),
  }
}
