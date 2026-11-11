#!/usr/bin/env node
/**
 * 把 MdvrFAQ 导出的 schema.json 编译成 HarmonyOS APP 的 ArkTS 常量文件。
 *
 * 为什么不做运行时读 rawfile：ArkTS 里 TextDecoder / JSON.parse as class 的兼容性与
 * 异常路径难验证；编译期常量类型安全、无 IO、启动即就绪。
 *
 * 用法: node tools/build_app_schema.js [--out <SchemaData.ets 路径>]
 * 上游升级流程: export_config_schema.js -> export_page_controls.js -> (--en) -> 本脚本
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const SRC = path.join(ROOT, 'dist/tools/config-gen/schema.json');
const DEFAULT_OUT = 'D:/HarmonyApp/MDVRConfigGen/entry/src/main/ets/common/SchemaData.ets';

function main() {
  const idx = process.argv.indexOf('--out');
  const out = idx >= 0 ? process.argv[idx + 1] : DEFAULT_OUT;
  const schema = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const controls = schema.pageFields.reduce((n, p) => n + p.controls.length, 0);
  const enLabels = schema.pageFields.reduce(
    (n, p) => n + p.controls.filter(c => c.labelEn).length, 0);

  const body = [
    '/**',
    ' * 自动生成，请勿手工编辑。',
    ' * 来源: MdvrFAQ `node tools/build_app_schema.js`',
    ` * 上游: ${schema.source} | 导出时间: ${schema.generatedAt}`,
    ` * 内容: ${schema.modules.length} 模块 / ${schema.pageFields.length} 子页 / ${controls} 控件 / ${enLabels} 英文标签`,
    ' */',
    "import { SchemaDef } from './ConfigEngine';",
    '',
    `export const SCHEMA: SchemaDef = ${JSON.stringify(schema, null, 2)};`,
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, body, 'utf8');
  console.log('已生成:', out);
  console.log(`  ${schema.modules.length} 模块 / ${schema.pageFields.length} 子页 / ${controls} 控件 / ${enLabels} 英文标签`);
  console.log(`  ${(Buffer.byteLength(body) / 1024).toFixed(1)} KB`);
}

main();
