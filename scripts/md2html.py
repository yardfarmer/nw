#!/usr/bin/env python3
"""将 reference/ 下的 Markdown 文件转换为微信友好的自包含 HTML"""

import os
import re
import sys
import markdown
from pathlib import Path

CSS = """
:root {
  --bg: #fefefe;
  --fg: #1a1a1a;
  --accent: #c0392b;
  --accent2: #e67e22;
  --accent3: #27ae60;
  --muted: #666;
  --border: #e0e0e0;
  --card-bg: #f8f8f8;
  --toc-bg: #faf5f0;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
}

body {
  font-family: -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
    "Noto Sans CJK SC", sans-serif;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.8;
  padding: 0;
  max-width: 100%;
  overflow-x: hidden;
}

.container {
  max-width: 680px;
  margin: 0 auto;
  padding: 20px 16px 60px;
}

/* 顶部标题区 */
.header {
  text-align: center;
  padding: 32px 0 20px;
  border-bottom: 2px solid var(--accent);
  margin-bottom: 24px;
}

.header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.05em;
}

.header .subtitle {
  font-size: 0.85rem;
  color: var(--muted);
  margin-top: 4px;
}

/* 目录 */
.toc {
  background: var(--toc-bg);
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 28px;
  border-left: 4px solid var(--accent2);
}

.toc-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--accent2);
  margin-bottom: 8px;
}

.toc ul {
  list-style: none;
  padding: 0;
}

.toc li {
  font-size: 0.85rem;
  padding: 3px 0;
}

.toc a {
  color: var(--fg);
  text-decoration: none;
  border-bottom: 1px dotted var(--border);
}

.toc a:active { color: var(--accent); }

.toc .toc-h3 { padding-left: 16px; }
.toc .toc-h4 { padding-left: 32px; }

/* 标题 */
h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--accent);
  margin: 32px 0 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

h3 {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--fg);
  margin: 24px 0 8px;
  padding-left: 10px;
  border-left: 3px solid var(--accent2);
}

h4 {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--muted);
  margin: 16px 0 6px;
}

/* 段落 */
p {
  margin: 8px 0;
  text-align: justify;
}

/* 列表 */
ul, ol {
  padding-left: 24px;
  margin: 8px 0;
}

li {
  margin: 4px 0;
  font-size: 0.92rem;
}

/* 表格 */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 0.85rem;
  overflow-x: auto;
  display: block;
}

th {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  padding: 8px 10px;
  text-align: left;
  white-space: nowrap;
}

td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--border);
}

tr:nth-child(even) td { background: var(--card-bg); }

/* 强调标记高亮 */
.star { color: var(--accent2); font-weight: 700; }
.fire { color: var(--accent); font-weight: 700; }
.note-mark { color: var(--accent3); font-weight: 600; }

/* 代码 */
code {
  background: var(--card-bg);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.88em;
  font-family: "SF Mono", "Menlo", monospace;
}

pre {
  background: #2d2d2d;
  color: #f8f8f2;
  padding: 14px 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 12px 0;
  font-size: 0.82rem;
  line-height: 1.5;
}

pre code {
  background: none;
  padding: 0;
  color: inherit;
}

/* 引用 */
blockquote {
  border-left: 4px solid var(--accent2);
  padding: 8px 14px;
  margin: 12px 0;
  background: var(--toc-bg);
  border-radius: 0 6px 6px 0;
  font-size: 0.92rem;
  color: #444;
}

blockquote p { margin: 4px 0; }

/* 水平线 */
hr {
  border: none;
  height: 1px;
  background: var(--border);
  margin: 28px 0;
}

/* 返回顶部 */
.back-top {
  position: fixed;
  bottom: 24px;
  right: 20px;
  width: 40px;
  height: 40px;
  background: var(--accent);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  text-decoration: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  opacity: 0.85;
}

/* 首页模块卡片 */
.module-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 20px 0;
}

.module-card {
  background: var(--card-bg);
  border-radius: 8px;
  padding: 14px;
  text-decoration: none;
  color: var(--fg);
  display: block;
  border: 1px solid var(--border);
  transition: border-color 0.2s;
}

.module-card:active { border-color: var(--accent); }

.module-card .card-title {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--accent);
  margin-bottom: 4px;
}

.module-card .card-weight {
  font-size: 0.75rem;
  color: var(--muted);
}

@media (max-width: 400px) {
  .module-grid { grid-template-columns: 1fr; }
  html { font-size: 15px; }
}

/* 打印样式 */
@media print {
  .back-top { display: none; }
  .container { max-width: 100%; padding: 0; }
  body { font-size: 12pt; }
}
"""


def slugify(text: str) -> str:
    """生成可用于锚点的 slug"""
    text = re.sub(r'[^\w一-鿿-]', '', text.strip())
    return text or 'section'


def extract_toc(html_body: str) -> list[tuple[int, str, str]]:
    """从 HTML 中提取标题列表 (level, text, id)"""
    headings = []
    for m in re.finditer(r'<(h[2-4])[^>]*id="([^"]*)"[^>]*>(.*?)</\1>', html_body):
        level = int(m.group(1)[1])
        text = re.sub(r'<[^>]+>', '', m.group(3)).strip()
        heading_id = m.group(2)
        headings.append((level, text, heading_id))
    return headings


