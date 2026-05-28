(function(){
'use strict';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const state = {
  data: null,
  activeTab: null,
  searchIdx: null,
  searchDocs: [],
  darkMode: false,
  selfTestMode: false,
  highlighted: {},           // { tabId: Set of term texts }
};

/* ─── DOM refs ─── */
const sidebar          = $('#sidebar');
const sidebarNav       = $('#sidebar-nav');
const welcome          = $('#welcome');
const welcomeGrid      = $('#welcome-grid');
const tabContent       = $('#tab-content');
const tabTitle         = $('#tab-title');
const chapterNav       = $('#chapter-nav');
const letterIndex      = $('#letter-index');
const chapterContent   = $('#chapter-content');
const searchResults    = $('#search-results');
const searchResultsList= $('#search-results-list');
const searchQuery      = $('#search-query');
const searchBackBtn    = $('#search-back-btn');
const overlay          = $('#sidebar-overlay');
const sidebarSearch    = $('#sidebar-search');
const topbarSearch     = $('#topbar-search');
const loadingOverlay   = $('#loading-overlay');
const breadcrumb       = $('#breadcrumb');
const breadcrumbSection= $('#breadcrumb-section');
const selfTestToggle   = $('#self-test-toggle');
const highlightTooltip = $('#highlight-tooltip');

/* ─── Dark Mode ─── */
function toggleDark() {
  state.darkMode = !state.darkMode;
  document.body.classList.toggle('dark', state.darkMode);
  $('#dark-toggle').textContent = state.darkMode ? '☀️ 亮色模式' : '🌙 暗色模式';
  localStorage.setItem('embryo-dark', state.darkMode ? '1' : '0');
}

/* ─── Loading ─── */
function showLoading() {
  loadingOverlay.classList.add('show');
}
function hideLoading() {
  loadingOverlay.classList.remove('show');
}

/* ─── Navigation ─── */
function goHome() {
  state.activeTab = null;
  welcome.style.display = 'block';
  tabContent.style.display = 'none';
  searchResults.style.display = 'none';
  breadcrumb.style.display = 'none';
  $$('#sidebar-nav a').forEach(a => a.classList.remove('active'));
  history.replaceState(null, '', '#');
  closeSidebar();
}

function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
}

/* ─── Breadcrumb ─── */
function updateBreadcrumb(sectionLabel) {
  breadcrumb.style.display = 'flex';
  breadcrumbSection.textContent = sectionLabel;
}

/* ─── Self-Test Mode ─── */
function toggleSelfTest() {
  state.selfTestMode = !state.selfTestMode;
  chapterContent.classList.toggle('self-test-mode', state.selfTestMode);
  selfTestToggle.classList.toggle('active', state.selfTestMode);
  selfTestToggle.innerHTML = state.selfTestMode ? '🎓 自测中' : '🎓 自测模式';
  localStorage.setItem('embryo-selftest', state.selfTestMode ? '1' : '0');
}

/* ─── Letter Index ─── */
function buildLetterIndex(html) {
  const text = html.replace(/<[^>]+>/g, '');
  const terms = text.match(/[A-Z\u4e00-\u9fff\u3400-\u4dbf][A-Za-z\u4e00-\u9fff\u3400-\u4dbf\s\-]+(?=：|:)/g) || [];
  const letters = new Set();
  for (const t of terms) {
    const first = t.trim()[0];
    if (first) letters.add(first.toUpperCase());
  }
  const sorted = [...letters].sort();
  if (sorted.length < 5) { letterIndex.classList.remove('show'); return; }

  letterIndex.classList.add('show');
  letterIndex.innerHTML = sorted.map(ch =>
    `<span class="letter-link" data-letter="${ch}">${ch}</span>`
  ).join('');

  $$('#letter-index .letter-link').forEach(link => {
    link.addEventListener('click', () => {
      const letter = link.dataset.letter;
      const defs = chapterContent.querySelectorAll('.definition');
      for (const d of defs) {
        const term = d.querySelector('.term');
        if (!term) continue;
        const first = term.textContent.trim()[0];
        if (first && first.toUpperCase() === letter) {
          d.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
      }
    });
  });
}

/* ─── Chapter Nav ─── */
function buildChapterNav(section) {
  let navHtml = '';
  if (section.chapter_titles && section.chapter_titles.length > 1) {
    section.chapter_titles.forEach((title, i) => {
      const short = title.length > 18 ? title.substring(0, 16) + '…' : title;
      navHtml += `<span class="chapter-link" data-title="${encodeURIComponent(title)}">${short}</span>`;
    });
  }
  chapterNav.innerHTML = navHtml;
  $$('#chapter-nav .chapter-link').forEach(link => {
    link.addEventListener('click', () => {
      const title = decodeURIComponent(link.dataset.title);
      const headings = chapterContent.querySelectorAll('h3.chapter-title');
      for (const h of headings) {
        if (h.textContent.trim() === title) {
          h.scrollIntoView({ behavior: 'smooth', block: 'start' });
          $$('#chapter-nav .chapter-link').forEach(l => l.classList.remove('active'));
          link.classList.add('active');
          break;
        }
      }
    });
  });
}

/* ─── HighLight ─── */
function loadHighlights() {
  try {
    const raw = localStorage.getItem('embryo-highlights');
    if (raw) state.highlighted = JSON.parse(raw);
    else state.highlighted = {};
  } catch(e) { state.highlighted = {}; }
}
function saveHighlights() {
  localStorage.setItem('embryo-highlights', JSON.stringify(state.highlighted));
}
function applyHighlights() {
  if (!state.activeTab) return;
  const tabHl = state.highlighted[state.activeTab];
  if (!tabHl || tabHl.length === 0) return;

  const terms = chapterContent.querySelectorAll('.term');
  for (const term of terms) {
    const text = term.textContent.trim();
    if (tabHl.includes(text)) {
      term.classList.add('highlighted');
    }
  }
}
function highlightTerm(termEl) {
  const text = termEl.textContent.trim();
  if (!state.highlighted[state.activeTab]) state.highlighted[state.activeTab] = [];
  const arr = state.highlighted[state.activeTab];
  if (!arr.includes(text)) arr.push(text);
  termEl.classList.add('highlighted');
  saveHighlights();
}
function unhighlightTerm(termEl) {
  const text = termEl.textContent.trim();
  if (!state.highlighted[state.activeTab]) return;
  const arr = state.highlighted[state.activeTab];
  const idx = arr.indexOf(text);
  if (idx !== -1) arr.splice(idx, 1);
  termEl.classList.remove('highlighted');
  saveHighlights();
}

/* ─── Load Tab ─── */
function loadTab(tabId) {
  const section = state.data[tabId];
  if (!section) return;

  state.activeTab = tabId;
  welcome.style.display = 'none';
  searchResults.style.display = 'none';

  updateBreadcrumb(section.display_title);
  tabTitle.textContent = section.display_title;

  showLoading();

  setTimeout(() => {
    tabContent.style.display = 'block';
    if (section.html) {
      chapterContent.innerHTML = section.html;

      // Wrap definition text for self-test blur
      const defs = chapterContent.querySelectorAll('.definition');
      defs.forEach(def => {
        if (def.querySelector('.definition-text')) return;
        const term = def.querySelector('.term');
        if (!term) return;
        const nodes = [];
        let afterTerm = false;
        for (const node of def.childNodes) {
          if (node === term || (node.nodeType === 3 && node.textContent.includes(term.textContent))) {
            afterTerm = true;
            nodes.push(node);
            continue;
          }
          if (afterTerm) nodes.push(node);
        }
        if (nodes.length > 0) {
          const wrapper = document.createElement('span');
          wrapper.className = 'definition-text';
          nodes.forEach(n => wrapper.appendChild(n));
          def.appendChild(wrapper);
          term.style.cursor = 'pointer';
        }
      });

      if (state.selfTestMode) {
        chapterContent.classList.add('self-test-mode');
      } else {
        chapterContent.classList.remove('self-test-mode');
      }
    } else {
      chapterContent.innerHTML = '<p style="color:var(--text-secondary);padding:20px 0;">该部分暂无内容。</p>';
    }

    buildLetterIndex(section.html || '');
    buildChapterNav(section);
    applyHighlights();
    bindContentInteractions();
    chapterContent.classList.add('content-fade');
    setTimeout(() => chapterContent.classList.remove('content-fade'), 300);
    hideLoading();
    $('#content').scrollTop = 0;
  }, 80);

  $$('#sidebar-nav a').forEach(a => a.classList.remove('active'));
  const activeLink = $(`#sidebar-nav a[data-tab="${tabId}"]`);
  if (activeLink) activeLink.classList.add('active');
  history.replaceState(null, '', '#' + tabId);
  closeSidebar();
}

/* ─── Content Interactions (highlight, self-test reveals) ─── */
function bindContentInteractions() {
  const terms = chapterContent.querySelectorAll('.definition .term');
  terms.forEach(term => {
    term.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = term.getBoundingClientRect();
      highlightTooltip.style.top = (rect.bottom + 6 + window.scrollY) + 'px';
      highlightTooltip.style.left = (rect.left + window.scrollX) + 'px';
      highlightTooltip.classList.add('show');
      highlightTooltip.dataset.termEl = '';

      (function bindTooltip(el) {
        $('#hl-add').onclick = () => {
          highlightTerm(el);
          highlightTooltip.classList.remove('show');
        };
        $('#hl-remove').onclick = () => {
          unhighlightTerm(el);
          highlightTooltip.classList.remove('show');
        };
      })(term);
    });
  });

  document.addEventListener('click', (e) => {
    if (!highlightTooltip.contains(e.target) && !e.target.closest('.definition .term')) {
      highlightTooltip.classList.remove('show');
    }
  }, { once: true });

  document.addEventListener('click', function closeTT(e) {
    if (!highlightTooltip.contains(e.target) && !e.target.closest('.definition .term')) {
      highlightTooltip.classList.remove('show');
    }
  });
}

