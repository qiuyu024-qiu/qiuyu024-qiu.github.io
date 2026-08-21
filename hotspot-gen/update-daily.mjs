// update-daily.mjs（部署版：位于 qiuyu024-qiu.github.io 仓库 hotspot-gen/ 目录）
// GitHub Actions 每日任务脚本：为「今天」（以及近7天内漏掉的日期）生成 09:00 热点批次，
// 追加到 hotspots/data/hotspots.json（历史绝不删除，只增不改）。
// 幂等：某天已生成过（按 id 前缀判断）则跳过，重复执行无副作用。
// 运行环境要求 TZ=Asia/Shanghai（workflow 已设置），确保"今天"按北京时间计算。

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateBatchForDate } from './generator.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '..', 'hotspots', 'data', 'hotspots.json');

function load() {
  if (!existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

const store = load();
let added = 0;

// 近 7 天逐日检查（含今天），漏掉的日期补生成 —— 应对 Actions 偶发停跑
const today = new Date();
for (let d = 7; d >= 0; d--) {
  const dt = new Date(today);
  dt.setDate(today.getDate() - d);
  const key = new Date(new Date(dt).setHours(9, 0, 0, 0)).toISOString().slice(0, 10);
  const has = store.some((h) => String(h.id || '').startsWith(`h-${key}`));
  if (!has) {
    const batch = generateBatchForDate(dt);
    store.push(...batch);
    added += batch.length;
    console.log(`[gen] ${key}: +${batch.length} 条`);
  }
}

if (added > 0) {
  writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  console.log(`完成：本次新增 ${added} 条，总计 ${store.length} 条`);
} else {
  console.log(`无需更新：数据已是最新，总计 ${store.length} 条`);
}
