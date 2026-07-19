#!/usr/bin/env node
/*
 * One-off asset-authoring script (NOT part of the page's runtime).
 *
 * FULLY RETIRED / UNUSED: the page no longer loads ANY .glb asset. Every
 * character — the soldiers AND the big whale units (tank/apc/helicopter/
 * jet/bomber) — is now built high-poly & procedurally at runtime from
 * Three.js curved primitives inside index.html (see buildSoldierGeo and
 * BIG_BUILDERS). This script and the leftover ../models/*.glb files are kept
 * only for historical reference and are not referenced by the page.
 *
 * Historically it generated the voxel SOLDIER model as a spec-compliant
 * binary glTF (.glb) into ../models/.
 *
 * Run manually with: node tools/build-voxel-models.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'models');
fs.mkdirSync(OUT_DIR, { recursive: true });

const C_LONG = 0x2dd6a5, C_SHORT = 0xff6584;
const DARK = 0x262b36, METAL = 0x3a3f4a, GLASS = 0x2a3a4a, SKIN = 0xc79a72, STRAP = 0x1c1f26;

function hx(c) { return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]; }

/* satu balok voxel: pusat (cx,cy,cz), ukuran (sx,sy,sz), warna solid */
function box(cx, cy, cz, sx, sy, sz, color) {
  const hxs = sx / 2, hys = sy / 2, hzs = sz / 2;
  const c = [
    [cx - hxs, cy - hys, cz - hzs], [cx + hxs, cy - hys, cz - hzs], [cx + hxs, cy + hys, cz - hzs], [cx - hxs, cy + hys, cz - hzs],
    [cx - hxs, cy - hys, cz + hzs], [cx + hxs, cy - hys, cz + hzs], [cx + hxs, cy + hys, cz + hzs], [cx - hxs, cy + hys, cz + hzs],
  ];
  const faces = [
    [[0, 1, 2, 3], [0, 0, -1]], [[5, 4, 7, 6], [0, 0, 1]],
    [[4, 0, 3, 7], [-1, 0, 0]], [[1, 5, 6, 2], [1, 0, 0]],
    [[3, 2, 6, 7], [0, 1, 0]], [[4, 5, 1, 0], [0, -1, 0]],
  ];
  const col = hx(color);
  const pos = [], nor = [], vcol = [];
  for (const [idx, n] of faces) {
    const q = idx.map(i => c[i]);
    for (const tri of [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]) {
      for (const v of tri) { pos.push(v[0], v[1], v[2]); nor.push(n[0], n[1], n[2]); vcol.push(col[0], col[1], col[2]); }
    }
  }
  return { pos, nor, vcol };
}
function merge(parts) {
  const pos = [], nor = [], vcol = [];
  for (const p of parts) { pos.push(...p.pos); nor.push(...p.nor); vcol.push(...p.vcol); }
  return { pos, nor, vcol };
}

/* ═══════════ penulis GLB minimal — tanpa dependensi npm ═══════════ */
function packModel(defs) {
  // defs: [{ name, parts /* merged {pos,nor,vcol} atau null */, translation /* [x,y,z] atau null */ }]
  const bufParts = [];
  const meshes = [];
  const nodes = [{ name: 'root', children: defs.map((_, i) => i + 1) }];
  let byteOffset = 0;
  const bufferViews = [], accessors = [];

  function pushAttr(arr, itemSize, isPosition) {
    const f32 = new Float32Array(arr);
    const bytes = Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
    const bvIndex = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length, target: 34962 });
    byteOffset += bytes.length;
    bufParts.push(bytes);
    const count = f32.length / itemSize;
    const acc = { bufferView: bvIndex, componentType: 5126, count, type: itemSize === 3 ? 'VEC3' : 'VEC4' };
    if (isPosition) {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) {
        const v = f32[i * 3 + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v;
      }
      acc.min = min; acc.max = max;
    }
    accessors.push(acc);
    return accessors.length - 1;
  }

  defs.forEach((d, i) => {
    const node = { name: d.name };
    if (d.translation) node.translation = d.translation;
    if (d.parts) {
      const posIdx = pushAttr(d.parts.pos, 3, true);
      const norIdx = pushAttr(d.parts.nor, 3, false);
      const colIdx = pushAttr(d.parts.vcol, 3, false);
      meshes.push({ primitives: [{ attributes: { POSITION: posIdx, NORMAL: norIdx, COLOR_0: colIdx }, mode: 4, material: 0 }] });
      node.mesh = meshes.length - 1;
    }
    nodes.push(node);
  });

  const bin = Buffer.concat(bufParts);
  const doc = {
    asset: { version: '2.0', generator: 'crypto-battlefield build-voxel-models.mjs' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    meshes,
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.length }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0.05, roughnessFactor: 0.85 } }],
  };
  return glb(doc, bin);
}