def add_heading_ids(html: str) -> str:
    """给 h2-h4 添加 id 用于锚点跳转"""
    used_ids = {}

    def replacer(m):
        tag = m.group(1)
        content = m.group(2)
        text = re.sub(r'<[^>]+>', '', content).strip()
        base = slugify(text)
        count = used_ids.get(base, 0)
        used_ids[base] = count + 1
        slug = base if count == 0 else f"{base}-{count}"
        return f'<{tag} id="{slug}">{content}</{tag}>'

    return re.sub(r'<(h[2-4])>(.*?)</\1>', replacer, html)


def highlight_marks(html: str) -> str:
    """给 ⭐🔥※ 添加样式 class"""
    html = re.sub(r'⭐', '<span class="star">⭐</span>', html)
    html = re.sub(r'🔥', '<span class="fire">🔥</span>', html)
    html = re.sub(r'※', '<span class="note-mark">※</span>', html)
    return html


def render_toc(headings: list[tuple[int, str, str]]) -> str:
    """渲染目录 HTML"""
    if not headings:
        return ''
    items = []
    for level, text, hid in headings:
        cls = f'toc-h{level}' if level > 2 else ''
        items.append(f'<li class="{cls}"><a href="#{hid}">{text}</a></li>')
    return (
        '<div class="toc"><div class="toc-title">📋 目录</div>'
        f'<ul>{"".join(items)}</ul></div>'
    )


def convert_file(md_path: str, output_dir: str, all_modules: list[dict] | None = None):
    """转换单个 md 文件为 HTML"""
    stem = Path(md_path).stem
    module_name = re.sub(r'^\d{2}-', '', stem)

    with open(md_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    # markdown → HTML
    extensions = ['tables', 'fenced_code', 'toc', 'nl2br']
    html_body = markdown.markdown(md_text, extensions=extensions)

    # 后处理
    html_body = add_heading_ids(html_body)
    html_body = highlight_marks(html_body)

    # 提取目录
    headings = extract_toc(html_body)
    toc_html = render_toc(headings)

    # 导航链接
    nav_links = '<a href="index.html" style="color:var(--accent);font-size:0.85rem;">← 返回总目录</a>'

    # 页面标题
    title = f'事业编备考 · {module_name}'

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>{title}</title>
<style>{CSS}</style>
</head>
<body>
<div class="container">
{nav_links}
<div class="header">
  <h1>{module_name}</h1>
  <div class="subtitle">2026 杭州事业编备考</div>
</div>
{toc_html}
{html_body}
<a href="#" class="back-top">↑</a>
</div>
</body>
</html>"""

    out_path = os.path.join(output_dir, f'{stem}.html')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'  ✓ {stem}.html')
    return module_name


def build_index(output_dir: str, modules: list[dict]):
    """生成首页 index.html"""
    weight_map = {
        '01': '~25%', '02': '含于政治', '03': '~20%', '04': '~12%',
        '05': '~10%', '06': '~6%', '07': '~9%', '08': '~9%',
        '09': '~4%', '10': '主观题'
    }

    cards = []
    for mod in modules:
        num = mod['num']
        cards.append(
            f'<a class="module-card" href="{mod["file"]}">'
            f'<div class="card-title">{num} {mod["name"]}</div>'
            f'<div class="card-weight">权重 {weight_map.get(num, "")}</div>'
            f'</a>'
        )

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>事业编备考知识库</title>
<style>{CSS}</style>
</head>
<body>
<div class="container">
<div class="header">
  <h1>事业编备考知识库</h1>
  <div class="subtitle">2026 浙江杭州事业单位考试</div>
</div>
<div class="module-grid">
{"".join(cards)}
</div>
<hr>
<p style="text-align:center;color:var(--muted);font-size:0.8rem;">
⭐ 必背 &nbsp;🔥 超级重点 &nbsp;※ 易出题点<br>
源文件：reference/ · 生成脚本：scripts/md2html.py
</p>
</div>
</body>
</html>"""

    with open(os.path.join(output_dir, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    print('  ✓ index.html')


def main():
    base = Path(__file__).resolve().parent.parent
    ref_dir = base / 'reference'
    output_dir = base / 'output' / 'html'

    output_dir.mkdir(parents=True, exist_ok=True)

    md_files = sorted(ref_dir.glob('*.md'))
    if not md_files:
        print('未找到 markdown 文件')
        sys.exit(1)

    print(f'转换 {len(md_files)} 个文件到 {output_dir}/\n')

    modules = []
    for md_path in md_files:
        stem = md_path.stem
        num = stem[:2]
        name = convert_file(str(md_path), str(output_dir))
        modules.append({'num': num, 'name': name, 'file': f'{stem}.html'})

    build_index(str(output_dir), modules)
    print(f'\n完成！打开 {output_dir}/index.html 查看')


if __name__ == '__main__':
    main()