/* ─── FlexSearch ─── */
let flexIdx = null;
let flexMap = [];   // [ { tabId, sectionLabel, text } ]

function buildSearchIndex() {
  if (typeof FlexSearch === 'undefined') return false;
  flexIdx = new FlexSearch.Document({
    document: {
      id: 'id',
      index: ['text'],
      store: ['tabId', 'sectionLabel'],
    },
    tokenize: 'forward',
    charset: 'latin:extra',
    encode: false,
  });

  flexMap = [];
  let id = 0;
  for (const [tabId, section] of Object.entries(state.data)) {
    const text = section.html.replace(/<[^>]+>/g, '');
    flexIdx.add({ id, tabId, sectionLabel: section.display_title, text });
    flexMap.push({ id, tabId, sectionLabel: section.display_title, text });
    id++;
  }
  return true;
}

function performSearch(query) {
  if (!query || query.trim().length < 1) return;
  query = query.trim();

  welcome.style.display = 'none';
  tabContent.style.display = 'none';
  breadcrumb.style.display = 'none';
  searchResults.style.display = 'block';
  searchQuery.textContent = query;

  let results;

  if (flexIdx) {
    const raw = flexIdx.search(query, { enrich: true, limit: 50 });
    if (!raw || raw.length === 0 || !raw[0].result || raw[0].result.length === 0) {
      results = [];
    } else {
      results = raw[0].result.map(r => ({
        id: r.id,
        tabId: r.doc.tabId,
        sectionLabel: r.doc.sectionLabel,
      }));
    }
  } else {
    results = basicSearch(query);
  }

  if (results.length === 0) {
    searchResultsList.innerHTML = '<p style="color:var(--text-secondary);padding:20px 0;">未找到相关内容，请尝试其他关键词。</p>';
    return;
  }

  searchResultsList.innerHTML = results.map(r => {
    const doc = flexMap.find(d => d.id === r.id);
    const text = doc ? doc.text : '';
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    let snippet = '';
    if (idx !== -1) {
      let s = Math.max(0, idx - 60);
      let e = Math.min(text.length, idx + query.length + 100);
      snippet = text.substring(s, e);
      if (s > 0) snippet = '…' + snippet;
      if (e < text.length) snippet += '…';
    }
    const escQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    snippet = snippet.replace(new RegExp(escQ, 'gi'), '<em>$&</em>');

    return `
      <div class="search-result-item" data-tab="${r.tabId}">
        <div class="result-source">${r.sectionLabel}</div>
        <div class="result-text">${snippet}</div>
      </div>
    `;
  }).join('');

  $$('.search-result-item').forEach(item => {
    item.addEventListener('click', () => loadTab(item.dataset.tab));
  });
}

