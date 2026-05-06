function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function timeAgo(dateString) {
  const now = new Date();
  const past = new Date(dateString);
  const diffInMs = now - past;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${diffInDays}d ago`;
}

export function createNewsToolModal() {
  let newsState = {
    lang: 'hi', // 'hi' or 'bn'
    topic: 'business', // 'business' or 'politics'
    items: [],
    loading: false,
    error: null,
    lastUpdated: null,
  };

  async function fetchNews(lang = newsState.lang, topic = newsState.topic) {
    newsState.loading = true;
    newsState.error = null;
    newsState.lang = lang;
    newsState.topic = topic;

    try {
      const response = await fetch(`/api/tools/news?lang=${lang}&topic=${topic}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch news');
      }

      newsState.items = result.data;
      newsState.lastUpdated = result.timestamp;
    } catch (error) {
      newsState.error = error.message;
      console.error('News fetch error:', error);
    } finally {
      newsState.loading = false;
    }
  }

  function renderNewsItems() {
    if (newsState.loading) {
      return `
        <div class="flex flex-col gap-4 animate-pulse">
          ${Array.from({ length: 5 }).map(() => `
            <div class="h-24 bg-slate-100 rounded-2xl w-full"></div>
          `).join('')}
        </div>
      `;
    }

    if (newsState.error) {
      return `
        <div class="bg-red-50 border-2 border-red-100 rounded-2xl p-8 text-center">
          <p class="text-red-600 font-bold mb-2">Failed to load news</p>
          <p class="text-xs text-red-500">${escapeHtml(newsState.error)}</p>
          <button type="button" class="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold js-retry-news">Retry</button>
        </div>
      `;
    }

    if (newsState.items.length === 0) {
      return `
        <div class="py-12 text-center text-slate-400">
          <p class="font-bold">No news articles found for today.</p>
        </div>
      `;
    }

    return `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${newsState.items.map((item, idx) => `
          <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" 
             class="group block bg-white border-2 border-slate-100 hover:border-indigo-200 hover:shadow-md rounded-2xl overflow-hidden transition-all duration-300">
            <div class="flex flex-col h-full">
              ${item.imageUrl ? `
                <div class="relative h-40 overflow-hidden bg-slate-100">
                  <img src="${escapeHtml(item.imageUrl)}" alt="" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
                  <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                </div>
              ` : ''}
              <div class="p-4 flex flex-col flex-1 gap-2">
                <div class="flex items-center justify-between gap-3">
                  <span class="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded tracking-wider">
                    ${escapeHtml(item.source)}
                  </span>
                  <span class="text-[10px] font-bold text-slate-400">
                    ${timeAgo(item.pubDate)}
                  </span>
                </div>
                <h3 class="text-sm font-bold text-slate-900 group-hover:text-indigo-600 leading-snug line-clamp-2">
                  ${escapeHtml(item.title)}
                </h3>
                <div class="mt-auto pt-2 flex items-center gap-1 text-[10px] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  Read Article <span>→</span>
                </div>
              </div>
            </div>
          </a>
        `).join('')}
      </div>
    `;
  }

  function updateUI(root) {
    const container = root.querySelector('#news-tool-content');
    const updateTime = root.querySelector('#news-last-updated');
    
    if (container) container.innerHTML = renderNewsItems();
    if (updateTime && newsState.lastUpdated) {
      updateTime.textContent = `Last updated: ${new Date(newsState.lastUpdated).toLocaleTimeString()}`;
    }

    // Bind retry button if exists
    const retryBtn = root.querySelector('.js-retry-news');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        fetchNews().then(() => updateUI(root));
      });
    }
  }

  function initNews(root) {
    const tabHi = root.querySelector('[data-news-lang="hi"]');
    const tabBn = root.querySelector('[data-news-lang="bn"]');
    const tabBiz = root.querySelector('[data-news-topic="business"]');
    const tabPol = root.querySelector('[data-news-topic="politics"]');
    const refreshBtn = root.querySelector('#news-refresh-btn');

    const handleLangClick = async (lang) => {
      // Update Tab UI
      [tabHi, tabBn].forEach(tab => {
        const isActive = tab.dataset.newsLang === lang;
        tab.classList.toggle('bg-indigo-600', isActive);
        tab.classList.toggle('text-white', isActive);
        tab.classList.toggle('bg-slate-100', !isActive);
        tab.classList.toggle('text-slate-600', !isActive);
      });

      await fetchNews(lang, newsState.topic);
      updateUI(root);
    };

    const handleTopicClick = async (topic) => {
      // Update Topic Tab UI
      [tabBiz, tabPol].forEach(tab => {
        const isActive = tab.dataset.newsTopic === topic;
        tab.classList.toggle('bg-slate-800', isActive);
        tab.classList.toggle('text-white', isActive);
        tab.classList.toggle('bg-slate-100', !isActive);
        tab.classList.toggle('text-slate-600', !isActive);
      });

      await fetchNews(newsState.lang, topic);
      updateUI(root);
    };

    if (tabHi) tabHi.addEventListener('click', () => handleLangClick('hi'));
    if (tabBn) tabBn.addEventListener('click', () => handleLangClick('bn'));
    if (tabBiz) tabBiz.addEventListener('click', () => handleTopicClick('business'));
    if (tabPol) tabPol.addEventListener('click', () => handleTopicClick('politics'));

    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('animate-spin');
        await fetchNews();
        refreshBtn.classList.remove('animate-spin');
        updateUI(root);
      });
    }

    // Initial fetch
    fetchNews().then(() => updateUI(root));
  }

  return {
    id: 'news',
    title: 'Daily News',
    subtitle: 'Latest updates',
    description: 'Real-time news coverage in Hindi and Bengali from trusted sources.',
    badge: '📰',
    render() {
      return `
        <div class="hidden fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" data-tool-modal="news" role="dialog" aria-modal="true" aria-labelledby="tool-news-title">
          <div class="absolute inset-0" data-dismiss-modal></div>
          <div class="relative bg-white border-2 border-slate-200 rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
            
            <!-- Header -->
            <div class="border-b border-slate-100 p-6 bg-gradient-to-br from-indigo-50 to-white">
              <div class="flex justify-between items-start mb-6">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                    <p class="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Real-time News Feed</p>
                  </div>
                  <h2 id="tool-news-title" class="text-2xl font-black text-slate-900 tracking-tight">Daily Updates</h2>
                  <p id="news-last-updated" class="text-[10px] font-bold text-slate-400 mt-1"></p>
                </div>
                <button type="button" class="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors" data-close-utility aria-label="Close">✕</button>
              </div>

              <div class="space-y-3">
                <div class="flex items-center justify-between gap-4">
                  <div class="flex p-1 bg-slate-100 rounded-xl">
                    <button type="button" data-news-lang="hi" class="px-4 py-1.5 rounded-lg text-xs font-black transition-all bg-indigo-600 text-white shadow-sm">हिंदी</button>
                    <button type="button" data-news-lang="bn" class="px-4 py-1.5 rounded-lg text-xs font-black transition-all text-slate-600 hover:text-slate-900">বাংলা</button>
                  </div>
                  
                  <button id="news-refresh-btn" type="button" class="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Refresh">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  </button>
                </div>

                <div class="flex p-1 bg-slate-100 rounded-xl w-fit">
                  <button type="button" data-news-topic="business" class="px-4 py-1.5 rounded-lg text-[10px] font-black transition-all bg-slate-800 text-white shadow-sm uppercase tracking-wider">Business</button>
                  <button type="button" data-news-topic="politics" class="px-4 py-1.5 rounded-lg text-[10px] font-black transition-all text-slate-600 hover:text-slate-900 uppercase tracking-wider">Politics</button>
                </div>
              </div>
            </div>

            <!-- Content Area -->
            <div id="news-tool-content" class="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
              <div class="flex flex-col gap-4 animate-pulse">
                ${Array.from({ length: 4 }).map(() => `
                  <div class="h-24 bg-slate-100 rounded-2xl w-full"></div>
                `).join('')}
              </div>
            </div>

            <!-- Footer -->
            <div class="p-4 border-t border-slate-100 bg-white text-center">
              <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1">
                Powered by Google News RSS <span class="text-xs">🌍</span>
              </p>
            </div>

          </div>
        </div>
      `;
    },
    init(root) {
      initNews(root);
    },
    onOpen(root) {
      // Refresh if it's been more than 30 minutes? Or just use initial fetch
      // For now, it fetches on init and stays in memory
    },
  };
}
