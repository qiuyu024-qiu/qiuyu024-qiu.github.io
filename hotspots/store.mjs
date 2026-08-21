// hotspotsStore.js
// 框架无关的纯逻辑：合并 / 排序 / 游标分页 / 序列化。
// 同时被 React Native App、Node 服务端、Node 验证脚本复用，保证三端行为一致。
// 无任何第三方依赖，浏览器 / RN / Node 均可直接 import。

/**
 * 按生成时间倒序（最新置顶）。不修改入参。
 * @param {Array} list
 * @returns {Array}
 */
export function sortByTimeDesc(list) {
  return [...list].sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  );
}

/**
 * 合并服务端拉取的数据到本地，「保留历史、绝不删除」。
 * - 以 id 去重；同一 id 冲突时入站数据覆盖（代表服务端最新版）。
 * - 合并后整体按时间倒序，最新热点置顶。
 * - 历史热点即使不在本次请求范围内也完整保留（本地已有即保留）。
 * @param {Array} local   本地已持久化列表
 * @param {Array} incoming 本次从服务端拉取列表
 * @returns {Array} 合并后倒序全量
 */
export function mergeHotspots(local = [], incoming = []) {
  const map = new Map();
  for (const h of local) map.set(h.id, h);
  for (const h of incoming) {
    const prev = map.get(h.id);
    // 入站覆盖本地；历史项若本次未返回也保留在 map 中
    map.set(h.id, prev ? { ...prev, ...h } : h);
  }
  return sortByTimeDesc([...map.values()]);
}

/**
 * 游标分页：返回比 cursor 更旧的一页（用于无限向下滚动浏览历史）。
 * @param {Array} list
 * @param {{cursor?: string|null, limit?: number}} opts
 * @returns {{page: Array, nextCursor: string|null}}
 */
export function pageHotspots(list, { cursor = null, limit = 20 } = {}) {
  let arr = list;
  if (cursor) {
    const ct = new Date(cursor).getTime();
    arr = arr.filter((h) => new Date(h.generatedAt).getTime() < ct);
  }
  const sorted = sortByTimeDesc(arr);
  const page = sorted.slice(0, limit);
  const nextCursor =
    page.length === sorted.length ? null : page[page.length - 1]?.generatedAt ?? null;
  return { page, nextCursor };
}

/** 持久化：序列化为 JSON 文本。 */
export function serialize(list) {
  return JSON.stringify(list, null, 2);
}

/** 持久化：从文本安全反序列化（损坏/空返回 []，不丢历史）。 */
export function deserialize(text) {
  if (!text) return [];
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
