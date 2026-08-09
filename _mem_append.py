p = '.workbuddy/memory/2026-08-09.md'
text = open(p, encoding='utf-8').read().rstrip() + '\n'
section = '''
## 十四、新增“配件选型”板块 P0（扫描+目录+方案种子+转换验证，2026-08-09 用户“开始”）
用户拍板：预置配置方案 + 规格书内嵌HTML + 全量一次做 + 转PDF改为仅HTML+原docx下载（环境无 LibreOffice/pandoc/Chrome，PDF 路线不可行）。
### 已完成（P0）
- 装 mammoth：受管 node workspace = C:\\Users\\34492\\.workbuddy\\binaries\\node\\workspace\\node_modules；NODE_PATH 必须用反斜杠才能被 node 解析（正斜杠报 MODULE_NOT_FOUND）。
- tools/scan_accessories.py：扫 X: 盘（Windows Python 必须用 X:/Citops 对外产品资料，不认 /x/）4 资料夹+主机夹；主机按型号下钻(depth2)，配件/摄像头 depth1。提取 127 物料（主机28/配件58/摄像头41），图片转 WebP(最长边≤1280/质量82/每物料≤12张)+规格书 docx 复制到 data/accessories/media/，输出 data/accessories/catalog.json。ID 规则：型号数字→cam-zh-110；单字母前缀→acc-zh-A01；主机型号→host-zh-m16hv。
- data/accessories/bundles.json：4 套种子方案（出租车4路/货车8路/公交6路/布控球应急），引用真实 item.id（host + parts[{id,qty,role}] + highlights），供用户审改。
- tools/convert_docx_test.js + mammoth 验证：摄像头规格书(1表+3图+61段)、配件规格书(1表+1图)转换保真；图片当前 base64 内联（页面偏大），P1 改为提取为独立文件；仅 1 条无害 w:tblPrEx 警告。
### 关键坑（重要）
- X: 盘在 Windows 原生 Python 下必须用 X:/...（正斜杠），/x/... 解析失败。
- 受管 node 自带 npm（.../22.22.2/npm.cmd）；批量删除被“安全删除”机制拦截（>50/轮 escalated bypass，rmtree 还抛 OSError），清理残留极难。→ 扫描器改为“复制前不清旧图”，由 build 仅引用 catalog 的 webp，不部署残留。
- 媒体本地缓存含历史未压缩残留(约1.2GB)与测试 .t.webp，均不在 catalog 引用，部署不被复制；建议把 data/accessories/media 当生成缓存、gitignore。
### 待办（P1，待用户验收转换样张/方案种子后）
- build.js 增加 accessories 渲染：目录页(配件/摄像头+中英文筛选)、详情页(画廊+内嵌规格书HTML[图片提取为文件]+docx下载+联系CTA+所属方案)、方案页、落地第5入口“配件选型/Accessory Selector”；先以样板3项验证版式与保真度，用户验收后再全量(P2)。
'''
open(p, 'w', encoding='utf-8').write(text + section)
print('appended, total chars:', len(text + section))
