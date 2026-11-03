'use strict';
// 复刻 mdvr-config.min.js 内嵌数据表的解 / 加密（base64 -> RC4 流 XOR -> raw deflate -> JSON）
const zlib = require('zlib');

const KEY = [158, 55, 66, 193, 8, 109, 243, 90, 33, 188, 116, 224, 21, 168, 111, 210];

function keystream(len) {
  const k = [];
  for (let t = 0; t < 24; t++) {
    k.push(255 & ((KEY[t % KEY.length] ^ ((1370997737 >> (8 * (3 & t))) & 255)) ^ ((37 * t + 11) & 255)));
  }
  const g = new Array(256);
  for (let i = 0; i < 256; i++) g[i] = i;
  let b = 0;
  for (let d = 0; d < 256; d++) {
    b = (b + g[d] + k[d % k.length]) & 255;
    const m = g[d]; g[d] = g[b]; g[b] = m;
  }
  let d = 0; b = 0;
  const out = Buffer.alloc(len);
  for (let D = 0; D < len; D++) {
    d = (d + 1) & 255;
    b = (b + g[d]) & 255;
    const m = g[d]; g[d] = g[b]; g[b] = m;
    out[D] = g[(g[d] + g[b]) & 255];
  }
  return out;
}

function xor(buf) {
  const ks = keystream(buf.length);
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ ks[i];
  return out;
}

function decode(b64) {
  const raw = xor(Buffer.from(b64, 'base64'));
  return JSON.parse(zlib.inflateRawSync(raw).toString('utf8'));
}

function encode(json) {
  const raw = zlib.deflateRawSync(Buffer.from(JSON.stringify(json), 'utf8'), { level: 9 });
  return xor(raw).toString('base64');
}

module.exports = { decode, encode };
