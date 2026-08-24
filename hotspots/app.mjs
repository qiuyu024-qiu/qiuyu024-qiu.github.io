// app.mjs
// 免服务器版页面逻辑（GitHub Pages 静态托管）。
// 与本地版差异：数据源不是 Node API，而是仓库里的静态 JSON（docs/data/hotspots.json），
// 由 GitHub Actions 每日 09:00（北京时间）自动追加。
// 分页/合并/排序复用与 App、服务端同一套纯逻辑（store.mjs）。
// 另用 localStorage 做浏览器端持久化：断网或数据文件暂时拉不到时，仍能看已缓存的历史。

import { pageHotspots, mergeHotspots, sortByTimeDesc } from './store.mjs';

const DATA_URL = `data/hotspots.json?t=${Date.now()}`; // 时间戳防缓存
const CACHE_KEY = 'tanlouji-hotspots-v1';

const listEl = document.getElementById('list');
const moreBtn = document.getElementById('more');
const btn = document.getElementById('btn');
let cursor = null;
let busy = false;
let all = loadCache(); // 全量倒序列表（最新置顶）

function loadCache() {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    return Array.isArray(v) ? sortByTimeDesc(v) : [];
  } catch {
    return [];
  }
}
function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* 存储满等异常不致命，忽略 */
  }
}

function fmt(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function card(h) {
  return `<div class="card" data-id="${esc(h.id)}">
    <div class="meta"><span>${esc(fmt(h.generatedAt))}</span><span class="cat">${esc(h.category)}</span></div>
    <div class="title">${esc(h.title)}</div>
    <div class="summary">${esc(h.summary)}</div>
    <div class="tags">${(h.tags || []).map((t) => `<span>#${esc(t)}</span>`).join('')}</div>
    <div class="go">二创文案 →</div>
  </div>`;
}

function renderPage(reset) {
  const { page, nextCursor } = pageHotspots(all, { cursor: reset ? null : cursor, limit: 20 });
  cursor = nextCursor;
  const html = page.map(card).join('');
  if (reset) {
    listEl.innerHTML = html || '<div class="empty">暂无热点</div>';
  } else if (html) {
    listEl.insertAdjacentHTML('beforeend', html);
  }
  if (!cursor) {
    moreBtn.style.display = 'none';
    if (reset && page.length) listEl.insertAdjacentHTML('beforeend', '<div class="end">— 已到底，全部历史都在这里 —</div>');
  } else {
    moreBtn.style.display = '';
  }
}

async function load(reset) {
  if (busy) return;
  busy = true;
  btn.disabled = true;
  moreBtn.disabled = true;
  try {
    const res = await fetch(DATA_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const incoming = await res.json();
    // 合并保留浏览器已缓存历史（历史绝不删除），入站覆盖同 id 项
    all = mergeHotspots(loadCache(), Array.isArray(incoming) ? incoming : []);
    saveCache();
    renderPage(true);
  } catch (e) {
    // 拉取失败：若有本地缓存则离线展示，否则提示
    if (all.length) {
      renderPage(true);
    } else {
      listEl.innerHTML = `<div class="err">⚠ 加载失败：${esc(e.message)}</div>`;
      moreBtn.style.display = 'none';
    }
  } finally {
    busy = false;
    btn.disabled = false;
    moreBtn.disabled = false;
  }
}

btn.addEventListener('click', () => load(true));
moreBtn.addEventListener('click', () => renderPage(false));

// 点击热点卡片 → 进入二创文案详情页
listEl.addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (card && card.dataset.id) {
    location.href = `./detail.html?id=${encodeURIComponent(card.dataset.id)}`;
  }
});

// 触底自动加载更早历史（IntersectionObserver 监听哨兵元素）
const io = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && cursor && !busy) renderPage(false);
}, { rootMargin: '400px' });
io.observe(document.getElementById('sentinel'));

// 首屏：先用缓存秒开，再拉最新覆盖
if (all.length) renderPage(true);
load(true);