function basicSearch(query) {
  const q = query.toLowerCase();
  const results = [];
  for (const [tabId, section] of Object.entries(state.data)) {
    const text = section.html ? section.html.replace(/<[^>]+>/g, '') : '';
    if (!text.toLowerCase().includes(q)) continue;
    results.push({ tabId, sectionLabel: section.display_title });
    if (results.length >= 50) break;
  }
  flexMap = results.map((r, i) => ({
    id: i, tabId: r.tabId, sectionLabel: r.sectionLabel,
    text: state.data[r.tabId].html.replace(/<[^>]+>/g, ''),
  }));
  return results;
}

/* ─── Init ─── */
async function init() {
  if (localStorage.getItem('embryo-dark') === '1') toggleDark();
  loadHighlights();
  if (localStorage.getItem('embryo-selftest') === '1') {
    state.selfTestMode = true;
    selfTestToggle.classList.add('active');
    selfTestToggle.innerHTML = '🎓 自测中';
  }

  try {
    showLoading();
    const resp = await fetch('data/content.json');
    state.data = await resp.json();
    hideLoading();
  } catch (e) {
    welcome.innerHTML = '<h2>⚠️ 数据加载失败</h2><p>请刷新页面重试。若问题持续，请确认 data/content.json 文件存在。</p>';
    console.error('Failed to load content.json', e);
    return;
  }

  const hasFlex = buildSearchIndex();
  console.log(hasFlex ? 'FlexSearch ready' : 'FlexSearch unavailable, falling back to basic search');

  // Sidebar nav
  const navOrder = [
    'study_outline','syllabus','keypoints','terminology_a','terminology_b',
    'summary_lists','notes','key_summaries','essay_questions','exam','question_bank'
  ];
  let navHtml = '';
  for (const tabId of navOrder) {
    const s = state.data[tabId];
    if (!s) continue;
    navHtml += `<a data-tab="${tabId}">${s.icon} ${s.label}</a>`;
  }
  sidebarNav.innerHTML = navHtml;
  $$('#sidebar-nav a').forEach(link => {
    link.addEventListener('click', () => loadTab(link.dataset.tab));
  });

  // Welcome grid
  let gridHtml = '';
  for (const tabId of navOrder) {
    const s = state.data[tabId];
    if (!s) continue;
    const chars = s.total_chars || 0;
    const countStr = chars > 0 ? `<span class="count">${(chars/1000).toFixed(1)}k字</span>` : '';
    gridHtml += `
      <div class="welcome-card" data-tab="${tabId}">
        <span class="icon">${s.icon}</span>
        <span class="label">${s.label}</span>
        ${countStr}
      </div>`;
  }
  welcomeGrid.innerHTML = gridHtml;
  $$('.welcome-card').forEach(card => {
    card.addEventListener('click', () => loadTab(card.dataset.tab));
  });

  // Dark mode toggle
  $('#dark-toggle').addEventListener('click', toggleDark);

  // Self-test toggle
  selfTestToggle.classList.add('show');
  selfTestToggle.addEventListener('click', toggleSelfTest);

  // Mobile sidebar
  $('#sidebar-toggle').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });
  $('#sidebar-close').addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);

  // Search
  function doSearch(val) { if (val.trim()) performSearch(val); }
  sidebarSearch.addEventListener('keydown', e => { if (e.key==='Enter') doSearch(e.target.value); });
  topbarSearch.addEventListener('keydown', e => { if (e.key==='Enter') doSearch(e.target.value); });

  // Back buttons
  $('#back-btn').addEventListener('click', goHome);
  searchBackBtn.addEventListener('click', goHome);
  $('#breadcrumb-home').addEventListener('click', goHome);

  // Self-test click-to-reveal handler
  chapterContent.addEventListener('click', (e) => {
    if (!state.selfTestMode) return;
    const defText = e.target.closest('.definition .definition-text') || e.target.closest('.definition');
    if (!defText) return;
    if (e.target.closest('.term') && highlightTooltip.classList.contains('show')) return;
    const target = defText.classList.contains('definition-text') ? defText : defText.querySelector('.definition-text');
    if (target) target.classList.add('revealed');
  });

  // Hash routing
  if (window.location.hash && window.location.hash.length > 1) {
    const tabId = window.location.hash.substring(1);
    if (state.data[tabId]) loadTab(tabId);
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (state.activeTab || searchResults.style.display !== 'none') goHome();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      (window.innerWidth <= 768 ? topbarSearch : sidebarSearch).focus();
    }
  });

  $('#breadcrumb-home').addEventListener('click', goHome);
}

init();

})();