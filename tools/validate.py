import os, re

pages = []
for root, _, files in os.walk('dist'):
    for f in files:
        if f != 'index.html':
            continue
        full = os.path.join(root, f)
        rel = os.path.relpath(full, 'dist').replace('\\', '/')
        if re.match(r'^(zh|en)/(docs|videos)/\d+/index\.html$', rel):
            pages.append(full)

print('真实页面总数:', len(pages))
no_content, bad_img, jsonld_missing, faq, hreflang_missing = [], 0, 0, 0, 0
img_samples = set()
for p in pages:
    h = open(p, encoding='utf-8', errors='ignore').read()
    if 'application/ld+json' not in h:
        jsonld_missing += 1
    if '<div class="article-content"></div>' in h or 'article-content' not in h:
        no_content.append(p)
    if re.search(r'(src|href)="assets/', h):
        bad_img += 1
    if 'FAQPage' in h:
        faq += 1
    if 'rel="alternate" hreflang' not in h:
        hreflang_missing += 1
    for m in re.findall(r'<img[^>]+src="([^"]+)"', h)[:1]:
        img_samples.add(m)

print('JSON-LD 缺失:', jsonld_missing)
print('无正文页面:', len(no_content))
print('相对 assets 路径页面:', bad_img)
print('FAQPage 结构化数据页面:', faq)
print('hreflang 缺失:', hreflang_missing)
print('图片路径样例:', list(img_samples)[:3])

h = open(pages[0], encoding='utf-8', errors='ignore').read()
m = re.search(r'<div class="article-content">(.*?)</div>\s*</article>', h, re.S)
print('首页面正文片段:', (m.group(1)[:120].replace('\n', ' ')) if m else 'N/A')
