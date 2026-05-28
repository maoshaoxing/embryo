// === App State ===
const state = {
  data: null,
  activeTab: null,
  darkMode: false,
};

// === DOM Elements ===
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const sidebar = $('#sidebar');
const sidebarNav = $('#sidebar-nav');
const welcome = $('#welcome');
const tabContent = $('#tab-content');
const tabTitle = $('#tab-title');
const chapterNav = $('#chapter-nav');
const chapterContent = $('#chapter-content');
const searchResults = $('#search-results');
const searchResultsList = $('#search-results-list');
const searchQuery = $('#search-query');
const searchBackBtn = $('#search-back-btn');
const overlay = $('#sidebar-overlay');
const sidebarSearchInput = $('#sidebar-search');
const topbarSearchInput = $('#topbar-search');

function toggleDark() {
  state.darkMode = !state.darkMode;
  document.body.classList.toggle('dark', state.darkMode);
  $('#dark-toggle').textContent = state.darkMode ? '☀️ 亮色模式' : '🌙 暗色模式';
  localStorage.setItem('embryo-dark', state.darkMode ? '1' : '0');
}

function goHome() {
  state.activeTab = null;
  welcome.style.display = 'block';
  tabContent.style.display = 'none';
  searchResults.style.display = 'none';
  $$('#sidebar-nav a').forEach(a => a.classList.remove('active'));
  history.replaceState(null, '', '#');
}

function loadTab(tabId) {
  const section = state.data[tabId];
  if (!section) return;

  state.activeTab = tabId;
  welcome.style.display = 'none';
  searchResults.style.display = 'none';
  tabContent.style.display = 'block';

  tabTitle.textContent = section.display_title;

  // Build chapter nav from detected chapter titles
  let navHtml = '';
  if (section.chapter_titles && section.chapter_titles.length > 1) {
    section.chapter_titles.forEach((title, i) => {
      const shortTitle = title.length > 18 ? title.substring(0, 16) + '…' : title;
      navHtml += `<span class="chapter-link" data-chapter="${i}" data-title="${encodeURIComponent(title)}">${shortTitle}</span>`;
    });
  }
  chapterNav.innerHTML = navHtml;

  // Bind chapter nav clicks → scroll to heading in the content
  $$('#chapter-nav .chapter-link').forEach(link => {
    link.addEventListener('click', () => {
      const title = decodeURIComponent(link.dataset.title);
      // Find the h3 with this title text in the content
      const headings = chapterContent.querySelectorAll('h3.chapter-title');
      for (const h of headings) {
        if (h.textContent.trim() === title) {
          h.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Highlight active chapter
          $$('#chapter-nav .chapter-link').forEach(l => l.classList.remove('active'));
          link.classList.add('active');
          break;
        }
      }
    });
  });

  // Render content
  if (section.html) {
    chapterContent.innerHTML = section.html;
  } else {
    chapterContent.innerHTML = '<p style="color:var(--text-secondary);padding:20px 0;">该部分暂无内容。</p>';
  }

  // Scroll to top of content
  $('#content').scrollTop = 0;
  window.scrollTo(0, 0);

  // Update sidebar active
  $$('#sidebar-nav a').forEach(a => a.classList.remove('active'));
  const activeLink = $(`#sidebar-nav a[data-tab="${tabId}"]`);
  if (activeLink) activeLink.classList.add('active');

  // Update URL hash
  history.replaceState(null, '', '#' + tabId);

  // Close mobile sidebar
  closeSidebar();
}

function performSearch(query) {
  if (!query || query.trim().length < 1) return;

  query = query.trim().toLowerCase();

  welcome.style.display = 'none';
  tabContent.style.display = 'none';
  searchResults.style.display = 'block';
  searchQuery.textContent = query;

  const results = [];
  for (const [tabId, section] of Object.entries(state.data)) {
    // Search in the clean text (strip HTML tags)
    const cleanText = section.html ? section.html.replace(/<[^>]+>/g, '') : '';
    const idx = cleanText.toLowerCase().indexOf(query);
    if (idx === -1) continue;

    // Extract context around the match
    let start = Math.max(0, idx - 80);
    let end = Math.min(cleanText.length, idx + query.length + 120);
    let snippet = cleanText.substring(start, end);
    if (start > 0) snippet = '…' + snippet;
    if (end < cleanText.length) snippet += '…';

    // Highlight query
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    snippet = snippet.replace(new RegExp(escapedQuery, 'gi'), '<em>$&</em>');

    results.push({
      tabId,
      sectionLabel: section.display_title,
      snippet,
    });
    if (results.length >= 50) break;
  }

  if (results.length === 0) {
    searchResultsList.innerHTML = '<p style="color:var(--text-secondary);padding:20px 0;">未找到相关内容，请尝试其他关键词。</p>';
  } else {
    searchResultsList.innerHTML = results.map(r => `
      <div class="search-result-item" data-tab="${r.tabId}">
        <div class="result-source">${r.sectionLabel}</div>
        <div class="result-text">${r.snippet}</div>
      </div>
    `).join('');

    $$('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        loadTab(item.dataset.tab);
      });
    });
  }
}

function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
}

// === Initialize ===
async function init() {
  // Dark mode
  if (localStorage.getItem('embryo-dark') === '1') toggleDark();

  // Load data
  try {
    const resp = await fetch('data/content.json');
    state.data = await resp.json();
  } catch (e) {
    welcome.innerHTML = '<h2>⚠️ 数据加载失败</h2><p>请刷新页面重试。若问题持续，请确认 data/content.json 文件存在。</p>';
    console.error('Failed to load content.json', e);
    return;
  }

  // Build sidebar nav
  const navOrder = [
    'study_outline', 'syllabus', 'keypoints', 'terminology_a', 'terminology_b',
    'summary_lists', 'notes', 'key_summaries', 'essay_questions', 'exam', 'question_bank'
  ];

  let navHtml = '';
  for (const tabId of navOrder) {
    const s = state.data[tabId];
    if (!s) continue;
    navHtml += `<a data-tab="${tabId}">${s.icon} ${s.label}</a>`;
  }
  sidebarNav.innerHTML = navHtml;

  // Bind nav clicks
  $$('#sidebar-nav a').forEach(link => {
    link.addEventListener('click', () => loadTab(link.dataset.tab));
  });

  // Dark mode toggle
  $('#dark-toggle').addEventListener('click', toggleDark);

  // Mobile sidebar toggle
  $('#sidebar-toggle').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });
  $('#sidebar-close').addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);

  // Search handlers
  function doSearch(val) {
    if (val.trim()) performSearch(val);
  }
  sidebarSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch(e.target.value);
  });
  topbarSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch(e.target.value);
  });

  // Back buttons
  $('#back-btn').addEventListener('click', goHome);
  searchBackBtn.addEventListener('click', goHome);

  // Welcome card clicks
  $$('.welcome-card').forEach(card => {
    card.addEventListener('click', () => loadTab(card.dataset.tab));
  });

  // Handle URL hash for direct linking
  if (window.location.hash && window.location.hash.length > 1) {
    const tabId = window.location.hash.substring(1);
    if (state.data[tabId]) {
      loadTab(tabId);
    }
  }

  // Handle keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape to go home
    if (e.key === 'Escape' && (state.activeTab || !welcome.style.display || searchResults.style.display !== 'none')) {
      goHome();
    }
    // Ctrl+K or / to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (window.innerWidth <= 768) {
        topbarSearchInput.focus();
      } else {
        sidebarSearchInput.focus();
      }
    }
  });
}

init();