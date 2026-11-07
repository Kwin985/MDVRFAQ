#!/usr/bin/env python3
"""把 docs/MDVR FAQ 产品知识库.md 转成可分享的 .docx。

参照 /d/Web/WebP/scripts/md-to-docx.mjs 的思路（python-docx + 微软雅黑），
增强支持：Markdown 表格、引用块、内联 **加粗**、中英混排标题。
"""
import os
import re
from docx import Document
from docx.shared import Pt, RGBColor
from docx.oxml.ns import qn

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs", "MDVR FAQ 产品知识库.md")
OUT = os.path.join(ROOT, "docs", "MDVR FAQ 产品知识库.docx")

FONT = "Microsoft YaHei"


def set_east_asia(style):
    """给 style 设置中文字体，避免中文回退成宋体/黑体不一致。"""
    style.font.name = FONT
    rpr = style.element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = rpr.makeelement(qn("w:rFonts"), {})
        rpr.append(rfonts)
    rfonts.set(qn("w:eastAsia"), FONT)
    rfonts.set(qn("w:ascii"), FONT)
    rfonts.set(qn("w:hAnsi"), FONT)


def add_runs(paragraph, text):
    """处理内联 **加粗**（保留其余原样文本）。"""
    for i, part in enumerate(text.split("**")):
        if not part:
            continue
        run = paragraph.add_run(part)
        if i % 2 == 1:
            run.bold = True


def main():
    with open(SRC, "r", encoding="utf-8") as f:
        lines = f.read().splitlines()

    doc = Document()
    normal = doc.styles["Normal"]
    set_east_asia(normal)
    normal.font.size = Pt(10.5)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.25

    for name in ("Title", "Heading 1", "Heading 2", "Heading 3", "List Bullet", "Quote"):
        try:
            set_east_asia(doc.styles[name])
        except KeyError:
            pass
    doc.styles["Heading 1"].font.size = Pt(16)
    doc.styles["Heading 2"].font.size = Pt(13)
    doc.styles["Title"].font.size = Pt(24)

    i = 0
    table_count = 0
    while i < len(lines):
        line = lines[i].rstrip()
        stripped = line.strip()

        # ---- Markdown 表格 ----
        if stripped.startswith("|") and stripped.endswith("|"):
            block = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                block.append(lines[i].strip())
                i += 1
            rows = []
            for row in block:
                cells = [c.strip() for c in row.strip("|").split("|")]
                # 跳过 |---|---| 分隔行
                if all(re.fullmatch(r":?-{2,}:?", c or "") for c in cells):
                    continue
                rows.append(cells)
            if rows:
                cols = max(len(r) for r in rows)
                t = doc.add_table(rows=len(rows), cols=cols)
                t.style = "Table Grid"
                for ri, row in enumerate(rows):
                    for ci in range(cols):
                        cell = t.cell(ri, ci)
                        cell.text = ""
                        p = cell.paragraphs[0]
                        p.paragraph_format.space_after = Pt(2)
                        add_runs(p, row[ci] if ci < len(row) else "")
                        if ri == 0:
                            for r in p.runs:
                                r.bold = True
                table_count += 1
                doc.add_paragraph()
            continue

        if not stripped:
            i += 1
            continue

        if stripped.startswith("# "):
            p = doc.add_heading(level=0)
            add_runs(p, stripped[2:])
        elif stripped.startswith("## "):
            p = doc.add_heading(level=1)
            add_runs(p, stripped[3:])
        elif stripped.startswith("### "):
            p = doc.add_heading(level=2)
            add_runs(p, stripped[4:])
        elif stripped.startswith("> "):
            p = doc.add_paragraph()
            add_runs(p, stripped[2:])
            for r in p.runs:
                r.italic = True
                r.font.color.rgb = RGBColor(0x44, 0x55, 0x66)
        elif stripped.startswith("- "):
            p = doc.add_paragraph(style="List Bullet")
            add_runs(p, stripped[2:])
        else:
            p = doc.add_paragraph()
            add_runs(p, stripped)
        i += 1

    doc.save(OUT)
    print(f"SAVED {OUT}")
    print(f"paragraphs={len(doc.paragraphs)} tables={table_count} size={os.path.getsize(OUT)} bytes")


if __name__ == "__main__":
    main()
