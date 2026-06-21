import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import SmartPlayer from './components/SmartPlayer.vue'
import './theme.css'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(SmartPlayer),
    })
  },
}
