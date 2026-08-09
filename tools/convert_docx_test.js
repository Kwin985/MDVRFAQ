const mammoth = require("mammoth");
const fs = require("fs");
const p = process.argv[2];
if (!p) { console.error("usage: node convert_docx_test.js <docx>"); process.exit(1); }
mammoth.convertToHtml({ path: p }).then(r => {
  const h = r.value;
  const tables = (h.match(/<table/g) || []).length;
  const imgs = (h.match(/<img/g) || []).length;
  const heads = (h.match(/<h[1-6]/g) || []).length;
  const paras = (h.match(/<p/g) || []).length;
  console.log("FILE:", p);
  console.log("html bytes:", Buffer.byteLength(h));
  console.log("tables:", tables, "| images:", imgs, "| headings:", heads, "| paragraphs:", paras);
  console.log("mammoth warnings:", r.messages.length, r.messages.slice(0, 3).map(m => m.message));
  console.log("--- snippet (first 500 chars, whitespace-collapsed) ---");
  console.log(h.slice(0, 500).replace(/\s+/g, " "));
  fs.writeFileSync(p + ".proof.html", h);
  console.log("written:", p + ".proof.html");
}).catch(e => { console.error("ERR", e); process.exit(1); });
