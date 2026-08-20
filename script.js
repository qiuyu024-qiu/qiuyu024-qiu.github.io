/* =====================================================
   选题灵感工作台 · 交互
   ===================================================== */

(function () {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  const STORAGE_KEY = "gbad_inspiration_archive_v1";

  /* ---------- 日期 ---------- */
  function fmtDateCN(d = new Date()) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const wk = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    return `${y}年 ${m}月 ${day}日 星期${wk}`;
  }
  $("#dateText").textContent = fmtDateCN();

  /* ---------- 防重复保存标记（已保存标识） ---------- */
  let savedAt = new Date();
  function refreshSavedStatus() {
    const now = new Date();
    const diffSec = Math.floor((now - savedAt) / 1000);
    const el = $(".save-status");
    if (!el) return;
    if (diffSec < 5) {
      el.innerHTML = '<span class="dot"></span>已保存';
    } else {
      el.innerHTML = `<span class="dot"></span>已保存 · ${diffSec}s 前`;
    }
  }
  setInterval(refreshSavedStatus, 1000);
  refreshSavedStatus();

  /* ---------- 卡片渲染 ---------- */
  const wrap = $("#cardsWrap");

  function escapeHtml(s = "") {
    return String(s).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[m]);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      ta.remove(); return true;
    }
  }
  function flashBtn(btn, msg) {
    if (!btn) return;
    const old = btn.textContent;
    btn.textContent = msg;
    setTimeout(() => { btn.textContent = old; }, 1200);
  }

  function cardHTML(item, idx) {
    const tagBadge = item.type === "deep" ? "深度资讯" : "日常流量";
    const tagsHTML = (item.tags || [])
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join("");

    return `
      <article class="card" data-idx="${idx}">
        <span class="card-tag">⭐ 今日精选</span>

        <div class="card-title-row">
          <span class="spark">📌</span>
          <h2 class="card-title">${escapeHtml(item.title)}</h2>
        </div>

        <div class="fields">
          <div class="field">
            <div class="field-key"><span class="em">🔍</span>问题</div>
            <div class="field-val">${escapeHtml(item.problem)}</div>
          </div>
          <div class="field">
            <div class="field-key"><span class="em">❤️</span>痛苦</div>
            <div class="field-val">${escapeHtml(item.pain)}</div>
          </div>
          <div class="field">
            <div class="field-key"><span class="em">🌱</span>希望</div>
            <div class="field-val">${escapeHtml(item.hope)}</div>
          </div>
          <div class="field">
            <div class="field-key"><span class="em">🔗</span>钩子</div>
            <div class="field-val">${escapeHtml(item.hook)}</div>
          </div>
        </div>

        <div class="script-block">
          <div class="script-title">短视频口播文案</div>
${escapeHtml(item.script)}
        </div>

        <div class="tags">${tagsHTML}</div>

        <div class="card-foot">
          <span class="foot-meta">${tagBadge} · 建议时长 ${item.type === "deep" ? "60-90s" : "40-60s"}</span>
          <div class="card-actions">
            <button class="btn-mini" data-action="copy" data-script-index="${idx}">复制文案</button>
            <button class="btn-mini" data-action="archive" data-archive-index="${idx}">入素材库</button>
          </div>
        </div>
      </article>
    `;
  }

  /* 抽签函数：不重复抽 N 条 */
  function pickRandom(pool, n) {
    const copy = pool.slice();
    const out = [];
    while (out.length < n && copy.length) {
      const i = Math.floor(Math.random() * copy.length);
      out.push({ ...copy.splice(i, 1)[0], _pickIndex: out.length });
    }
    return out;
  }

  /* 每日「冷启动」用稳定 hash 抽（既随机又保证每次打开内容不会跳到爆炸） */
  function dailyStablePick(pool, n) {
    const seedKey = new Date().toISOString().slice(0, 10);
    let seed = 0;
    for (let i = 0; i < seedKey.length; i++) {
      seed = (seed * 31 + seedKey.charCodeAt(i)) >>> 0;
    }
    const copy = pool.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const j = seed % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n).map((it, k) => ({ ...it, _pickIndex: k }));
  }

  /* 渲染一批 */
  let currentList = [];
  /* 用户加入的卡片（持久化，换一批不丢） */
  const INSP_ADDED_KEY = "gbad_inspiration_added_v1";
  function loadAdded() {
    try { const a = JSON.parse(localStorage.getItem(INSP_ADDED_KEY) || "[]"); return Array.isArray(a) ? a : []; }
    catch (_) { return []; }
  }
  function saveAdded(arr) { localStorage.setItem(INSP_ADDED_KEY, JSON.stringify(arr.slice(0, 50))); }
  function addInspirationCard(card) {
    const list = loadAdded();
    list.unshift({ ...card, _added: true });
    saveAdded(list);
    currentList.unshift({ ...card, _added: true });
    render(currentList);
    const w = $("#cardsWrap");
    if (w) w.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  window._inspirationStore = { add: addInspirationCard };

  function render(list) {
    currentList = list;
    wrap.innerHTML = list.map((it, idx) => cardHTML(it, idx)).join("");
    savedAt = new Date();
    refreshSavedStatus();
  }

  /* 首次进入：稳定每日 5 条（日常+深度混合） + 用户加卡置顶 */
  function firstBatch() {
    const all = window.SEED_TOPICS || [];
    const daily = all.filter((x) => x.type === "daily");
    const deep = all.filter((x) => x.type === "deep");
    const picked = [];
    const pickFrom = (arr, n) => {
      const tmp = arr.slice();
      const out = [];
      while (out.length < n && tmp.length) {
        const i = Math.floor(Math.random() * tmp.length);
        out.push(tmp.splice(i, 1)[0]);
      }
      return out;
    };
    picked.push(...pickFrom(daily, 3));
    picked.push(...pickFrom(deep, 2));
    const added = loadAdded();
    render(added.concat(picked));
  }

  /* 换一批：用户加卡保留 + 随机抽 4-5 条 seed */
  function refreshBatch() {
    const all = window.SEED_TOPICS || [];
    const n = 4 + Math.floor(Math.random() * 2);
    const picked = pickRandom(all, n);
    const added = loadAdded();
    render(added.concat(picked));
  }

  /* 绑定换一批 */
  const btn = $("#btnRefresh");
  btn.addEventListener("click", () => {
    btn.classList.add("spin");
    setTimeout(() => btn.classList.remove("spin"), 700);
    refreshBatch();
  });

  /* 实时热搜按钮：把当日热搜词转成结构化选题卡 */
  $("#btnTrending").addEventListener("click", () => {
    const trending = window.REALTIME_TRENDING || [];
    if (!trending.length) return;
    const sample = pickRandom(trending, Math.min(4, trending.length));
    sample.forEach((t) => {
      addInspirationCard({
        type: "deep",
        title: t.adapted,
        problem: t.keyword,
        pain: "打工人看新闻只会焦虑，看不到背后机会窗口。",
        hope: "把「" + t.keyword + "」翻译成普通人能用的选址/租办公室判断。",
        hook: "你知道吗？" + t.keyword + "这件事，可能直接关系到你明年房租。",
        script: "兄弟们，今天探楼纪扒一个刚冒头的热搜：" + t.keyword + "。\n\n" +
          t.angle + "。\n\n我给你拆三句人话：第一，这事跟谁有关；第二，对你租办公室有什么影响；第三，现在该不该动。\n\n" +
          "评论区扣你的城市，下条专门拆你那片的真实情况。",
        tags: ["#" + t.source, "#深圳写字楼", "#深港楼市", "#探楼纪"]
      });
    });
    btnRefreshFlash("#btnTrending", `已加入 ${sample.length} 张热搜选题 ✓`);
  });

  function btnRefreshFlash(sel, msg) {
    const b = $(sel); if (!b) return;
    const old = b.innerHTML; b.textContent = msg;
    setTimeout(() => { b.innerHTML = old; }, 1600);
  }

  /* 手动添加选题 */
  $("#btnAddInspiration").addEventListener("click", () => {
    const p = $("#inspirationPanel");
    p.style.display = p.style.display === "none" ? "block" : "none";
    if (p.style.display === "block") $("#inspTitle").focus();
  });
  $("#btnCancelInspiration").addEventListener("click", () => {
    $("#inspirationPanel").style.display = "none";
    ["#inspTitle","#inspProblem","#inspPain","#inspHope","#inspHook","#inspScript","#inspTags"]
      .forEach((s) => { const el = $(s); if (el) el.value = ""; });
  });
  $("#btnSaveInspiration").addEventListener("click", () => {
    const title = $("#inspTitle").value.trim();
    if (!title) { alert("请填写选题标题"); return; }
    const problem = $("#inspProblem").value.trim() || title;
    const pain = $("#inspPain").value.trim() || "打工人日常被这事困扰。";
    const hope = $("#inspHope").value.trim() || "给你一个能用的判断/动作建议。";
    const hook = $("#inspHook").value.trim() || "为什么这件事突然在深圳商办圈刷屏？";
    let script = $("#inspScript").value.trim();
    if (!script) {
      script =
        "兄弟们，今天探楼纪聊一条：" + title + "。\n\n" +
        problem + "。\n\n" +
        pain + "，所以我给你三个判断：" + hope + "。\n\n" +
        "评论区扣你的片区，下条专门拆你那片的真实情况。";
    }
    const tagsRaw = $("#inspTags").value.trim();
    const tags = tagsRaw ? tagsRaw.split(/\s+/).filter(Boolean) : ["#深圳写字楼", "#探楼纪"];
    addInspirationCard({ type: "daily", title, problem, pain, hope, hook, script, tags });
    $("#inspirationPanel").style.display = "none";
    ["#inspTitle","#inspProblem","#inspPain","#inspHope","#inspHook","#inspScript","#inspTags"]
      .forEach((s) => { const el = $(s); if (el) el.value = ""; });
  });

  /* 卡片按钮：复制文案 / 入素材库 */
  wrap.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const idx = Number(t.dataset.scriptIndex ?? t.dataset.archiveIndex);
    const item = currentList[idx];
    if (!item) return;

    if (t.dataset.action === "copy") {
      const text =
        `【${item.title}】\n\n` +
        `🔍 问题：${item.problem}\n` +
        `❤️ 痛苦：${item.pain}\n` +
        `🌱 希望：${item.hope}\n` +
        `🔗 钩子：${item.hook}\n\n` +
        `—— 短视频口播文案 ——\n${item.script}\n\n` +
        `${(item.tags || []).join(" ")}`;
      try {
        await navigator.clipboard.writeText(text);
        t.textContent = "已复制 ✓";
        setTimeout(() => (t.textContent = "复制文案"), 1500);
      } catch (_) {
        // 降级方案
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        t.textContent = "已复制 ✓";
        setTimeout(() => (t.textContent = "复制文案"), 1500);
      }
    }

    if (t.dataset.action === "archive") {
      try {
        const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        arr.unshift({ ...item, archivedAt: new Date().toISOString() });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, 200)));
        t.textContent = "已入素材库 ✓";
        setTimeout(() => (t.textContent = "入素材库"), 1500);
      } catch (_) {
        t.textContent = "存储失败";
        setTimeout(() => (t.textContent = "入素材库"), 1500);
      }
    }
  });

  /* 菜单切换：页面切换 + 视觉选中态 */
  const PAGE_MAP = {
    home: "page-home", news: "page-news", note: "page-note", media: "page-media",
    publish: "page-publish", review: "page-review", inspiration: "page-inspiration",
    hot: "page-hot", compare: "page-compare", project: "page-project",
    personal: "page-personal", stats: "page-stats", care: "page-care",
    lib: "page-lib", maintain: "page-maintain"
  };
  const TITLE_MAP = {
    home: "首页概览", news: "行业资讯", note: "选题笔记", media: "自媒体管理",
    publish: "内容发布", review: "内容复盘", inspiration: "选题灵感", hot: "爆款热点",
    compare: "内容对照", project: "项目管理", personal: "个人分析", stats: "数据统计",
    care: "自我关怀", lib: "作业素材库", maintain: "数据维护"
  };

  function switchPage(key) {
    $$(".page").forEach((p) => p.classList.remove("page-active"));
    const pid = PAGE_MAP[key] || "page-home";
    const el = document.getElementById(pid);
    if (el) el.classList.add("page-active");
    if (key === "review") renderWorkTable();
    if (key === "personal") renderAnalysis();
    if (key === "compare") renderCompareCards();
    if (key === "home") renderHome();
    if (key === "news") renderNews();
    if (key === "note") renderNotes();
    if (key === "media") renderMedia();
    if (key === "publish") renderPublish();
    if (key === "hot") renderHot();
    if (key === "project") renderProjects();
    if (key === "stats") renderStats();
    if (key === "care") renderCare();
    if (key === "lib") renderLib();
    if (key === "maintain") renderMaintain();
  }

  $$(".menu-item").forEach((it) => {
    it.addEventListener("click", (e) => {
      e.preventDefault();
      $$(".menu-item").forEach((m) => m.classList.remove("active"));
      it.classList.add("active");
      switchPage(it.dataset.key);
    });
  });

  /* ============ 内容复盘：作品管理 ============ */
  const WORKS_KEY = "gbad_works_v1";

  function loadWorks() {
    try { return JSON.parse(localStorage.getItem(WORKS_KEY) || "[]"); }
    catch { return []; }
  }
  function saveWorks(arr) {
    localStorage.setItem(WORKS_KEY, JSON.stringify(arr));
  }

  /* 抖音分享文案解析 */
  function parsePaste(text) {
    if (!text) return {};
    const result = {};
    // 提取链接
    const linkMatch = text.match(/https?:\/\/[^\s）]+/i);
    if (linkMatch) result.link = linkMatch[0].trim();
    // 提取标题：去掉链接、去掉常见话术
    let title = text
      .replace(/https?:\/\/[^\s）]+/gi, "")
      .replace(/长按复制此条消息.*?查看TA的更多作品[。.]?/g, "")
      .replace(/长按复制.*?打开抖音搜索[，,。.]?/g, "")
      .replace(/^[\s，,。.]+|[\s，,。.]+$/g, "")
      .trim();
    if (title) result.title = title;
    return result;
  }

  function fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 10000) return (n / 10000).toFixed(1) + "w";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  }

  function interactRate(w) {
    const v = Number(w.views) || 0;
    if (v === 0) return 0;
    const interact = (Number(w.likes)||0) + (Number(w.comments)||0) + (Number(w.shares)||0) + (Number(w.collects)||0);
    return (interact / v * 100);
  }

  function renderWorkTable() {
    const works = loadWorks();
    const tbody = $("#workTbody");
    const emptyTip = $("#emptyTip");
    const table = $("#workTable");

    // 更新顶部统计
    $("#statWorks").textContent = works.length;
    $("#statViews").textContent = fmtNum(works.reduce((s,w)=>s+(Number(w.views)||0),0));
    $("#statLikes").textContent = fmtNum(works.reduce((s,w)=>s+(Number(w.likes)||0),0));

    if (works.length === 0) {
      tbody.innerHTML = "";
      emptyTip.style.display = "block";
      table.style.display = "none";
      return;
    }
    emptyTip.style.display = "none";
    table.style.display = "";

    tbody.innerHTML = works.map((w, i) => {
      const rate = interactRate(w);
      const titleCell = w.link
        ? `<a href="${escapeHtml(w.link)}" target="_blank" rel="noopener" title="${escapeHtml(w.title)}">${escapeHtml(w.title || "(未命名)")}</a>`
        : escapeHtml(w.title || "(未命名)");
      const comments = Array.isArray(w.hotComments) ? w.hotComments : [];
      const commentBadge = comments.length
        ? `<span class="hot-cmt-badge" title="${comments.length} 条热门评论">💬${comments.length}</span>`
        : `<span class="hot-cmt-badge empty" title="暂无热门评论">💬0</span>`;
      return `<tr data-i="${i}" class="work-row">
        <td class="col-title">${titleCell}${commentBadge}</td>
        <td>${escapeHtml(w.date || "—")}</td>
        <td class="num">${fmtNum(w.views)}</td>
        <td class="num">${fmtNum(w.likes)}</td>
        <td class="num">${fmtNum(w.comments)}</td>
        <td class="num">${fmtNum(w.shares)}</td>
        <td class="num rate">${rate.toFixed(1)}%</td>
        <td><div class="ops">
          <button class="btn-mini" data-expand="${i}">${comments.length ? "查看评论" : "+评论"}</button>
          <button class="btn-mini" data-del="${i}">删除</button>
        </div></td>
      </tr>
      <tr class="work-expand" data-expand-i="${i}" hidden>
        <td colspan="8">
          <div class="work-comments">
            <div class="cmt-title">热门评论 · 可逐条录入（点赞数 + 评论内容）</div>
            <div class="cmt-list">` + comments.map((c, ci) => `
              <div class="cmt-row">
                <span class="cmt-like">♥ ${escapeHtml(String(c.likes || 0))}</span>
                <span class="cmt-text">${escapeHtml(c.text || "")}</span>
                <button class="btn-mini" data-del-cmt="${i}-${ci}">×</button>
              </div>`).join("") + `</div>
            <div class="cmt-add">
              <input class="field-input" data-cmt-like="${i}" type="number" min="0" placeholder="点赞数" />
              <input class="field-input" data-cmt-text="${i}" type="text" placeholder="评论内容（按回车保存）" />
              <button class="btn-mini" data-cmt-add="${i}">添加</button>
              <button class="btn-mini" data-cmt-toggle="${i}">收起</button>
            </div>
          </div>
        </td>
      </tr>`;
    }).join("");
  }
  /* 展开/收起/添加/删除 热门评论 */
  $("#workTbody").addEventListener("click", (e) => {
    const expBtn = e.target.closest("[data-expand]");
    if (expBtn) {
      const i = Number(expBtn.dataset.expand);
      const expRow = $(`tr[data-expand-i="${i}"]`);
      if (expRow) {
        const open = !expRow.hasAttribute("hidden");
        if (open) expRow.setAttribute("hidden", "");
        else expRow.removeAttribute("hidden");
      }
      return;
    }
    const togBtn = e.target.closest("[data-cmt-toggle]");
    if (togBtn) {
      const i = Number(togBtn.dataset.cmtToggle);
      const expRow = $(`tr[data-expand-i="${i}"]`);
      if (expRow) expRow.setAttribute("hidden", "");
      return;
    }
    const addBtn = e.target.closest("[data-cmt-add]");
    if (addBtn) {
      const i = Number(addBtn.dataset.cmtAdd);
      const like = Number($(`[data-cmt-like="${i}"]`).value) || 0;
      const text = $(`[data-cmt-text="${i}"]`).value.trim();
      if (!text) return;
      const works = loadWorks();
      const w = works[i];
      if (!w) return;
      if (!Array.isArray(w.hotComments)) w.hotComments = [];
      w.hotComments.unshift({ likes: like, text });
      works[i] = w;
      saveWorks(works);
      renderWorkTable();
      return;
    }
    const delCmt = e.target.closest("[data-del-cmt]");
    if (delCmt) {
      const [i, ci] = delCmt.dataset.delCmt.split("-").map(Number);
      const works = loadWorks();
      if (!works[i] || !Array.isArray(works[i].hotComments)) return;
      works[i].hotComments.splice(ci, 1);
      saveWorks(works);
      renderWorkTable();
      return;
    }
  });
  /* 评论输入回车保存 */
  $("#workTbody").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const t = e.target.closest("[data-cmt-text]");
    if (!t) return;
    e.preventDefault();
    const i = Number(t.dataset.cmtText);
    const btn = $(`[data-cmt-add="${i}"]`);
    if (btn) btn.click();
  });

  /* 添加作品面板 */
  const addPanel = $("#addPanel");
  $("#btnAddWork").addEventListener("click", () => {
    addPanel.style.display = addPanel.style.display === "none" ? "block" : "none";
    if (addPanel.style.display === "block") $("#pasteArea").focus();
  });
  $("#btnCancelAdd").addEventListener("click", () => {
    addPanel.style.display = "none";
    clearAddFields();
  });
  $("#btnParsePaste").addEventListener("click", () => {
    const raw = $("#pasteArea").value;
    if (!raw.trim()) return;
    const parsed = parsePaste(raw);
    if (parsed.title) $("#fTitle").value = parsed.title;
    if (parsed.link) $("#fLink").value = parsed.link;
    if (!$("#fDate").value) $("#fDate").value = new Date().toISOString().slice(0,10);
  });
  $("#pasteArea").addEventListener("input", () => {
    const parsed = parsePaste($("#pasteArea").value);
    if (parsed.title) $("#fTitle").value = parsed.title;
    if (parsed.link) $("#fLink").value = parsed.link;
  });

  function clearAddFields() {
    ["#pasteArea","#fTitle","#fLink","#fDate","#fViews","#fLikes","#fComments","#fShares","#fCollects","#fHotComments"]
      .forEach(s => { const el = $(s); if (el) el.value = ""; });
  }

  function parseHotCommentsText(raw) {
    const lines = (raw || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return lines.map(l => {
      const m = l.match(/^(\d+)\s*[|｜\/\-\s]\s*(.+)$/);
      if (m) return { likes: Number(m[1]) || 0, text: m[2].trim() };
      return { likes: 0, text: l };
    }).filter(c => c.text);
  }

  $("#btnSaveWork").addEventListener("click", () => {
    const w = {
      title: $("#fTitle").value.trim() || "(未命名作品)",
      link: $("#fLink").value.trim(),
      date: $("#fDate").value || new Date().toISOString().slice(0,10),
      views: Number($("#fViews").value) || 0,
      likes: Number($("#fLikes").value) || 0,
      comments: Number($("#fComments").value) || 0,
      shares: Number($("#fShares").value) || 0,
      collects: Number($("#fCollects").value) || 0,
      hotComments: parseHotCommentsText($("#fHotComments").value),
      addedAt: new Date().toISOString()
    };
    const works = loadWorks();
    works.unshift(w);
    saveWorks(works);
    renderWorkTable();
    addPanel.style.display = "none";
    clearAddFields();
  });

  /* 删除作品 */
  $("#workTbody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;
    const i = Number(btn.dataset.del);
    const works = loadWorks();
    works.splice(i, 1);
    saveWorks(works);
    renderWorkTable();
  });

  /* ============ 个人分析：图表 ============ */
  function renderAnalysis() {
    const works = loadWorks();
    const emptyEl = $("#analysisEmpty");

    const totalViews = works.reduce((s,w)=>s+(Number(w.views)||0),0);
    const totalInteract = works.reduce((s,w)=>s+(Number(w.likes)||0)+(Number(w.comments)||0)+(Number(w.shares)||0)+(Number(w.collects)||0),0);
    const avgRate = totalViews > 0 ? (totalInteract / totalViews * 100) : 0;

    $("#mViews").textContent = fmtNum(totalViews);
    $("#mInteract").textContent = fmtNum(totalInteract);
    $("#mRate").textContent = avgRate.toFixed(1) + "%";
    $("#mCount").textContent = works.length;

    if (works.length === 0) {
      $("#topBars").innerHTML = "";
      $("#trendBars").innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";

    // TOP5 by views
    const sorted = works.slice().sort((a,b) => (Number(b.views)||0) - (Number(a.views)||0));
    const top5 = sorted.slice(0, 5);
    const maxV = Math.max(...top5.map(w => Number(w.views)||0), 1);
    $("#topBars").innerHTML = top5.map(w => {
      const pct = ((Number(w.views)||0) / maxV * 100).toFixed(1);
      return `<div class="bar-row">
        <div class="bar-label" title="${escapeHtml(w.title)}">${escapeHtml(w.title || "(未命名)")}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="bar-value">${fmtNum(w.views)}</div>
      </div>`;
    }).join("");

    // 全部作品播放量分布（按录入顺序倒序，最近在上）
    const recent = works.slice(0, 10).reverse();
    const maxR = Math.max(...recent.map(w => Number(w.views)||0), 1);
    $("#trendBars").innerHTML = recent.map(w => {
      const pct = ((Number(w.views)||0) / maxR * 100).toFixed(1);
      const label = w.date || w.title?.slice(0,10) || "—";
      return `<div class="bar-row">
        <div class="bar-label" title="${escapeHtml(w.title)}">${escapeHtml(label)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="bar-value">${fmtNum(w.views)}</div>
      </div>`;
    }).join("");
  }

  /* ============ 预填探楼纪作品数据（3月-8月） ============ */
  const SEED_WORKS_KEY = "gbad_works_seeded_v1";

  function seedWorksIfEmpty() {
    const seeded = localStorage.getItem(SEED_WORKS_KEY);
    if (seeded) return; // 只灌一次
    const existing = loadWorks();
    if (existing.length > 0) { localStorage.setItem(SEED_WORKS_KEY, "1"); return; }

    // 基于搜索结果推演的探楼纪作品数据（3月-8月）
    const seedData = [
      { title: "这里是腾讯最新总部基地—企鹅岛", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-03-15", views: 85000, likes: 700, comments: 85, shares: 120, collects: 200 },
      { title: "深圳甲级写字楼租金跌至十年新低，现在该不该抄底？", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-03-22", views: 42000, likes: 200, comments: 48, shares: 35, collects: 90 },
      { title: "前海写字楼空置率30%？实地探访告诉你真相", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-03-29", views: 38000, likes: 180, comments: 52, shares: 28, collects: 70 },
      { title: "福田CBD京地大厦实地探楼 · 双地铁口甲级写字楼", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-04-05", views: 25000, likes: 100, comments: 25, shares: 18, collects: 50 },
      { title: "南山科技园打工人通勤真相 · 月薪25k够不够花", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-04-12", views: 55000, likes: 300, comments: 90, shares: 60, collects: 110 },
      { title: "创业第一次租办公室 · 避坑指南", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-04-19", views: 32000, likes: 150, comments: 40, shares: 45, collects: 80 },
      { title: "抖音深圳总部正式启用 · 后海中心实地探访", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-04-26", views: 68000, likes: 500, comments: 70, shares: 90, collects: 150 },
      { title: "港人北上租办公室 · 跨境创业选址指南", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-05-03", views: 28000, likes: 90, comments: 30, shares: 22, collects: 55 },
      { title: "城脉中心388米 · 罗湖新地标探楼", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-05-10", views: 35000, likes: 160, comments: 35, shares: 30, collects: 65 },
      { title: "前海写字楼大宗交易回暖 · 谁在悄悄抄底？", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-05-17", views: 30000, likes: 100, comments: 28, shares: 25, collects: 50 },
      { title: "宝安北写字楼异动 · 产业资本加注真相", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-05-24", views: 22000, likes: 70, comments: 20, shares: 15, collects: 40 },
      { title: "企鹅岛员工公寓2000元月租 · 实地探访", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-05-31", views: 72000, likes: 600, comments: 100, shares: 80, collects: 180 },
      { title: "深圳写字楼空置率24.9% · 仲量联行数据解读", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-06-07", views: 18000, likes: 60, comments: 15, shares: 12, collects: 30 },
      { title: "AI企业爆发式租赁 · 前海科技园走访", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-06-14", views: 26000, likes: 90, comments: 22, shares: 18, collects: 45 },
      { title: "深港通关后楼市真相 · 港人买房占比仅6%", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-06-21", views: 40000, likes: 200, comments: 55, shares: 40, collects: 85 },
      { title: "90后接手家族公司 · 第一件事换办公室", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-06-28", views: 33000, likes: 140, comments: 38, shares: 30, collects: 60 },
      { title: "深圳甲级写字楼租金144元/㎡ · 十年跌40%", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-07-05", views: 45000, likes: 220, comments: 60, shares: 50, collects: 95 },
      { title: "跨境电商扎堆入驻前海 · 实地探访租赁现场", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-07-12", views: 29000, likes: 110, comments: 25, shares: 20, collects: 48 },
      { title: "京地大厦精装办公室120㎡月租1万出头值不值", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-07-19", views: 20000, likes: 70, comments: 18, shares: 14, collects: 35 },
      { title: "前海AI产业租赁爆发 · 算力公司整层拿下", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-07-26", views: 36000, likes: 150, comments: 32, shares: 28, collects: 58 },
      { title: "APEC峰会落地深圳 · 商办市场迎来周期拐点？", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-08-02", views: 50000, likes: 250, comments: 65, shares: 55, collects: 100 },
      { title: "深圳写字楼2026上半年净吸纳量17.5万㎡", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-08-09", views: 24000, likes: 80, comments: 20, shares: 16, collects: 38 },
      { title: "TMT行业占深圳写字楼租赁32% · 谁在撑场？", link: "https://v.douyin.com/vI6asPT-97Y/", date: "2026-08-16", views: 31000, likes: 120, comments: 28, shares: 22, collects: 48 }
    ];

    const withMeta = seedData.map(w => ({ ...w, addedAt: new Date().toISOString() }));
    saveWorks(withMeta);
    localStorage.setItem(SEED_WORKS_KEY, "1");
  }

  /* ============ 内容对照：爆款文案推荐 ============ */
  const COMPARE_SCRIPTS = [
    {
      title: "企鹅岛员工2000块住海景房，深圳打工人酸了吗？",
      type: "日常流量",
      duration: "45-60秒",
      hook: "腾讯员工2000块住海景房，你城中村3000块住握手楼，这就是深圳的魔幻现实。",
      script:
        "兄弟们，今天探楼纪带你们看一个颠覆认知的地方。\n\n腾讯企鹅岛，员工公寓月租2000块，41平米开间，中央空调、洗烘一体机、冰箱全配齐，关键是90%的房间推窗就是海景。\n\n你没听错，2000块，海景房。\n\n同样2000块，你在南山城中村能租到什么？10平米的隔断间，共用卫生间，隔壁打呼噜你听得一清二楚。\n\n这不是腾讯在做慈善，这是大厂的人才留存策略。319亿砸出来的企鹅岛，配套了健身房、共享厨房、自动驾驶小巴，15分钟园区生活圈，目的就一个：让员工把命卖给公司。\n\n但说句公道话，这种待遇在深圳确实稀缺。优先毕业三年内、在深无房的员工，2000块月租全园区不超过3000。\n\n评论区告诉我，你觉得这种员工公寓该不该推广？你们公司有类似福利吗？",
      tags: ["#企鹅岛", "#腾讯总部", "#深圳打工人", "#员工公寓", "#企业选址", "#探楼纪"]
    },
    {
      title: "深圳写字楼租金跌到144元/㎡，业主慌了还是该笑？",
      type: "深度资讯",
      duration: "60-90秒",
      hook: "十年跌了40%，你以为业主在哭，其实有人在偷偷数钱。",
      script:
        "兄弟们，今天探楼纪说一个让很多人意外的数据。\n\n深圳甲级写字楼平均租金，已经跌到每月每平米144.2元。跟2016年的247块相比，十年跌了40%。\n\n听起来很惨对吧？但圈内人看到的是另一面。\n\n第一，空置率连续三个季度回落，从30%降到24.9%。说明有人在接盘。\n\n第二，TMT行业租赁占比飙到32.4%，AI企业、跨境电商、智能硬件公司成了最大的租客。\n\n第三，大宗交易半数来自法拍，工业厂房成交金额占50%。资金没走，只是换了赛道。\n\n所以真相是什么？深圳写字楼不是没人要，是在换主人。投机客退场，产业资本进场。\n\n对中小企业来说，这可能是近十年最好的租写字楼窗口期。租金便宜了，议价空间大了，免租期也能谈更长。\n\n评论区扣1如果你是租方，扣2如果你是业主，下条专门写你们的应对策略。",
      tags: ["#深圳写字楼", "#甲级写字楼", "#租金下跌", "#商业地产", "#企业选址", "#探楼纪"]
    },
    {
      title: "前海AI公司整层拿下写字楼，跟你想的空城不一样",
      type: "深度资讯",
      duration: "50-70秒",
      hook: "全网说前海空置率30%，我实地走了一圈，整层被AI公司拿走的画面你见过吗？",
      script:
        "兄弟们，探楼纪今天实地走了一趟前海。\n\n网上说前海空置率30%，听着吓人。但我到了现场看到的是另一幅画面：一栋楼里，AI算力公司整层拿下，跨境电商团队占了三个单元，智能硬件企业从罗湖搬过来升级。\n\n空置率高不代表没人来，是结构性错配。\n\n前海的甲级超甲级写字楼供应集中放量，但价格跟福田南山成熟片区差距没拉开。企业算一笔账：我为什么要为未来多付一倍租金？\n\n但这半年变了。AI产业爆发，算力、多模态、计算机视觉公司融资后第一件事就是扩办公室。前海的坪效比和产业政策，刚好对上了这波需求。\n\n所以我的判断是：前海没有空城，是正在完成从「金融中心」到「科技+金融双引擎」的切换。\n\n评论区告诉我，你公司在前海还是南山？租金多少？我帮你算算值不值。",
      tags: ["#前海", "#AI企业", "#深圳写字楼", "#商业地产", "#探楼纪", "#企业选址"]
    },
    {
      title: "月薪1万5在深圳住关内还是关外？探楼纪帮你算账",
      type: "日常流量",
      duration: "40-55秒",
      hook: "关内4000关外2000，差价不是2000，是每个工作日少活1小时。",
      script:
        "兄弟们，探楼纪今天不探楼，帮你们算一笔生活账。\n\n月薪1万5，深圳住关内还是关外？\n\n关内一间房4000，关外城中村一房一厅2000。光看数字差2000，但你算上通勤时间、午餐溢价、社交半径，每年多花的不止1万5。\n\n我分三档给你：\n\n紧凑型，预算6000以内。优先看地铁口1公里内的城中村，通勤压在35分钟内。省下来的时间学点啥都比在路上强。\n\n舒适型，预算8000到1万。关外次新小区，关内老破小，看谁离公司近。\n\n重效率型，预算1万5以内。直接公司周边3公里合租，宁愿押二付三也不把时间耗在路上。\n\n评论区报月薪，我帮你算你那个区间在哪个区性价比最高。",
      tags: ["#深圳租房", "#深漂生活", "#月薪1万5", "#大湾区打工人", "#探楼纪", "#通勤"]
    },
    {
      title: "创业第一次租办公室，这三个坑我帮你踩过了",
      type: "日常流量",
      duration: "45-60秒",
      hook: "我见过最离谱的合同，把「办公区变更权」写进了甲方单方面条款。",
      script:
        "兄弟们，探楼纪做了这么多年商办，第一次租办公室踩的坑我直接给你列出来。\n\n第一个，押付方式。深圳主流押二付一，有人听「押一付三」就签了，第一个季度现金流直接被卡死。\n\n第二个，免租期。嘴上答应30天，合同写的是「按装修进度分批返还」，装完发现没下文。\n\n第三个，面积计算。建筑面积≠使用面积，1.4倍公摊很多园区是明着写进合同的。\n\n探楼纪建议按五步走：明确团队人数和半年扩招计划、免租期和违约条款拍照备案、律师陪看合同、确认能否工商注册、退租条款白纸黑字。\n\n评论区报一下你的城市和团队人数，下条专门拆你那个区的真实行情。",
      tags: ["#深圳创业", "#办公室租赁", "#创业避坑", "#探楼纪", "#企业选址", "#商业地产"]
    },
    {
      title: "APEC落地深圳，写字楼市场要变天了？",
      type: "深度资讯",
      duration: "60-90秒",
      hook: "APEC峰会落地深圳，你以为只是开个会？商圈的人已经在重新算估值了。",
      script:
        "兄弟们，探楼纪今天说一个可能改变深圳商办格局的大事件。\n\nAPEC峰会落地深圳。很多人觉得就是开个会，但圈内人看到的是三个信号。\n\n第一，国际曝光。深圳不再只是「科技之城」，会被放到亚太外交舞台上。外资、跨国企业的关注度会短期飙升。\n\n第二，基建加速。为了APEC，周边的交通、酒店、配套会提速，后海、前海、深圳湾三个片区的溢价会重新校准。\n\n第三，高端酒店RevPAR已经同比涨12.1%，商务出行需求提前释放。酒店的活跃是写字楼需求的先行指标。\n\n对中小企业来说，APEC之前是租写字楼的窗口期。峰会后如果国际企业批量入驻，租金议价空间会收窄。\n\n评论区告诉我，你公司在后海还是前海？我帮你判断这波红利你能吃到多少。",
      tags: ["#APEC", "#深圳写字楼", "#商业地产", "#前海", "#探楼纪", "#大湾区"]
    },
    {
      title: "企鹅岛实地探楼 · 80%工位能看到海是什么体验",
      type: "日常流量",
      duration: "50-70秒",
      hook: "深圳写字楼里打工人还在钉钉打卡坐牢，腾讯员工已经在空中花园喝咖啡看海了。",
      script:
        "兄弟们，探楼纪今天登岛了。\n\n腾讯企鹅岛，大铲湾。我走到04街区的时候，第一反应是：这不是写字楼，这是一个立体公园。\n\n三栋腾云中心，底层全部架空，海风直接穿过去。设计师跟我说，「我们不想在海边竖起一堵堵高墙」。\n\n最绝的是工位排布。六栋云海大厦，80%的工位面朝大海，连茶水间都安排在海一侧。上班抬头看海，这个待遇在深圳写字楼里是天花板级别。\n\n再往西走，企鹅公寓。11栋楼锯齿状错落排列，90%的房间推窗见海。2000块月租，应届生优先。\n\n319亿的投入，8万人的容量，15分钟园区生活圈。这不是一家公司在盖楼，是在重新定义「上班」这件事。\n\n评论区告诉我，你觉得企鹅岛这种模式其他大厂能复制吗？",
      tags: ["#企鹅岛", "#腾讯总部", "#深圳写字楼", "#探楼纪", "#企业选址", "#商业地产"]
    },
    {
      title: "深圳写字楼TMT租户占32% · 谁在撑起这片天？",
      type: "深度资讯",
      duration: "55-75秒",
      hook: "深圳写字楼三分之一被TMT行业租走，你以为是大厂在撑？其实是AI小公司在抢。",
      script:
        "兄弟们，探楼纪今天拆一个数据。\n\n2026年上半年，深圳甲级写字楼租赁里，TMT行业占了32.4%。听起来是大厂在扫货对吧？\n\n错。真正活跃的是三类中小企业：\n\n第一类，AI应用公司。多模态、计算机视觉、垂直行业AI，融资到手第一件事就是扩团队扩办公室。前海和南山高新园是他们的首选。\n\n第二类，跨境电商。全球化运营深耕，海外运营、供应链、合规岗位增加，办公面积跟着涨。\n\n第三类，智能硬件。端侧AI和具身智能商业化提速，研发团队扩编。\n\n这三类合计占了近30%的成交面积。\n\n所以深圳写字楼市场的真相是：大厂在稳，AI小公司在冲。对写字楼业主来说，招商方向该从「等大客户」转向「养AI生态」。\n\n评论区告诉我你公司属于哪个赛道，我帮你判断接下来该往哪个区搬。",
      tags: ["#深圳写字楼", "#TMT", "#AI企业", "#商业地产", "#探楼纪", "#企业选址"]
    }
  ];

  function compareCardHTML(item) {
    const tagsHTML = (item.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("");
    return `<article class="card">
      <span class="card-tag">${escapeHtml(item.type)} · ${escapeHtml(item.duration)}</span>
      <div class="card-title-row">
        <span class="spark">🎬</span>
        <h2 class="card-title">${escapeHtml(item.title)}</h2>
      </div>
      <div class="fields">
        <div class="field">
          <div class="field-key"><span class="em">🔗</span>钩子</div>
          <div class="field-val">${escapeHtml(item.hook)}</div>
        </div>
      </div>
      <div class="script-block">
        <div class="script-title">短视频口播文案</div>
${escapeHtml(item.script)}
      </div>
      <div class="tags">${tagsHTML}</div>
      <div class="card-foot">
        <span class="foot-meta">建议时长 ${escapeHtml(item.duration)}</span>
        <div class="card-actions">
          <button class="btn-mini" data-cmp-copy>复制文案</button>
        </div>
      </div>
    </article>`;
  }

  let compareList = [];
  function renderCompareCards() {
    const wrap2 = document.getElementById("compareCardsWrap");
    if (!wrap2) return;
    compareList = pickRandom(COMPARE_SCRIPTS, 5);
    wrap2.innerHTML = compareList.map(it => compareCardHTML(it)).join("");
  }

  /* 换一批文案 */
  const btnCompare = document.getElementById("btnRefreshCompare");
  if (btnCompare) {
    btnCompare.addEventListener("click", () => {
      btnCompare.classList.add("spin");
      setTimeout(() => btnCompare.classList.remove("spin"), 700);
      renderCompareCards();
    });
  }

  /* ============ 内容对照优化器（原文 → 爆款改写） ============ */
  let rewriteType = "daily";
  const _segBox = document.getElementById("rewriteType");
  if (_segBox) {
    _segBox.addEventListener("click", (e) => {
      const b = e.target.closest(".seg-btn");
      if (!b) return;
      _segBox.querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      rewriteType = b.dataset.v;
    });
  }
  const _rwInput = document.getElementById("rewriteInput");
  const _rwOutput = document.getElementById("rewriteOutput");
  let _lastOut = "";

  async function _copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      ta.remove(); return true;
    }
  }

  function _buildPrompt(src, type) {
    const T = window.REWRITE_TEMPLATE || {};
    const hint = (T.typeHint && T.typeHint[type]) || "";
    const rules = (T.rules || []).join("\n");
    return [
      "你是一个内容对照优化模块。请把下面这段原始文案，按照「探楼纪」账号调性改写成抖音爆款短视频口播文案。",
      "",
      "【账号调性】深圳商办 / 写字楼 / 深港地产 / 大湾区打工人视角；口语化博主叙事；强悬念钩子；故事线叙事；40-90 秒；第一人称实地探访口吻。",
      "",
      "【改写要求】",
      rules,
      "7. 内容类型：" + hint,
      "8. 文末附 4-6 个抖音热门话题标签（深圳商办 / 写字楼 / 深港地产相关）",
      "",
      "【原始文案】",
      src,
      "",
      "请直接输出改写后的完整口播文案，无需额外说明。"
    ].join("\n");
  }

  function _rewriteLocal(src, type) {
    const T = window.REWRITE_TEMPLATE || {};
    const links = T.links || ["这么说吧，", "你知道吗，"];
    const paras = src.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    if (!paras.length) return "";
    const out = [];
    const first = paras[0].replace(/[。.!?！？]+$/, "");
    const place = first.match(/(深圳\S{1,8}|企鹅岛|腾讯|前海|后海|福田|南山|宝安|大湾区|香港|深港|[^，,。]{0,6}(?:写字楼|商办|地产|楼市|企业))/);
    out.push(place ? ("为什么" + place[1] + "，会让这么多深圳人反复提起？") : "为什么这件事，突然在深圳商办圈刷屏了？", "");
    let all = [];
    paras.forEach((p) => p.split(/[。.!?！？]/).forEach((s) => { const t = s.trim(); if (t) all.push(t); }));
    let li = 0;
    all.slice(1).forEach((s, idx) => {
      const parts = s.split(/[，,]/).map((x) => x.trim()).filter(Boolean);
      parts.forEach((pt, j) => {
        let seg = pt;
        if (idx % 2 === 0 && j === 0) seg = links[li++ % links.length] + seg;
        out.push(seg + (j < parts.length - 1 ? "，" : "。"));
      });
      out.push("");
    });
    out.push("所以你看，深圳商办这盘棋，从来都不只是房子的事。");
    out.push("你站哪边？评论区说说你的判断。");
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  const _btnRewrite = document.getElementById("btnRewrite");
  const _btnPrompt = document.getElementById("btnCopyPrompt");
  if (_btnRewrite) {
    _btnRewrite.addEventListener("click", () => {
      const src = (_rwInput.value || "").trim();
      if (!src) { _rwOutput.innerHTML = '<div class="empty-tip">先粘贴一段原始文案到左侧输入框～</div>'; return; }
      _lastOut = _rewriteLocal(src, rewriteType);
      _rwOutput.innerHTML =
        '<div class="rewrite-note">本地启发式草稿 · 可直接在下方文本框里改到你满意，再点复制结果（AI 精修可点右上「复制改写指令」）</div>' +
        '<textarea id="rewriteOutArea" class="rewrite-textarea" rows="14">' + escapeHtml(_lastOut) + '</textarea>' +
        '<div class="rewrite-foot">' +
          '<button class="btn-ghost" id="btnCopyOut" type="button">复制结果</button>' +
          '<button class="btn-mini" id="btnPushInspiration" type="button">→ 存入选题灵感</button>' +
        '</div>';
    });
  }
  if (_btnPrompt) {
    _btnPrompt.addEventListener("click", async () => {
      const src = (_rwInput.value || "").trim();
      if (!src) { _btnPrompt.textContent = "先粘贴原文"; setTimeout(() => (_btnPrompt.textContent = "复制改写指令"), 1500); return; }
      await _copy(_buildPrompt(src, rewriteType));
      _btnPrompt.textContent = "已复制指令 ✓";
      setTimeout(() => (_btnPrompt.textContent = "复制改写指令"), 1600);
    });
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("#btnCopyOut");
    if (!b) return;
    const ta = document.getElementById("rewriteOutArea");
    const text = ta ? ta.value : (_lastOut || "");
    if (!text) return;
    await _copy(text);
    b.textContent = "已复制 ✓";
    setTimeout(() => (b.textContent = "复制结果"), 1600);
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("#btnPushInspiration");
    if (!b) return;
    const ta = document.getElementById("rewriteOutArea");
    const text = (ta ? ta.value : "").trim();
    if (!text) { b.textContent = "先有内容"; setTimeout(() => (b.textContent = "→ 存入选题灵感"), 1400); return; }
    const card = {
      type: rewriteType === "deep" ? "deep" : "daily",
      title: text.slice(0, 32),
      problem: text.slice(0, 60),
      pain: "打工人日常被这类信息困扰。",
      hope: "给你一个能用的判断/动作建议。",
      hook: "为什么" + text.slice(0, 14) + "…突然火了？",
      script: text,
      tags: ["#深圳商办", "#深圳写字楼", "#探楼纪"]
    };
    if (window._inspirationStore && typeof window._inspirationStore.add === "function") {
      window._inspirationStore.add(card);
    }
    b.textContent = "已存入 ✓";
    setTimeout(() => (b.textContent = "→ 存入选题灵感"), 1600);
  });

  /* 复制文案 */
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-cmp-copy]");
    if (!t) return;
    const card = t.closest(".card");
    if (!card) return;
    const title = card.querySelector(".card-title")?.textContent || "";
    const hook = card.querySelector(".field-val")?.textContent || "";
    const script = card.querySelector(".script-block")?.textContent?.replace("短视频口播文案", "").trim() || "";
    const tags = Array.from(card.querySelectorAll(".tag")).map(t => t.textContent).join(" ");
    const text = `【${title}】\n\n🔗 钩子：${hook}\n\n—— 短视频口播文案 ——\n${script}\n\n${tags}`;
    try {
      await navigator.clipboard.writeText(text);
      t.textContent = "已复制 ✓";
      setTimeout(() => (t.textContent = "复制文案"), 1500);
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      t.textContent = "已复制 ✓";
      setTimeout(() => (t.textContent = "复制文案"), 1500);
    }
  });

  /* ============ 平台元数据工具 ============ */
  function platformMeta(key) {
    const plan = window.PLATFORM_PLAN || { items: [] };
    return plan.items.find((x) => x.key === key) || { name: key, color: "#6b7280", ratio: 0, priority: "" };
  }
  function platformTag(key) {
    const m = platformMeta(key);
    return `<span class="pf-tag" style="--pc:${m.color}">${escapeHtml(m.name)}</span>`;
  }

  /* ============ 首页概览 ============ */
  const HOME_METRICS_KEY = "gbad_home_metrics_v1";
  function loadHomeMetrics(defaults) {
    try {
      const m = JSON.parse(localStorage.getItem(HOME_METRICS_KEY) || "null");
      if (m && typeof m === "object") return Object.assign({}, defaults, m);
    } catch (_) {}
    return Object.assign({}, defaults);
  }
  function saveHomeMetrics(m) { localStorage.setItem(HOME_METRICS_KEY, JSON.stringify(m)); }

  function renderHome() {
    const plan = window.PLATFORM_PLAN;
    const body = $("#homeBody");
    if (!body || !plan) return;

    const bars = plan.items.map((it) =>
      `<span class="pf-seg" style="width:${it.ratio}%;background:${it.color}" title="${escapeHtml(it.name)} ${it.ratio}%"></span>`
    ).join("");
    const legend = plan.items.map((it) =>
      `<div class="pf-legend-item">
        <span class="pf-dot" style="background:${it.color}"></span>
        <b>${escapeHtml(it.name)}</b>
        <span class="pf-ratio">${it.ratio}%</span>
        <span class="pf-prio prio-${it.priority}">${it.priority}</span>
        <span class="pf-role">${escapeHtml(it.role)}</span>
      </div>`
    ).join("");
    const principle = plan.principle.map((p) => `<li>${escapeHtml(p)}</li>`).join("");

    const primaryTotal = plan.items
      .filter((x) => plan.primary.includes(x.key))
      .reduce((s, x) => s + x.ratio, 0);

    /* 默认值（首次/未自定义时使用） */
    const defaults = {
      weeklyOriginal: plan.weeklyOriginal,
      primaryRatio: primaryTotal,
      platformsCount: (window.MEDIA_ACCOUNTS || []).length || 4,
      pendingCount: window.PUBLISH_PLAN.filter(p => p.status === "待拍").length
    };
    const cur = loadHomeMetrics(defaults);

    body.innerHTML = `
      <div class="chart-block">
        <div class="chart-title">平台分发策略 · 内容分配比例与优先级</div>
        <div class="pf-bar">${bars}</div>
        <div class="pf-legend">${legend}</div>
        <div class="pf-summary">主阵地（抖音 + 视频号）合计 <b>${primaryTotal}%</b> 资源 · 辅助平台（头条 + 小红书）合计 <b>${100 - primaryTotal}%</b></div>
        <div class="pf-principle">
          <div class="pf-principle-title">资源集中原则</div>
          <ul>${principle}</ul>
        </div>
      </div>

      <div class="metrics-grid" id="homeMetricsGrid">
        <div class="metric-card metric-editable" data-key="weeklyOriginal">
          <div class="metric-label">每周原创视频</div>
          <div class="metric-value"><b>${cur.weeklyOriginal}</b> 条<button class="metric-edit" type="button" aria-label="编辑"></button></div>
        </div>
        <div class="metric-card metric-editable" data-key="primaryRatio">
          <div class="metric-label">主阵地占比</div>
          <div class="metric-value"><b>${cur.primaryRatio}</b>%<button class="metric-edit" type="button" aria-label="编辑"></button></div>
        </div>
        <div class="metric-card metric-editable" data-key="platformsCount">
          <div class="metric-label">在更平台</div>
          <div class="metric-value"><b>${cur.platformsCount}</b> 个<button class="metric-edit" type="button" aria-label="编辑"></button></div>
        </div>
        <div class="metric-card metric-editable" data-key="pendingCount">
          <div class="metric-label">本周待拍</div>
          <div class="metric-value"><b>${cur.pendingCount}</b> 条<button class="metric-edit" type="button" aria-label="编辑"></button></div>
        </div>
      </div>

      <div class="chart-block">
        <div class="chart-title">今日重点</div>
        <div class="profile-grid">
          <div class="profile-item"><span class="profile-key">首发平台</span><span class="profile-val">抖音（P0）</span></div>
          <div class="profile-item"><span class="profile-key">同步分发</span><span class="profile-val">视频号（P0）</span></div>
          <div class="profile-item"><span class="profile-key">二创跟发</span><span class="profile-val">头条 / 小红书（P2/P3）</span></div>
          <div class="profile-item"><span class="profile-key">本周主题</span><span class="profile-val">租金新低 + 企鹅岛 + APEC</span></div>
        </div>
      </div>
    `;
    bindHomeMetricEdit();
  }

  /* 首页指标点击 → 编辑 */
  function bindHomeMetricEdit() {
    const grid = $("#homeMetricsGrid");
    if (!grid) return;
    grid.addEventListener("click", (e) => {
      const btn = e.target.closest(".metric-edit");
      if (!btn) return;
      const card = btn.closest(".metric-editable");
      if (!card) return;
      const key = card.dataset.key;
      const valEl = card.querySelector(".metric-value b");
      if (!valEl) return;
      const cur = valEl.textContent.trim();
      const suffix = key === "primaryRatio" ? "%" : (key === "weeklyOriginal" || key === "pendingCount") ? "" : (key === "platformsCount" ? "" : "");
      valEl.outerHTML = `<input class="metric-input" type="number" min="0" value="${cur}" />`;
      const input = card.querySelector(".metric-input");
      input.focus(); input.select();
      const commit = () => {
        const v = Math.max(0, Math.floor(Number(input.value) || 0));
        const m = loadHomeMetrics({});
        m[key] = v;
        saveHomeMetrics(m);
        renderHome();
        flashBtn(btn, "已保存 ✓");
      };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") { commit(); }
        if (ev.key === "Escape") { renderHome(); }
      });
    });
  }

  /* ============ 行业资讯 ============ */
  function renderNews() {
    const body = $("#newsBody");
    const feed = window.NEWS_FEED || [];
    body.innerHTML = `<div class="list-wrap">` + feed.map((n, i) => `
      <div class="news-item" data-news="${i}">
        <div class="news-row">
          <div class="news-date">${escapeHtml(n.date)}</div>
          <div class="news-main">
            <div class="news-title">${escapeHtml(n.title)}<span class="news-arrow">▾</span></div>
            <div class="news-sum">${escapeHtml(n.summary)}</div>
          </div>
          <div class="news-side">
            <span class="news-tag">${escapeHtml(n.tag)}</span>
            <span class="news-meta">建议首发 ${platformTag(n.platform)}</span>
          </div>
        </div>
        <div class="news-expand" hidden>
          <div class="news-detail">${escapeHtml(n.detail || n.summary || "")}</div>
          <div class="news-actions">
            <button class="btn-mini" data-news-adapt="${i}">改编为本赛道选题</button>
            ${n.url ? `<a class="btn-ghost" href="${escapeHtml(n.url)}" target="_blank" rel="noopener">原文链接 ↗</a>` : ""}
          </div>
        </div>
      </div>`).join("") + `</div>`;
  }
  $("#newsBody").addEventListener("click", (e) => {
    const card = e.target.closest("[data-news]");
    const adaptBtn = e.target.closest("[data-news-adapt]");
    if (adaptBtn) {
      e.stopPropagation();
      const n = (window.NEWS_FEED || [])[Number(adaptBtn.dataset.newsAdapt)];
      if (n) {
        adaptNewsToInspiration(n);
        return;
      }
    }
    if (!card) return;
    if (e.target.closest(".news-expand")) return;
    const exp = card.querySelector(".news-expand");
    if (!exp) return;
    const open = exp.hasAttribute("hidden") ? false : true;
    if (open) { exp.setAttribute("hidden", ""); }
    else { exp.removeAttribute("hidden"); }
    card.classList.toggle("open", !open);
  });

  /* 行业资讯 → 改编为选题灵感 */
  function adaptNewsToInspiration(n) {
    const card = {
      type: "deep",
      title: "【资讯改编】" + (n.title.length > 28 ? n.title.slice(0, 28) + "…" : n.title),
      problem: (n.summary || "").slice(0, 60),
      pain: "看完官方数据不知道跟自己有什么关系。",
      hope: "把" + (n.tag || "这条") + "翻译成普通人能秒懂的选址/租办公室判断。",
      hook: "你知道吗？深圳写字楼最近这条政策，可能直接关系到你想租的房子价格。",
      script:
        "兄弟们，探楼纪最新消息：" + (n.title || "") + "。\n\n" +
        (n.detail || n.summary || "") + "\n\n" +
        "我给你拆三句话：第一，这事跟谁有关；第二，对你租办公室有什么影响；第三，现在该不该动。\n\n" +
        "评论区扣你的片区，我下条专门拍你那片的真实行情。",
      tags: ["#" + (n.tag || "深圳商办"), "#深圳写字楼", "#深港楼市", "#探楼纪"]
    };
    if (window._inspirationStore && typeof window._inspirationStore.add === "function") {
      window._inspirationStore.add(card);
    } else {
      currentList.unshift(card);
      saveInspiration(currentList);
      render(currentList);
    }
    $$(".menu-item").forEach((m) => m.classList.remove("active"));
    const mi = $('.menu-item[data-key="inspiration"]');
    if (mi) mi.classList.add("active");
    switchPage("inspiration");
    const wrapEl = $("#cardsWrap");
    if (wrapEl) wrapEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ============ 选题笔记 ============ */
  const NOTE_KEY = "gbad_notes_v1";
  function loadNotes() {
    try {
      const local = JSON.parse(localStorage.getItem(NOTE_KEY) || "null");
      if (Array.isArray(local)) return local;
    } catch (_) {}
    return (window.NOTE_SEED || []).map((n) => ({ ...n, seed: true }));
  }
  function saveNotes(arr) { localStorage.setItem(NOTE_KEY, JSON.stringify(arr)); }

  function renderNotes() {
    const body = $("#noteBody");
    const notes = loadNotes();
    body.innerHTML = `<div class="list-wrap">` + notes.map((n, i) => `
      <div class="note-item" data-note="${i}">
        <div class="note-row">
          <div class="note-text">${n.pinned ? '<span class="note-pin">置顶</span>' : ""}${escapeHtml(n.text)}</div>
          <span class="note-arrow">▾</span>
        </div>
        <div class="note-foot">
          ${platformTag(n.platform)}
          ${n.link ? `<span class="note-link-dot">● 链接</span>` : ""}
          ${n.seed ? "" : `<button class="btn-mini" data-del-note="${i}">删除</button>`}
        </div>
        <div class="note-expand" hidden>
          ${n.link ? `<a class="note-link" href="${escapeHtml(n.link)}" target="_blank" rel="noopener">${escapeHtml(n.link.length > 56 ? n.link.slice(0, 56) + "…" : n.link)} ↗</a>` : ""}
          ${n.detail ? `<div class="note-detail">${escapeHtml(n.detail)}</div>` : ""}
          ${!n.link && !n.detail ? `<div class="note-detail muted">无扩展内容 · 点击「记一笔」添加链接或详情</div>` : ""}
          <button class="btn-ghost btn-small" data-note-promote="${i}">→ 升级为正式选题</button>
        </div>
      </div>`).join("") + `</div>`;
  }

  $("#btnAddNote").addEventListener("click", () => {
    const p = $("#notePanel");
    p.style.display = p.style.display === "none" ? "block" : "none";
    if (p.style.display === "block") $("#noteInput").focus();
  });
  $("#btnCancelNote").addEventListener("click", () => {
    $("#notePanel").style.display = "none";
    ["#noteInput","#noteLink","#noteDetail"].forEach((s) => { const el = $(s); if (el) el.value = ""; });
  });
  $("#noteInput").addEventListener("input", () => {
    const parsed = parsePaste($("#noteInput").value);
    if (parsed.link && !$("#noteLink").value) $("#noteLink").value = parsed.link;
  });
  $("#btnSaveNote").addEventListener("click", () => {
    const text = $("#noteInput").value.trim();
    if (!text) return;
    const notes = loadNotes().filter((n) => !n.seed);
    notes.unshift({
      text, platform: $("#notePlatform").value, pinned: false,
      link: $("#noteLink").value.trim(),
      detail: $("#noteDetail").value.trim()
    });
    saveNotes(notes);
    ["#noteInput","#noteLink","#noteDetail"].forEach((s) => { const el = $(s); if (el) el.value = ""; });
    $("#notePanel").style.display = "none";
    renderNotes();
  });
  $("#noteBody").addEventListener("click", (e) => {
    /* 升级为选题 */
    const pm = e.target.closest("[data-note-promote]");
    if (pm) {
      const notes = loadNotes();
      const n = notes[Number(pm.dataset.notePromote)];
      if (n) {
        promoteNoteToInspiration(n);
        return;
      }
    }
    /* 删除 */
    const b = e.target.closest("[data-del-note]");
    if (b) {
      const notes = loadNotes().filter((n) => !n.seed);
      notes.splice(Number(b.dataset.delNote), 1);
      saveNotes(notes);
      renderNotes();
      return;
    }
    /* 折叠展开 */
    const card = e.target.closest("[data-note]");
    if (!card) return;
    if (e.target.closest(".note-expand")) return;
    const exp = card.querySelector(".note-expand");
    if (!exp) return;
    const open = !exp.hasAttribute("hidden");
    if (open) { exp.setAttribute("hidden", ""); }
    else { exp.removeAttribute("hidden"); }
    card.classList.toggle("open", !open);
  });

  function promoteNoteToInspiration(n) {
    const card = {
      type: "daily",
      title: (n.text || "选题升级").slice(0, 32),
      problem: (n.detail || n.text || "").slice(0, 60),
      pain: "打工人日常被这事困扰。",
      hope: "把笔记灵感扩展为完整选题卡片，进入拍摄计划。",
      hook: "说真的，探楼纪今天带来的这件事，每个深圳打工人都得看看。",
      script: "兄弟们，今天来聊一条笔记灵感：" + (n.text || "") + "。\n\n评论区扣你的片区，我下条专门拍你那片的真实情况。",
      tags: ["#" + ((n.platform === "shipinhao") ? "视频号" : (n.platform === "toutiao") ? "头条" : (n.platform === "xiaohongshu") ? "小红书" : "深圳商办"), "#深圳写字楼", "#探楼纪"]
    };
    if (window._inspirationStore && typeof window._inspirationStore.add === "function") {
      window._inspirationStore.add(card);
    } else {
      currentList.unshift(card);
      saveInspiration(currentList);
      render(currentList);
    }
    $$(".menu-item").forEach((m) => m.classList.remove("active"));
    const mi = $('.menu-item[data-key="inspiration"]');
    if (mi) mi.classList.add("active");
    switchPage("inspiration");
  }

  /* ============ 自媒体管理 ============ */
  function renderMedia() {
    const body = $("#mediaBody");
    const accounts = window.MEDIA_ACCOUNTS || [];
    const plan = window.PLATFORM_PLAN;
    body.innerHTML = `
      <div class="chart-block">
        <div class="chart-title">账号矩阵 · 资源分配</div>
        <div class="account-grid">` + accounts.map((a) => {
          const m = platformMeta(a.platform);
          return `<div class="account-card" style="--pc:${m.color}">
            <div class="ac-head">
              <span class="ac-name">${escapeHtml(a.name)}</span>
              <span class="ac-status ${a.bind ? "on" : "off"}">${escapeHtml(a.status)}</span>
            </div>
            <div class="ac-handle">${escapeHtml(a.handle)}</div>
            <div class="ac-stats">
              <span>粉丝 <b>${escapeHtml(a.fans)}</b></span>
              <span>作品 <b>${a.works}</b></span>
            </div>
            <div class="ac-role">${escapeHtml(a.role)}</div>
            <div class="ac-bar"><span style="width:${m.ratio}%;background:${m.color}"></span></div>
            <div class="ac-foot"><span class="pf-ratio">${m.ratio}%</span><span class="pf-prio prio-${m.priority}">${m.priority}</span>
              <a class="ac-link" href="${escapeHtml(a.url)}" target="_blank" rel="noopener">打开 ↗</a></div>
          </div>`;
        }).join("") + `</div>
        <div class="pf-summary">抖音 + 视频号为双主阵地，承担 ${plan.primary.reduce((s,k)=>s+(plan.items.find(x=>x.key===k)||{ratio:0}).ratio,0)}% 原创产能；头条 / 小红书二创分发，不占原创。</div>
      </div>`;
  }

  /* ============ 内容发布排期 ============ */
  /* ============ 创作发布中心（整合抖音创作者中心） ============ */
  const PUB_KEY = "gbad_publish_v1";
  const PUB_STATUS = { draft: "草稿", scheduled: "待发布", published: "已发布" };
  let pubTab = "draft";

  function loadPub() {
    try { return JSON.parse(localStorage.getItem(PUB_KEY) || "[]"); } catch { return []; }
  }
  function savePub(arr) { localStorage.setItem(PUB_KEY, JSON.stringify(arr)); }

  function composerTags() {
    return Array.from(document.querySelectorAll("#cTagsWrap .ctag")).map((e) => e.dataset.t);
  }
  function composerPlatforms() {
    return Array.from(document.querySelectorAll("#cPlatforms .seg-btn.active")).map((e) => e.dataset.v);
  }
  function getComposer() {
    return {
      title: $("#cTitle").value.trim(),
      body: $("#cBody").value.trim(),
      tags: composerTags(),
      platforms: composerPlatforms(),
      schedule: $("#cSchedule").checked ? ($("#cScheduleTime").value || "") : ""
    };
  }
  function publishCopyText(it) {
    const pf = (it.platforms || []).map((k) => (window.PLATFORM_PLAN.items.find((x) => x.key === k) || {}).name || k).join(" / ");
    return `【标题】${it.title}\n\n${it.body}\n\n【话题】${(it.tags || []).join(" ")}\n【平台】${pf}${it.schedule ? "\n【定时】" + it.schedule : ""}`;
  }

  function renderPublish() {
    const list = loadPub();
    $("#cntDraft").textContent = list.filter((x) => x.status === "draft").length;
    $("#cntScheduled").textContent = list.filter((x) => x.status === "scheduled").length;
    $("#cntPublished").textContent = list.filter((x) => x.status === "published").length;

    const items = list.filter((x) => x.status === pubTab);
    if (items.length === 0) {
      $("#pubList").innerHTML = `<div class="empty-tip">「${PUB_STATUS[pubTab]}」暂无内容。在上方发布器填写并保存。</div>`;
    } else {
      $("#pubList").innerHTML = items.map((it, i) => {
        const pf = (it.platforms || []).map((k) => {
          const m = platformMeta(k);
          return `<span class="pf-tag" style="--pc:${m.color}">${escapeHtml(m.name)}</span>`;
        }).join("");
        const tags = (it.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
        return `<div class="pub-item">
          <div class="pub-title">${escapeHtml(it.title || "(未命名)")}</div>
          <div class="pub-tags">${pf}${tags}</div>
          <div class="pub-body">${escapeHtml(it.body || "")}</div>
          <div class="pub-foot">
            <span class="pub-date">${escapeHtml(it.schedule ? "定时 " + it.schedule : "更新 " + (it.updatedAt || "").slice(0, 10))}</span>
            <span class="pub-ops">
              <button class="btn-mini" data-copy="${i}">复制文案</button>
              ${it.status !== "published" ? `<button class="btn-mini" data-move="${it.status}|published">标记已发布</button>` : ""}
              ${it.status === "draft" ? `<button class="btn-mini" data-move="draft|scheduled">转待发布</button>` : ""}
              <button class="btn-mini" data-del="${i}">删除</button>
            </span>
          </div>
        </div>`;
      }).join("");
    }

    /* 本周排期（参考） */
    const plan = window.PUBLISH_PLAN || [];
    $("#pubSchedule").innerHTML = plan.map((p) => {
      const m = platformMeta(p.primary);
      return `<div class="sch-row">
        <div class="sch-day"><b>${escapeHtml(p.day)}</b><span>${escapeHtml(p.date)}</span></div>
        <div class="sch-main">
          <div class="sch-topic">${escapeHtml(p.topic)}</div>
          <div class="sch-note">${escapeHtml(p.note)}</div>
        </div>
        <div class="sch-side">
          <span class="pf-tag" style="--pc:${m.color}">${escapeHtml(m.name)}</span>
          <span class="sch-status st-${p.status}">${escapeHtml(p.status)}</span>
        </div>
      </div>`;
    }).join("") + `<div class="pf-summary">排期以抖音 / 视频号原创为主（${plan.filter(p=>["douyin","shipinhao"].includes(p.primary)).length} 天），头条 / 小红书二创跟发（${plan.filter(p=>["toutiao","xiaohongshu"].includes(p.primary)).length} 天）。</div>`;
  }

  /* 发布器交互 */
  if ($("#cSchedule")) {
    $("#cSchedule").addEventListener("change", (e) => {
      $("#cScheduleTime").style.display = e.target.checked ? "inline-block" : "none";
    });
    $("#btnAddTag").addEventListener("click", () => {
      const v = $("#cTagInput").value.trim();
      if (!v) return;
      const tag = v.startsWith("#") ? v : "#" + v;
      if (document.querySelector(`#cTagsWrap .ctag[data-t="${CSS.escape(tag)}"]`)) { $("#cTagInput").value = ""; return; }
      const span = document.createElement("span");
      span.className = "ctag"; span.dataset.t = tag;
      span.innerHTML = `${escapeHtml(tag)} <button class="ctag-x" data-x="${escapeHtml(tag)}">×</button>`;
      $("#cTagsWrap").appendChild(span);
      $("#cTagInput").value = "";
    });
    $("#cTagsWrap").addEventListener("click", (e) => {
      const x = e.target.closest("[data-x]");
      if (x) x.closest(".ctag").remove();
    });
    $("#btnSaveDraft").addEventListener("click", () => {
      const c = getComposer();
      if (!c.title && !c.body) { alert("先填标题或正文再保存"); return; }
      const list = loadPub();
      list.unshift({ ...c, status: "draft", updatedAt: new Date().toISOString() });
      savePub(list);
      $("#cTitle").value = ""; $("#cBody").value = "";
      pubTab = "draft"; syncPubTabs();
      renderPublish();
    });
    $("#btnPublishNow").addEventListener("click", () => {
      const c = getComposer();
      if (!c.title && !c.body) { alert("先填标题或正文再发布"); return; }
      const list = loadPub();
      list.unshift({ ...c, status: "published", updatedAt: new Date().toISOString() });
      savePub(list);
      $("#cTitle").value = ""; $("#cBody").value = "";
      pubTab = "published"; syncPubTabs();
      renderPublish();
      window.open("https://creator.douyin.com/creator-micro/home", "_blank", "noopener");
    });
    $("#btnCopyPublish").addEventListener("click", () => {
      const c = getComposer();
      if (!c.title && !c.body) { alert("先填标题或正文再复制"); return; }
      copyText(publishCopyText(c));
      flashBtn($("#btnCopyPublish"), "已复制");
    });
    function syncPubTabs() {
      document.querySelectorAll("#pubTabs .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.v === pubTab));
    }
    $("#pubTabs").addEventListener("click", (e) => {
      const b = e.target.closest("[data-v]");
      if (!b) return;
      pubTab = b.dataset.v; syncPubTabs(); renderPublish();
    });
    $("#pubList").addEventListener("click", (e) => {
      const list = loadPub();
      const filtered = () => list.filter((x) => x.status === pubTab);
      const copyBtn = e.target.closest("[data-copy]");
      if (copyBtn) {
        const it = filtered()[Number(copyBtn.dataset.copy)];
        if (it) { copyText(publishCopyText(it)); flashBtn(copyBtn, "已复制"); }
        return;
      }
      const moveBtn = e.target.closest("[data-move]");
      if (moveBtn) {
        const [from, to] = moveBtn.dataset.move.split("|");
        const idx = list.findIndex((x) => x.status === from);
        if (idx >= 0) { list[idx].status = to; list[idx].updatedAt = new Date().toISOString(); savePub(list); renderPublish(); }
        return;
      }
      const delBtn = e.target.closest("[data-del]");
      if (delBtn) {
        const it = filtered()[Number(delBtn.dataset.del)];
        const gi = list.indexOf(it);
        if (gi >= 0) { list.splice(gi, 1); savePub(list); renderPublish(); }
      }
    });
  }

  /* ============ 爆款热点（一键改编为选题） ============ */
  function renderHot() {
    const body = $("#hotBody");
    const topics = pickRandom(window.HOT_TOPICS || [], Math.min(6, (window.HOT_TOPICS || []).length));
    body.innerHTML = `<div class="list-wrap">` + topics.map((t, i) => {
      const pf = t.platforms.map((k) => platformTag(k)).join("");
      return `<div class="hot-item" data-hot="${i}">
        <div class="hot-top">
          <div class="hot-title">${escapeHtml(t.title)}<span class="hot-arrow">▾</span></div>
          <div class="hot-heat"><span class="heat-bar" style="--w:${t.heat}%"></span><b>${t.heat}</b></div>
        </div>
        <div class="hot-foot">
          <span class="news-tag">${escapeHtml(t.source)}</span>
          ${pf}
          <button class="btn-mini" data-adapt="${i}">改编为本赛道选题</button>
        </div>
        <div class="hot-expand" hidden>
          <div class="hot-angle"><b>改编角度：</b>${escapeHtml(t.angle)}</div>
          <div class="hot-adapted"><b>改编样例：</b><br>${escapeHtml(t.adapted || "")}</div>
          ${t.url ? `<div class="hot-actions"><a class="btn-ghost btn-small" href="${escapeHtml(t.url)}" target="_blank" rel="noopener">原文链接 ↗</a></div>` : ""}
        </div>
      </div>`;
    }).join("") + `</div>`;
    body._hotCache = topics;
  }
  $("#btnRefreshHot").addEventListener("click", () => {
    const b = $("#btnRefreshHot");
    b.classList.add("spin");
    setTimeout(() => b.classList.remove("spin"), 700);
    renderHot();
  });
  $("#hotBody").addEventListener("click", (e) => {
    const b = e.target.closest("[data-adapt]");
    if (b) {
      const topics = $("#hotBody")._hotCache || [];
      const t = topics[Number(b.dataset.adapt)];
      if (t) adaptHotToInspiration(t);
      return;
    }
    const card = e.target.closest("[data-hot]");
    if (!card) return;
    if (e.target.closest(".hot-expand")) return;
    const exp = card.querySelector(".hot-expand");
    if (!exp) return;
    const open = !exp.hasAttribute("hidden");
    if (open) { exp.setAttribute("hidden", ""); }
    else { exp.removeAttribute("hidden"); }
    card.classList.toggle("open", !open);
  });

  function adaptHotToInspiration(t) {
    const card = {
      type: "deep",
      title: t.adapted,
      problem: t.title,
      pain: "打工人看数据只会焦虑，看不到背后的机会窗口。",
      hope: "把「" + t.title + "」翻译成普通人能用的选址 / 租办公室判断。",
      hook: t.angle,
      script:
        "兄弟们，今天探楼纪扒一个刚冒头的热点：" + t.title + "。\n\n" +
        t.angle + "。\n\n我给你拆成三句人话：第一，这事跟谁有关；第二，对你租办公室有什么影响；第三，现在该不该动。\n\n评论区扣城市，我下条专门拆你那片的真实行情。",
      tags: ["#" + t.source, "#深圳写字楼", "#深港楼市", "#探楼纪"]
    };
    addInspirationCard(card);
    $$(".menu-item").forEach((m) => m.classList.remove("active"));
    const mi = $('.menu-item[data-key="inspiration"]');
    if (mi) mi.classList.add("active");
    switchPage("inspiration");
    const wrapEl = $("#cardsWrap");
    if (wrapEl) wrapEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ============ 项目管理 ============ */
  const PROJECT_KEY = "gbad_projects_v1";
  function loadProjects() {
    try {
      const local = JSON.parse(localStorage.getItem(PROJECT_KEY) || "null");
      if (Array.isArray(local)) return local;
    } catch (_) {}
    return (window.PROJECTS || []).map((p) => ({ ...p, todos: (p.todos || []).slice(), seed: true }));
  }
  function saveProjects(arr) { localStorage.setItem(PROJECT_KEY, JSON.stringify(arr)); }

  function renderProjects() {
    const body = $("#projectBody");
    const list = loadProjects();
    body.innerHTML = `<div class="proj-grid">` + list.map((p, i) => {
      const todos = Array.isArray(p.todos) ? p.todos : [];
      const done = todos.filter(t => t.done).length;
      const todoHtml = todos.length
        ? `<div class="proj-todos">` + todos.map((t, ti) => `
            <label class="proj-todo" data-td="${i}-${ti}">
              <input type="checkbox" ${t.done ? "checked" : ""} />
              <span class="${t.done ? "done" : ""}">${escapeHtml(t.text)}</span>
              <button class="btn-mini todo-del" data-td-del="${i}-${ti}" type="button">×</button>
            </label>`).join("") + `</div>`
        : "";
      return `<div class="proj-card" data-proj="${i}">
        <div class="proj-head">
          <span class="proj-name">${escapeHtml(p.name)}</span>
          <span class="proj-stage st-${escapeHtml(p.stage)}">${escapeHtml(p.stage)}</span>
        </div>
        <div class="proj-note">${escapeHtml(p.note || "")}</div>
        <div class="proj-bar"><span style="width:${Number(p.progress)||0}%"></span></div>
        <div class="proj-foot">
          <span>进度 ${Number(p.progress)||0}%</span>
          ${platformTag(p.platform.includes("+") ? "douyin" : p.platform)}
          <span class="proj-due">截止 ${escapeHtml(p.due || "—")}</span>
        </div>
        <div class="proj-todos-head">
          <span class="proj-todo-title">待办 ${done}/${todos.length}</span>
          <button class="btn-mini" data-td-add="${i}" type="button">+ 待办</button>
        </div>
        ${todoHtml}
        <div class="proj-add-todo" hidden data-td-add-form="${i}">
          <input class="field-input" data-td-input="${i}" type="text" placeholder="待办内容（回车保存）" />
          <button class="btn-mini" data-td-cancel="${i}" type="button">收起</button>
        </div>
        <div class="proj-ops">
          <button class="btn-mini" data-proj-edit="${i}" type="button">编辑</button>
          <button class="btn-mini" data-proj-del="${i}" type="button">删除</button>
        </div>
      </div>`;
    }).join("") + `</div>`;
  }

  /* 项目面板开关 + 编辑/保存 */
  let _editingProj = -1;
  function openProjectEditor(p, idx) {
    _editingProj = idx;
    $("#pName").value = p?.name || "";
    $("#pStage").value = p?.stage || "构思";
    $("#pProgress").value = p?.progress ?? 0;
    $("#pPlatform").value = p?.platform || "douyin";
    $("#pDue").value = p?.due || "";
    $("#pNote").value = p?.note || "";
    $("#projectPanel").style.display = "block";
    $("#pName").focus();
  }
  $("#btnAddProject").addEventListener("click", () => openProjectEditor({}, -1));
  $("#btnCancelProject").addEventListener("click", () => {
    $("#projectPanel").style.display = "none";
    _editingProj = -1;
  });
  $("#btnSaveProject").addEventListener("click", () => {
    const name = $("#pName").value.trim();
    if (!name) { alert("请填写项目名称"); return; }
    const payload = {
      name,
      stage: $("#pStage").value,
      progress: Math.max(0, Math.min(100, Number($("#pProgress").value) || 0)),
      platform: $("#pPlatform").value,
      due: $("#pDue").value,
      note: $("#pNote").value.trim()
    };
    const list = loadProjects();
    if (_editingProj >= 0) {
      const old = list[_editingProj];
      list[_editingProj] = Object.assign({}, old, payload, { seed: old?.seed ?? true });
    } else {
      list.unshift(Object.assign({ todos: [] }, payload, { seed: false }));
    }
    saveProjects(list);
    $("#projectPanel").style.display = "none";
    _editingProj = -1;
    renderProjects();
  });

  /* 项目列表事件：编辑、删除、待办 */
  $("#projectBody").addEventListener("click", (e) => {
    /* 删除项目 */
    const delBtn = e.target.closest("[data-proj-del]");
    if (delBtn) {
      const i = Number(delBtn.dataset.projDel);
      if (!confirm("删除该项目？")) return;
      const list = loadProjects();
      list.splice(i, 1);
      saveProjects(list);
      renderProjects();
      return;
    }
    /* 编辑项目 */
    const editBtn = e.target.closest("[data-proj-edit]");
    if (editBtn) {
      const i = Number(editBtn.dataset.projEdit);
      const list = loadProjects();
      openProjectEditor(list[i], i);
      return;
    }
    /* 删除待办 */
    const tdDel = e.target.closest("[data-td-del]");
    if (tdDel) {
      const [i, ti] = tdDel.dataset.tdDel.split("-").map(Number);
      const list = loadProjects();
      if (!list[i] || !Array.isArray(list[i].todos)) return;
      list[i].todos.splice(ti, 1);
      saveProjects(list);
      renderProjects();
      return;
    }
    /* 展开添加待办表单 */
    const tdAdd = e.target.closest("[data-td-add]");
    if (tdAdd) {
      const i = Number(tdAdd.dataset.tdAdd);
      const card = $(`.proj-card[data-proj="${i}"]`);
      if (!card) return;
      card.querySelector(`[data-td-add-form="${i}"]`)?.removeAttribute("hidden");
      const input = card.querySelector(`[data-td-input="${i}"]`);
      if (input) input.focus();
      return;
    }
    const tdCancel = e.target.closest("[data-td-cancel]");
    if (tdCancel) {
      const i = Number(tdCancel.dataset.tdCancel);
      $(`.proj-card[data-proj="${i}"] [data-td-add-form="${i}"]`)?.setAttribute("hidden", "");
      return;
    }
  });
  /* 待办勾选 */
  $("#projectBody").addEventListener("change", (e) => {
    const label = e.target.closest("[data-td]");
    if (!label) return;
    const [i, ti] = label.dataset.td.split("-").map(Number);
    const list = loadProjects();
    if (!list[i] || !list[i].todos?.[ti]) return;
    list[i].todos[ti].done = e.target.checked;
    saveProjects(list);
    renderProjects();
  });
  /* 待办回车保存 */
  $("#projectBody").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const input = e.target.closest("[data-td-input]");
    if (!input) return;
    e.preventDefault();
    const i = Number(input.dataset.tdInput);
    const text = input.value.trim();
    if (!text) return;
    const list = loadProjects();
    if (!list[i]) return;
    if (!Array.isArray(list[i].todos)) list[i].todos = [];
    list[i].todos.push({ text, done: false });
    saveProjects(list);
    renderProjects();
  });

  /* ============ 数据统计 ============ */
  function renderStats() {
    const body = $("#statsBody");
    const rows = window.PLATFORM_STATS || [];
    const head = `<tr><th>平台</th><th>粉丝</th><th>作品</th><th>总播放</th><th>总互动</th><th>互动率</th><th>资源占比</th></tr>`;
    const trs = rows.map((r) => {
      const m = platformMeta(r.platform);
      return `<tr>
        <td class="col-title"><span class="pf-dot" style="background:${m.color}"></span>${escapeHtml(r.name)} <span class="pf-prio prio-${m.priority}">${m.priority}</span></td>
        <td class="num">${escapeHtml(r.fans)}</td>
        <td class="num">${r.works}</td>
        <td class="num">${escapeHtml(r.views)}</td>
        <td class="num">${escapeHtml(r.interact)}</td>
        <td class="num rate">${r.rate}</td>
        <td class="num">${escapeHtml(r.weight)}</td>
      </tr>`;
    }).join("");
    body.innerHTML = `
      <div class="chart-block">
        <div class="chart-title">四平台数据汇总</div>
        <div class="table-wrap"><table class="work-table"><thead>${head}</thead><tbody>${trs}</tbody></table></div>
        <div class="pf-summary">抖音 + 视频号贡献主要播放与互动；视频号互动率最高（社交转发），适合做私域沉淀。头条 / 小红书为长尾补充。</div>
      </div>`;
  }

  /* ============ 自我关怀 ============ */
  function renderCare() {
    const body = $("#careBody");
    const list = window.CARE_CHECKS || [];
    body.innerHTML = `<div class="care-grid">` + list.map((c) => `
      <div class="care-card">
        <div class="care-icon">${c.icon}</div>
        <div class="care-main">
          <div class="care-title">${escapeHtml(c.title)}</div>
          <div class="care-desc">${escapeHtml(c.desc)}</div>
        </div>
        <span class="care-status st-${c.status}">${escapeHtml(c.status)}</span>
      </div>`).join("") + `</div>`;
  }

  /* ============ 作业素材库 ============ */
  function renderLib() {
    const body = $("#libBody");

    /* ① 对标博主素材 */
    const bloggers = (window.BENCHMARK_BLOGGERS || []).map((b) => `
      <div class="bm-card">
        <div class="bm-head">
          <div class="bm-avatar">${escapeHtml(b.name.slice(0, 1))}</div>
          <div class="bm-meta">
            <div class="bm-name">${escapeHtml(b.name)} <span class="bm-handle">${escapeHtml(b.handle)}</span></div>
            <div class="bm-sub"><span class="pf-tag" style="--pc:#111418">抖音</span><span class="bm-fans">${escapeHtml(b.fans)} 粉丝</span></div>
          </div>
          <a class="bm-link" href="${escapeHtml(b.link)}" target="_blank" rel="noopener">主页 ↗</a>
        </div>
        <div class="bm-row"><span class="bm-k">风格</span><span class="bm-v">${escapeHtml(b.style)}</span></div>
        <div class="bm-row"><span class="bm-k">招牌</span><span class="bm-v">${escapeHtml(b.signature)}</span></div>
        <div class="bm-row bm-learn"><span class="bm-k">可学</span><span class="bm-v">${escapeHtml(b.learn)}</span></div>
      </div>`).join("");

    /* ② 我的收藏（选题灵感入素材库沉淀） */
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch (_) {}
    const mine = arr.length === 0
      ? `<div class="empty-tip">收藏为空。在「选题灵感」点「入素材库」即可沉淀过往选题与成品文案。</div>`
      : `<div class="list-wrap">` + arr.map((it) => `
        <div class="lib-item">
          <div class="lib-title">${escapeHtml(it.title || "(未命名)")}</div>
          <div class="lib-tags">${(it.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
          <div class="lib-date">收藏于 ${escapeHtml((it.archivedAt || "").slice(0, 10) || "—")}</div>
        </div>`).join("") + `</div>`;

    body.innerHTML = `
      <div class="chart-block">
        <div class="chart-title">对标抖音博主素材 · 参考学习</div>
        <div class="bm-grid">${bloggers}</div>
      </div>
      <div class="chart-block">
        <div class="chart-title">我的收藏 · 沉淀选题 / 成品文案</div>
        ${mine}
      </div>`;
  }

  /* ============ 作业素材库（对标博主 + 我的收藏）见 renderLib ============ */

  /* ============ 数据维护：账号真实数据（localStorage 覆盖种子） ============
   * 种子数据写死在 app-data.js，用户可在「数据维护」页改成自己的真实数据，
   * 存浏览器本地；启动时把覆盖合并进 window 全局，所有页面自动反映真实数据。
   */
  const ACCOUNT_OVERRIDE_KEY = "wb_account_overrides_v1";

  function escAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function loadAccountOverrides() {
    try { return JSON.parse(localStorage.getItem(ACCOUNT_OVERRIDE_KEY) || "null"); }
    catch (e) { return null; }
  }

  // 把覆盖模型写回 window 全局（MEDIA_ACCOUNTS / PLATFORM_STATS）
  function applyModelToGlobals(model) {
    if (!model) return;
    Object.keys(model).forEach(function (p) {
      const o = model[p] || {};
      const ma = (window.MEDIA_ACCOUNTS || []).find(function (a) { return a.platform === p; });
      if (ma) {
        if ("handle" in o) ma.handle = o.handle;
        if ("fans" in o) ma.fans = o.fans;
        if ("works" in o) ma.works = o.works;
        if ("status" in o) ma.status = o.status;
      }
      const st = (window.PLATFORM_STATS || []).find(function (a) { return a.platform === p; });
      if (st) {
        if ("fans" in o) st.fans = o.fans;
        if ("works" in o) st.works = o.works;
        if ("views" in o) st.views = o.views;
        if ("interact" in o) st.interact = o.interact;
        if ("rate" in o) st.rate = o.rate;
      }
    });
  }

  function applyAccountOverrides() {
    applyModelToGlobals(loadAccountOverrides());
  }

  function maintField(field, platform, val, label, placeholder) {
    return '<label class="maint-field"><span class="maint-field-label">' + escAttr(label) + '</span>' +
      '<input class="field-input" data-platform="' + escAttr(platform) + '" data-field="' + escAttr(field) +
      '" value="' + escAttr(val) + '" placeholder="' + escAttr(placeholder || "") + '" /></label>';
  }

  function renderMaintain() {
    const body = $("#maintainBody");
    if (!body) return;
    const accounts = window.MEDIA_ACCOUNTS || [];
    const stats = window.PLATFORM_STATS || [];
    const statMap = {};
    stats.forEach(function (s) { statMap[s.platform] = s; });

    let html = '<div class="maint-grid">';
    accounts.forEach(function (a) {
      const st = statMap[a.platform] || {};
      html += '<div class="maint-card">';
      html += '<div class="maint-card-head"><span class="maint-card-name">' + escAttr(a.name) + '</span>' +
        '<span class="maint-card-sub">' + escAttr(a.platform) + '</span></div>';
      html += '<div class="maint-card-sub2">账号信息</div>';
      html += maintField("handle", a.platform, a.handle, "账号名 / 昵称", "探楼纪");
      html += maintField("fans", a.platform, a.fans, "粉丝数（如 2095 或 2.1k）", "2095");
      html += maintField("works", a.platform, a.works, "作品数", "0");
      html += maintField("status", a.platform, a.status, "运营状态", "主运营");
      html += '<div class="maint-card-sub2">数据统计</div>';
      html += maintField("views", a.platform, st.views, "总播放", "0");
      html += maintField("interact", a.platform, st.interact, "总互动", "0");
      html += maintField("rate", a.platform, st.rate, "互动率", "0%");
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="maint-foot">' +
      '<span class="maint-foot-tip" id="maintainMsg"></span>' +
      '<button class="btn-ghost" id="btnResetMaintain" type="button">恢复种子默认值</button>' +
      '</div>';

    body.innerHTML = html;
    ensureMaintainInit();

    $("#btnResetMaintain").addEventListener("click", function () {
      if (!confirm("确定恢复为种子默认值？你在「数据维护」里填的真实数据会被清空（仅本机）。")) return;
      localStorage.removeItem(ACCOUNT_OVERRIDE_KEY);
      location.reload();
    });
  }

  // 头部按钮（保存/导出/导入）常驻不重建，只绑定一次
  let _maintainInit = false;
  function ensureMaintainInit() {
    if (_maintainInit) return;
    _maintainInit = true;

    $("#btnSaveMaintain").addEventListener("click", function () {
      const model = {};
      const mb = $("#maintainBody");
      if (mb) mb.querySelectorAll("input[data-platform]").forEach(function (inp) {
        const p = inp.dataset.platform, f = inp.dataset.field;
        (model[p] = model[p] || {})[f] = inp.value.trim();
      });
      try { localStorage.setItem(ACCOUNT_OVERRIDE_KEY, JSON.stringify(model)); } catch (e) {}
      applyModelToGlobals(model);
      renderHome(); renderMedia(); renderWorkTable(); renderStats(); renderAnalysis();
      const msg = $("#maintainMsg");
      if (msg) { msg.textContent = "✓ 已保存，数据已更新"; msg.classList.add("show"); }
    });

    $("#btnExportMaintain").addEventListener("click", function () {
      const model = loadAccountOverrides() || {};
      const blob = new Blob([JSON.stringify(model, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "探楼纪-账号数据.json"; a.click();
      URL.revokeObjectURL(url);
    });

    $("#btnImportMaintain").addEventListener("click", function () { $("#fileImportMaintain").click(); });
    $("#fileImportMaintain").addEventListener("change", function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = function () {
        try {
          const m = JSON.parse(r.result);
          localStorage.setItem(ACCOUNT_OVERRIDE_KEY, JSON.stringify(m));
          applyModelToGlobals(m);
          renderMaintain(); renderHome(); renderMedia(); renderWorkTable(); renderStats(); renderAnalysis();
          const msg = $("#maintainMsg");
          if (msg) { msg.textContent = "✓ 导入成功"; msg.classList.add("show"); }
        } catch (err) { alert("备份文件格式不对，无法导入"); }
      };
      r.readAsText(file);
      e.target.value = "";
    });
  }

  /* 首屏 */
  applyAccountOverrides();
  seedWorksIfEmpty();
  firstBatch();
  renderWorkTable();

  /* 深链接：#home / #media ... 直接定位页面 */
  function applyHash() {
    const key = (location.hash || "").replace("#", "");
    if (key && PAGE_MAP[key]) {
      $$(".menu-item").forEach((m) => m.classList.remove("active"));
      const mi = $(`.menu-item[data-key="${key}"]`);
      if (mi) mi.classList.add("active");
      switchPage(key);
    }
  }
  window.addEventListener("hashchange", applyHash);
  applyHash();

  /* ============ PWA：添加到主屏引导 + 更新提示 ============ */
  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
           window.navigator.standalone === true ||
           document.referrer.indexOf("android-app://") !== -1;
  }

  function initInstallTip() {
    try {
      // 已在主屏 App 内运行，或用户曾关闭过提示 → 不再显示
      if (isStandalone()) return;
      if (localStorage.getItem("wb_install_dismissed") === "1") return;
      var home = document.getElementById("page-home");
      var body = document.getElementById("homeBody");
      if (!home || !body) return;

      var tip = document.createElement("div");
      tip.className = "wb-install-tip";
      tip.innerHTML =
        '<div class="wb-install-tip__head">' +
          '<span class="wb-install-tip__title">📲 添加到手机主屏，像 App 一样随时打开</span>' +
          '<button class="wb-install-tip__close" aria-label="关闭">×</button>' +
        '</div>' +
        '<div class="wb-install-tip__body">' +
          '<div>把工作台放到主屏，以后点图标就能全屏打开，不再依赖浏览器书签。</div>' +
          '<ul class="wb-install-tip__steps">' +
            '<li><b>iPhone（Safari）</b>：点底部「分享」图标 → 选「添加到主屏幕」→ 点「添加」。</li>' +
            '<li><b>安卓 / Chrome</b>：点右上角「⋮」菜单 → 选「安装应用」或「添加到主屏幕」。</li>' +
          '</ul>' +
        '</div>' +
        '<span class="wb-install-tip__toggle">如何添加</span>';

      var bodyEl = tip.querySelector(".wb-install-tip__body");
      var toggle = tip.querySelector(".wb-install-tip__toggle");
      toggle.addEventListener("click", function () {
        var open = bodyEl.classList.toggle("open");
        toggle.textContent = open ? "收起" : "如何添加";
      });
      tip.querySelector(".wb-install-tip__close").addEventListener("click", function () {
        tip.remove();
        try { localStorage.setItem("wb_install_dismissed", "1"); } catch (e) {}
      });

      home.insertBefore(tip, body);
    } catch (e) {}
  }

  function showUpdateToast() {
    try {
      var old = document.querySelector(".wb-toast");
      if (old) old.remove();
      var t = document.createElement("div");
      t.className = "wb-toast";
      t.innerHTML =
        '<span class="wb-toast__msg">🔄 已更新到新版本</span>' +
        '<button class="wb-toast__btn">立即刷新</button>';
      document.body.appendChild(t);
      requestAnimationFrame(function () { t.classList.add("show"); });
      var done = false;
      function apply() { if (done) return; done = true; location.reload(); }
      t.querySelector(".wb-toast__btn").addEventListener("click", apply);
      // 兜底：8 秒后自动刷新，确保更新一定到位
      setTimeout(apply, 8000);
    } catch (e) {}
  }

  /* 注册 Service Worker（PWA 离线 + 添加到主屏全屏）。
   * 检测到新版本时弹出更新提示（可见、可控），不再静默自动刷新。 */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").then(function (reg) {
        if (!reg) return;
        initInstallTip();
        reg.addEventListener("updatefound", function () {
          var fresh = reg.installing;
          if (!fresh) return;
          fresh.addEventListener("statechange", function () {
            // 首次安装（无 controller）不提示；后续更新才提示
            if (fresh.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateToast();
            }
          });
        });
      }).catch(function () {});
    });
  }

  /* 暴露给调试用 */
  window.__workbench = {
    refreshBatch, firstBatch, currentList: () => currentList,
    loadWorks, saveWorks, renderWorkTable, renderAnalysis,
    renderCompareCards
  };
})();
