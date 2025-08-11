/* AI-Nyheter – frontend (Tabletop.js + Tailwind)
   Laddar flikarna "Artiklar" och "Kategorier" från Google Sheet och renderar
   sökbart/filtrerbart flöde med "Ladda fler".
*/

(() => {
  const cfg = window.AI_NEWS_CONFIG;
  const $results = document.getElementById('results');
  const $category = document.getElementById('category');
  const $search = document.getElementById('search');
  const $clear = document.getElementById('clearFilters');
  const $loadMore = document.getElementById('loadMore');
  const $count = document.getElementById('countBadge');
  const $cardTpl = document.getElementById('cardTemplate');
  const $emptyTpl = document.getElementById('emptyState');

  // State
  let allArticles = [];
  let filtered = [];
  let renderedCount = 0;

  // Utils
  const svDate = (str) => {
    if (!str) return '';
    // Stötta både ISO (2025-08-11), RFC, och ev. "YYYY-MM-DD HH:MM"
    const d = new Date(str);
    if (isNaN(d)) return str; // visa original om det inte går att tolka
    try {
      return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium' }).format(d);
    } catch {
      return d.toLocaleDateString('sv-SE');
    }
  };

  const escapeHTML = (s) =>
    String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const truncate = (s, max) => {
    const str = String(s ?? '');
    if (str.length <= max) return str;
    // försök kapa vid närmsta mellanslag före max
    const cut = str.lastIndexOf(' ', max - 1);
    return str.slice(0, cut > max - 25 ? cut : max).trim() + '…';
  };

  const buildSearchRegex = (q) => {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // matcha ord-delar, case-insensitivt
    return new RegExp(`(${safe})`, 'gi');
  };

  const highlight = (text, query) => {
    if (!query) return escapeHTML(text);
    const re = buildSearchRegex(query);
    // kör på redan-escapad text så vi inte kan injicera
    const esc = escapeHTML(text);
    return esc.replace(re, '<mark>$1</mark>');
  };

  const normalizeArticle = (row) => {
    // Mappa kolumnnamn robust (skiftlägesokänsligt)
    const get = (name) => {
      const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
      return key ? row[key] : '';
    };
    return {
      id: get('id') || crypto.randomUUID(),
      title: get('title') || get('rubrik') || '',
      url: get('url') || '',
      date: get('date') || get('datum') || '',
      summary: get('summary') || get('sammanfattning') || '',
      category: get('category') || get('kategori') || '',
      paywall: String(get('paywall') || '').trim().toLowerCase(),
      import_date: get('import_date') || get('importdate') || get('importdatum') || ''
    };
  };

  const sortArticles = (arr) => {
    // Primärt sortera på import_date (nyast först), annars date
    const toTime = (s) => {
      const t = new Date(s).getTime();
      return isNaN(t) ? 0 : t;
    };
    return arr.sort((a, b) => (toTime(b.import_date) - toTime(a.import_date)) || (toTime(b.date) - toTime(a.date)));
  };

  const applyFilters = () => {
    const q = $search.value.trim();
    const cat = $category.value.trim();

    filtered = allArticles.filter(a => {
      const catOk = !cat || a.category === cat;
      const text = (a.title || '') + ' ' + (a.summary || '');
      const qOk = !q || text.toLowerCase().includes(q.toLowerCase());
      return catOk && qOk;
    });

    renderedCount = 0;
    $results.innerHTML = ''; // clear
    renderNextChunk();
    updateCount();
  };

  const updateCount = () => {
    const total = filtered.length;
    if (!total) {
      $count.classList.add('hidden');
      // Visa tomt-tillstånd
      $results.innerHTML = '';
      $results.appendChild($emptyTpl.content.cloneNode(true));
    } else {
      $count.classList.remove('hidden');
      $count.textContent = `${total} träff${total === 1 ? '' : 'ar'}`;
    }
    // Toggle "Ladda fler"
    if (renderedCount >= total) {
      $loadMore.disabled = true;
    } else {
      $loadMore.disabled = false;
    }
  };

  const renderCard = (article, q) => {
    const node = $cardTpl.content.cloneNode(true);
    const h2 = node.querySelector('h2');
    const dateEl = node.querySelector('.date');
    const badge = node.querySelector('.badge');
    const sum = node.querySelector('.summary');
    const cat = node.querySelector('.category');
    const link = node.querySelector('.readmore');

    const title = truncate(article.title || '(utan rubrik)', cfg.TITLE_MAX);
    h2.innerHTML = highlight(title, q);
    dateEl.textContent = svDate(article.date || article.import_date);
    sum.innerHTML = highlight(article.summary || '', q);
    cat.textContent = article.category || 'Okategoriserad';
    link.href = article.url || '#';

    // Paywall? Tolkning: "true", "ja", "1", "yes"
    if (['true','1','ja','yes','y','t'].includes(String(article.paywall).toLowerCase())) {
      badge.classList.remove('hidden');
    }

    $results.appendChild(node);
  };

  const renderNextChunk = () => {
    const q = $search.value.trim();
    const next = filtered.slice(renderedCount, renderedCount + cfg.PAGE_SIZE);
    next.forEach(a => renderCard(a, q));
    renderedCount += next.length;
    updateCount();
  };

  // Debounce för sök
  const debounce = (fn, ms=250) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  };

  // Initialisering
  const init = () => {
    Tabletop.init({
      key: cfg.SHEET_ID,
      simpleSheet: false,
      wanted: [cfg.SHEET_ARTICLES, cfg.SHEET_CATEGORIES],
      callback: (data) => {
        try {
          // 1) Kategorier
          const catSheet = data[cfg.SHEET_CATEGORIES];
          if (catSheet && Array.isArray(catSheet.elements)) {
            const opts = new Set();
            catSheet.elements.forEach(row => {
              const key = Object.keys(row).find(k => k.toLowerCase() === 'kategori');
              const v = key ? String(row[key]).trim() : '';
              if (v) opts.add(v);
            });
            [...opts].sort((a,b)=>a.localeCompare(b,'sv')).forEach(v => {
              const opt = document.createElement('option');
              opt.value = v; opt.textContent = v;
              $category.appendChild(opt);
            });
          }

          // 2) Artiklar
          const artSheet = data[cfg.SHEET_ARTICLES];
          if (!artSheet || !Array.isArray(artSheet.elements)) throw new Error('Kunde inte läsa fliken "Artiklar".');

          allArticles = sortArticles(artSheet.elements.map(normalizeArticle));

          // För-rendera (utan filter)
          filtered = [...allArticles];
          renderNextChunk();
          updateCount();

          // Event listeners
          $category.addEventListener('change', applyFilters);
          $search.addEventListener('input', debounce(applyFilters, 250));
          $clear.addEventListener('click', () => {
            $search.value = '';
            $category.value = '';
            applyFilters();
          });
          $loadMore.addEventListener('click', renderNextChunk);
        } catch (e) {
          console.error(e);
          $results.innerHTML = `<div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">Fel vid inläsning av data: ${escapeHTML(e.message)}</div>`;
        }
      }
    });
  };

  // Säkerställ att Sheet är publicerat, annars får Tabletop CORS/åtkomstfel.
  // Starta när DOM finns
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
