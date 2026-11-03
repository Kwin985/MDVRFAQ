'use strict';
// 用 acorn 词法器精确定位「字符串内容 / 模板文本」区间，只在其中做替换。
const acorn = require('../vendor/acorn.js');

function literalRanges(src) {
  const ranges = [];
  const tok = acorn.tokenizer(src, { ecmaVersion: 'latest', allowHashBang: true });
  let t;
  for (;;) {
    t = tok.getToken();
    if (!t || t.type.label === 'eof') break;
    if (t.type.label === 'string') ranges.push([t.start + 1, t.end - 1]);
    else if (t.type.label === 'template') ranges.push([t.start, t.end]);
  }
  return ranges;
}

/** 正则字面量区间（不参与翻译，但允许含中文字面量，例如 /^(CH|通道)?\d+$/ ） */
function regexpRanges(src) {
  const ranges = [];
  const tok = acorn.tokenizer(src, { ecmaVersion: 'latest', allowHashBang: true });
  let t;
  for (;;) {
    t = tok.getToken();
    if (!t || t.type.label === 'eof') break;
    if (t.type.label === 'regexp') ranges.push([t.start, t.end]);
  }
  return ranges;
}

function mapLiterals(src, fn) {
  const ranges = literalRanges(src);
  let out = '', last = 0;
  for (const [a, b] of ranges) {
    out += src.slice(last, a) + fn(src.slice(a, b));
    last = b;
  }
  return out + src.slice(last);
}

/** 统计落在字符串之外的中文字符数（0 表示可以安全做全局替换） */
function cjkOutsideLiterals(src) {
  const inside = new Uint8Array(src.length);
  for (const [a, b] of literalRanges(src).concat(regexpRanges(src))) {
    for (let i = a; i < b; i++) inside[i] = 1;
  }
  let total = 0, inLit = 0;
  for (let i = 0; i < src.length; i++) {
    if (!/[\u4e00-\u9fff]/.test(src[i])) continue;
    total++;
    if (inside[i]) inLit++;
  }
  return { total, inside: inLit, outside: total - inLit };
}

/** 结构等价校验：两侧 token 类型序列一致，且字符串以外的 token 原文一致 */
function sameStructure(a, b) {
  const ta = acorn.tokenizer(a, { ecmaVersion: 'latest', allowHashBang: true });
  const tb = acorn.tokenizer(b, { ecmaVersion: 'latest', allowHashBang: true });
  for (;;) {
    const x = ta.getToken(), y = tb.getToken();
    if (x.type.label !== y.type.label) return `token 类型不同：${x.type.label} != ${y.type.label} @${x.start}`;
    if (x.type.label === 'eof') return null;
    const isLiteral = ['string', 'template', 'regexp', 'num', 'name'].includes(x.type.label);
    if (!isLiteral) {
      const ra = a.slice(x.start, x.end), rb = b.slice(y.start, y.end);
      if (ra !== rb) return `代码片段不同：${JSON.stringify(ra)} != ${JSON.stringify(rb)}`;
    }
  }
}

module.exports = { literalRanges, mapLiterals, cjkOutsideLiterals, sameStructure };
