(function () {
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ── state ──
const state = {
  data: null,           // chapters.json
  page: 'home',         // 'home' | 'chapter' | 'fulldoc' | 'search'
  currentChapter: null,
  currentSection: null,
  currentFulldoc: null,
};

// ── DOM ──
const homePage        = $('#home-page');
const chapterPage     = $('#chapter-page');
const fulldocPage     = $('#fulldoc-page');
const searchPage      = $('#search-page');
const loading         = $('#loading');
const chapterGrid     = $('#chapter-grid');
const fullDocsGrid    = $('#full-docs-grid');
const backBtn         = $('#back-topbar');
const topbarTitle     = $('#topbar-title');
const searchInput     = $('#search-input');

// ── icons for full-docs ──
const FULLDOC_META = {
  '整理笔记':   { icon: '📝', desc: '全书各章节整理笔记' },
  '重点大题':   { icon: '⭐', desc: '历年重点论述题汇总' },
  '重点总结':   { icon: '🔑', desc: '核心知识点精炼总结' },
  '试卷及答案': { icon: '📋', desc: '历年试卷与参考答案' },
};

// ── page switching ──
function showPage(name) {
  homePage.style.display      = name === 'home'     ? 'block' : 'none';
  chapterPage.style.display   = name === 'chapter'  ? 'block' : 'none';
  fulldocPage.style.display   = name === 'fulldoc'  ? 'block' : 'none';
  searchPage.style.display    = name === 'search'   ? 'block' : 'none';
  backBtn.style.display       = name !== 'home'     ? 'inline-block' : 'none';
  topbarTitle.textContent     = name === 'home'     ? '🔬 组织学与胚胎学' : '';
  state.page = name;
  window.scrollTo(0, 0);
}

function goHome() {
  showPage('home');
  topbarTitle.textContent = '🔬 组织学与胚胎学';
  searchInput.value = '';
}

// ── render home ──
function renderHome() {
  if (!state.data) return;
  const { chapters, full_docs } = state.data;

  // chapter cards
  chapterGrid.innerHTML = '';
  chapters.forEach(ch => {
    const secs = Object.keys(ch.sections || {});
    const div = document.createElement('div');
    div.className = 'chapter-card';
    div.innerHTML = `
      <div class="ch-num">${ch.num}</div>
      <div class="ch-name">${ch.name.replace(/^第.+?章\s*/, '')}</div>
      <div class="ch-badges">
        ${secs.map(s => `<span class="ch-badge">${s}</span>`).join('')}
        ${secs.length === 0 ? '<span class="ch-badge" style="background:#f5f5f5;color:#aaa">仅大纲</span>' : ''}
      </div>
    `;
    div.onclick = () => openChapter(ch.id);
    chapterGrid.appendChild(div);
  });

  // full docs cards
  fullDocsGrid.innerHTML = '';
  Object.keys(full_docs).forEach(label => {
    const meta = FULLDOC_META[label] || { icon: '📄', desc: '' };
    const div = document.createElement('div');
    div.className = 'full-doc-card';
    div.innerHTML = `
      <div class="doc-icon">${meta.icon}</div>
      <div class="doc-info">
        <div class="doc-name">${label}</div>
        <div class="doc-desc">${meta.desc}</div>
      </div>
    `;
    div.onclick = () => openFullDoc(label);
    fullDocsGrid.appendChild(div);
  });
}

// ── open chapter ──
function openChapter(chId) {
  const ch = state.data.chapters.find(c => c.id === chId);
  if (!ch) return;
  state.currentChapter = ch;

  $('#ch-title').textContent = ch.name;
  const secs = Object.keys(ch.sections || {});
  $('#ch-subtitle').textContent = secs.length
    ? `共 ${secs.length} 个内容板块，点击标签切换`
    : '该章节暂无详细内容';

  // build tabs
  const tabsEl = $('#section-tabs');
  tabsEl.innerHTML = '';

  // 固定顺序
  const ORDER = ['学习大纲', '教学大纲', '考点汇总', '名词解释A', '名词解释B', '列表总结'];
  const allSecs = ORDER.filter(s => secs.includes(s));
  // 加上未在ORDER里的
  secs.forEach(s => { if (!ORDER.includes(s)) allSecs.push(s); });

  if (allSecs.length === 0) {
    tabsEl.innerHTML = '';
    $('#section-content').innerHTML = '<div class="no-content">该章节暂无详细内容，请查看"综合参考资料"</div>';
  } else {
    allSecs.forEach((sec, i) => {
      const btn = document.createElement('button');
      btn.className = 'sec-tab' + (i === 0 ? ' active' : '');
      btn.textContent = sec;
      btn.onclick = () => switchSection(sec, btn);
      tabsEl.appendChild(btn);
    });
    switchSection(allSecs[0], tabsEl.querySelector('.sec-tab'));
  }

  topbarTitle.textContent = ch.name;
  showPage('chapter');
  history.replaceState(null, '', '#' + chId);
}

function switchSection(secName, btn) {
  state.currentSection = secName;
  $$('#section-tabs .sec-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const html = state.currentChapter.sections[secName] || '';
  $('#section-content').innerHTML = html || '<div class="no-content">暂无内容</div>';
}

// ── open full doc ──
function openFullDoc(label) {
  state.currentFulldoc = label;
  $('#fulldoc-title').textContent = label;
  $('#fulldoc-content').innerHTML = state.data.full_docs[label] || '<p>暂无内容</p>';
  topbarTitle.textContent = label;
  showPage('fulldoc');
  history.replaceState(null, '', '#fulldoc-' + encodeURIComponent(label));
}

// ── search ──
let searchTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(doSearch, 300);
});

function doSearch() {
  const kw = searchInput.value.trim();
  if (!kw) { goHome(); return; }
  if (!state.data) return;

  const results = [];
  const kwLow = kw.toLowerCase();

  state.data.chapters.forEach(ch => {
    Object.entries(ch.sections || {}).forEach(([secName, html]) => {
      const text = html.replace(/<[^>]+>/g, '');
      if (text.toLowerCase().includes(kwLow)) {
        const idx = text.toLowerCase().indexOf(kwLow);
        const start = Math.max(0, idx - 40);
        const excerpt = text.substring(start, idx + 80).replace(/\n/g, ' ');
        const highlighted = excerpt.replace(
          new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
          m => `<mark>${m}</mark>`
        );
        results.push({
          title: `${ch.name} · ${secName}`,
          excerpt: '...' + highlighted + '...',
          action: () => { openChapter(ch.id); setTimeout(() => {
            const btn = Array.from($$('#section-tabs .sec-tab')).find(b => b.textContent === secName);
            if (btn) switchSection(secName, btn);
          }, 100); }
        });
      }
    });
  });

  Object.entries(state.data.full_docs || {}).forEach(([label, html]) => {
    const text = html.replace(/<[^>]+>/g, '');
    if (text.toLowerCase().includes(kwLow)) {
      const idx = text.toLowerCase().indexOf(kwLow);
      const start = Math.max(0, idx - 40);
      const excerpt = text.substring(start, idx + 80).replace(/\n/g, ' ');
      const highlighted = excerpt.replace(
        new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
        m => `<mark>${m}</mark>`
      );
      results.push({
        title: `综合资料 · ${label}`,
        excerpt: '...' + highlighted + '...',
        action: () => openFullDoc(label),
      });
    }
  });

  $('#search-title').textContent = `"${kw}" 的搜索结果（${results.length} 条）`;
  const list = $('#search-results-list');
  list.innerHTML = '';
  if (results.length === 0) {
    list.innerHTML = '<div class="empty-tip">没有找到相关内容</div>';
  } else {
    results.slice(0, 30).forEach(r => {
      const div = document.createElement('div');
      div.className = 'search-result-item';
      div.innerHTML = `<div class="sri-title">${r.title}</div><div class="sri-excerpt">${r.excerpt}</div>`;
      div.onclick = r.action;
      list.appendChild(div);
    });
  }

  showPage('search');
  topbarTitle.textContent = '搜索结果';
}

// ── init ──
function init() {
  loading.style.display = 'block';
  homePage.style.display = 'none';

  fetch('data/chapters.json')
    .then(r => r.json())
    .then(data => {
      state.data = data;
      loading.style.display = 'none';
      renderHome();
      showPage('home');

      // handle hash
      const hash = location.hash.slice(1);
      if (hash && hash.startsWith('ch')) {
        openChapter(hash);
      } else if (hash && hash.startsWith('fulldoc-')) {
        openFullDoc(decodeURIComponent(hash.slice(8)));
      }
    })
    .catch(err => {
      loading.style.display = 'none';
      homePage.style.display = 'block';
      homePage.innerHTML = `<div class="empty-tip">数据加载失败: ${err.message}</div>`;
    });
}

init();

})();