function glb(doc, bin) {
  const json = Buffer.from(JSON.stringify(doc), 'utf8');
  const jsonPad = (4 - (json.length % 4)) % 4;
  const jsonChunk = Buffer.concat([json, Buffer.alloc(jsonPad, 0x20)]);
  const binPad = (4 - (bin.length % 4)) % 4;
  const binChunk = Buffer.concat([bin, Buffer.alloc(binPad, 0)]);
  const totalLength = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);   // magic 'glTF'
  header.writeUInt32LE(2, 4);            // version
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4); // 'BIN\0'
  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
}

/* ═══════════ definisi unit — voxel blok, tiap sisi (buy/sell) diwarnai terpisah ═══════════ */
function soldierModel(team) {
  const parts = [
    box(0, .9, -.6, .7, 1.8, .7, DARK),            // sepatu/kaki kiri
    box(0, .9, .6, .7, 1.8, .7, DARK),             // sepatu/kaki kanan
    box(0, 2.5, -.6, .7, 1.4, .7, METAL),          // celana kiri
    box(0, 2.5, .6, .7, 1.4, .7, METAL),           // celana kanan
    box(0, 4.6, 0, 1.5, 3.0, 2.1, team),           // rompi (warna tim)
    box(0, 3.3, 0, 1.6, .5, 2.2, STRAP),           // sabuk
    box(0, 6.7, 0, .7, 1.3, .7, SKIN),             // leher
    box(.05, 7.5, 0, 1.3, 1.3, 1.3, SKIN),         // kepala
    box(0, 8.15, 0, 1.85, .4, 2.05, team),         // kubah helm (warna tim)
    box(.95, 8.0, 0, .8, .28, 2.0, DARK),          // pinggir helm depan
    box(.9, 4.9, -.85, 1.9, .55, .6, SKIN),        // lengan belakang
    box(.9, 4.9, .85, 1.9, .55, .6, SKIN),         // lengan depan
    box(2.2, 4.7, .55, 3.7, .35, .35, DARK),       // laras senapan
    box(.9, 4.3, .55, .9, .8, .4, METAL),          // magasin
  ];
  return packModel([{ name: 'body', parts: merge(parts), translation: [0, 0, 0] }]);
}

/* Hanya prajurit yang masih diautor sebagai voxel .glb. Unit whale besar
   (tank/apc/helicopter/jet/bomber) kini dibangun high-poly prosedural di
   runtime di dalam index.html (BIG_BUILDERS), jadi builder voxel-nya dipensiunkan. */
const UNITS = {
  soldier: soldierModel,
};

for (const [key, builder] of Object.entries(UNITS)) {
  for (const [side, color] of [['buy', C_LONG], ['sell', C_SHORT]]) {
    const glbBuf = builder(color);
    const outPath = path.join(OUT_DIR, `${key}_${side}.glb`);
    fs.writeFileSync(outPath, glbBuf);
    console.log('wrote', outPath, glbBuf.length, 'bytes');
  }
}
