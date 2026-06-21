import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '杭州事业编备考',
  description: '2026 浙江杭州区县事业单位考试备考知识库',
  lang: 'zh-CN',
  base: '/nw/',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,

  head: [
    ['meta', { name: 'theme-color', content: '#c0392b' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }]
  ],

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '时政', link: '/reference/01-时政热点/知识点' },
      { text: '政治', link: '/reference/02-政治理论/知识点' },
      { text: '法律', link: '/reference/03-法律常识/知识点' },
      { text: '经济', link: '/reference/04-经济常识/知识点' },
      { text: '公文', link: '/reference/05-公文知识/知识点' },
      { text: '管理', link: '/reference/06-管理常识/知识点' },
      { text: '文史', link: '/reference/07-文史常识/知识点' },
      { text: '科技地理', link: '/reference/08-科技地理/知识点' },
      { text: '浙江省情', link: '/reference/09-浙江省情杭州市情/知识点' },
      { text: '写作', link: '/reference/10-写作热点/知识点' },
      { text: '题库', link: '/题库/01-全真模拟卷一' }
    ],

    sidebar: {
      '/reference/01-时政热点/': [
        {
          text: '时政热点 (~25%)',
          collapsed: false,
          items: [
            { text: '知识点', link: '/reference/01-时政热点/知识点' },
            { text: '速记口诀', link: '/reference/01-时政热点/速记口诀' },
            { text: '易混对比', link: '/reference/01-时政热点/易混对比' },
            { text: '高频真题', link: '/reference/01-时政热点/高频真题' },
            { text: '2026 更新', link: '/reference/01-时政热点/2026更新' }
          ]
        }
      ],
      '/reference/02-政治理论/': [
        {
          text: '政治理论 (~20%)',
          collapsed: false,
          items: [
            { text: '知识点', link: '/reference/02-政治理论/知识点' },
            { text: '速记口诀', link: '/reference/02-政治理论/速记口诀' },
            { text: '易混对比', link: '/reference/02-政治理论/易混对比' },
            { text: '高频真题', link: '/reference/02-政治理论/高频真题' },
            { text: '2026 更新', link: '/reference/02-政治理论/2026更新' }
          ]
        }
      ],
      '/reference/03-法律常识/': [
        {
          text: '法律常识 (~20%)',
          collapsed: false,
          items: [
            { text: '知识点', link: '/reference/03-法律常识/知识点' },
            { text: '速记口诀', link: '/reference/03-法律常识/速记口诀' },
            { text: '易混对比', link: '/reference/03-法律常识/易混对比' },
            { text: '高频真题', link: '/reference/03-法律常识/高频真题' },
            { text: '2026 更新', link: '/reference/03-法律常识/2026更新' }
          ]
        }
      ],
      '/reference/04-经济常识/': [
        {
          text: '经济常识 (~12%)',
          collapsed: false,
          items: [
            { text: '知识点', link: '/reference/04-经济常识/知识点' },
            { text: '速记口诀', link: '/reference/04-经济常识/速记口诀' },
            { text: '易混对比', link: '/reference/04-经济常识/易混对比' },
            { text: '高频真题', link: '/reference/04-经济常识/高频真题' },
            { text: '2026 更新', link: '/reference/04-经济常识/2026更新' }
          ]
        }
      ],
      '/reference/05-公文知识/': [
        {
          text: '公文知识 (~10%)',
          collapsed: false,
          items: [
            { text: '知识点', link: '/reference/05-公文知识/知识点' },
            { text: '速记口诀', link: '/reference/05-公文知识/速记口诀' },
            { text: '易混对比', link: '/reference/05-公文知识/易混对比' },
            { text: '高频真题', link: '/reference/05-公文知识/高频真题' }
          ]
        }
      ],
      '/reference/06-管理常识/': [
        {
          text: '管理常识 (~6%)',
          collapsed: false,
          items: [
            { text: '知识点', link: '/reference/06-管理常识/知识点' },
            { text: '速记口诀', link: '/reference/06-管理常识/速记口诀' },
            { text: '易混对比', link: '/reference/06-管理常识/易混对比' },
            { text: '高频真题', link: '/reference/06-管理常识/高频真题' }
          ]
        }
      ],
      '/reference/07-文史常识/': [
        {
          text: '文史常识 (~9%)',
          collapsed: false,
          items: [
            { text: '知识点', link: '/reference/07-文史常识/知识点' },
            { text: '速记口诀', link: '/reference/07-文史常识/速记口诀' },
            { text: '易混对比', link: '/reference/07-文史常识/易混对比' },
            { text: '高频真题', link: '/reference/07-文史常识/高频真题' }
          ]
        }
      ],
      '/reference/08-科技地理/': [
        {
          text: '科技地理 (~9%)',
          collapsed: false,
          items: [
            { text: '知识点', link: '/reference/08-科技地理/知识点' },
            { text: '速记口诀', link: '/reference/08-科技地理/速记口诀' },
            { text: '易混对比', link: '/reference/08-科技地理/易混对比' },
            { text: '高频真题', link: '/reference/08-科技地理/高频真题' }
          ]
        }
      ],
      '/reference/09-浙江省情杭州市情/': [
        {
          text: '浙江省情杭州市情 (~4%)',
          collapsed: false,
          items: [
            { text: '知识点', link: '/reference/09-浙江省情杭州市情/知识点' },
            { text: '速记口诀', link: '/reference/09-浙江省情杭州市情/速记口诀' },
            { text: '易混对比', link: '/reference/09-浙江省情杭州市情/易混对比' },
            { text: '高频真题', link: '/reference/09-浙江省情杭州市情/高频真题' },
            { text: '2026 更新', link: '/reference/09-浙江省情杭州市情/2026更新' }
          ]
        }
      ],
      '/reference/10-写作热点/': [
        {
          text: '写作热点 (主观题)',
          collapsed: false,
          items: [
            { text: '知识点', link: '/reference/10-写作热点/知识点' },
            { text: '策论文框架', link: '/reference/10-写作热点/策论文框架' },
            { text: '金句储备', link: '/reference/10-写作热点/金句储备' },
            { text: '范文拆解', link: '/reference/10-写作热点/范文拆解' },
            { text: '2026 热点话题', link: '/reference/10-写作热点/2026热点话题' }
          ]
        }
      ],
      '/题库/': [
        {
          text: '题库',
          collapsed: false,
          items: [
            { text: '全真模拟卷一', link: '/题库/01-全真模拟卷一' },
            { text: '全真模拟卷二', link: '/题库/02-全真模拟卷二' },
            { text: '历年真题精选', link: '/题库/03-历年真题精选' }
          ]
        }
      ],
      '/答题模板与速记卡/': [
        {
          text: '答题模板与速记卡',
          collapsed: false,
          items: [
            { text: '答题模板', link: '/答题模板与速记卡/答题模板' },
            { text: '速记卡', link: '/答题模板与速记卡/速记卡' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/yardfarmer/nw' }
    ],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档'
          },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换'
            }
          }
        }
      }
    },

    outline: {
      label: '本页目录',
      level: [2, 3]
    },

    docFooter: {
      prev: '上一页',
      next: '下一页'
    },

    lastUpdatedText: '最后更新',

    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',

    footer: {
      message: '2026 杭州事业编备考 · 知识库 v2',
      copyright: '干在实处 · 走在前列 · 勇立潮头'
    }
  },

  markdown: {
    lineNumbers: false,
    theme: { light: 'github-light', dark: 'github-dark' }
  }
})
