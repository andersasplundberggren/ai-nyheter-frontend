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

  let allArticles = [];
  let filtered = [];
  let renderedCount = 0;

  // ---------- UI helpers ----------
  const escapeHTML = (s) => String(s ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#39;");

  const svDate = (str) => {
    if (!str) return '';
    const d = new Date(str);
    if (isNaN(d)) return str;
    try { return new Intl.DateTimeFormat('sv-SE', { dateStyle:'medium' }).format(d); }
    catch { return d.toLocaleDateString('sv-SE'); }
  };

  const truncate = (s, max) => {
    const str = String(s ?? '');
    if (str.length <= max) return str;
    const cut = str.lastIndexOf(' ', max - 1);
    return str.slice(0, cut > max - 25 ? cut : max).trim() + '…';
  };

  const buildSearchRegex = (q) => {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(${safe})`, 'gi');
  };

  const highlight = (text, query) => {
    if (!query) return escapeHTML(text);
    const re = buildSearchRegex(query);
    return escapeHTML(text).replace(re, '<mark>$1</mark>');
  };

  const showError = (msg, details='') => {
    $results.innerHTML = `<div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
      <div class="font-semibold mb-1">Kunde inte läsa data</div>
      <div>${escapeHTML(msg)}</div>
      ${details ? `<pre class="mt-3 text-xs whitespace-pre-wrap">${escapeHTML(details)}</pre>` : ''}
    </div>`;
  };

  const normalizeArticle = (row) => {
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
    const toTime = (s) => { const t = new Date(s).getTime(); return isNaN(t) ? 0 : t; };
    return arr.sort((a,b) => (toTime(b.import_date)-toTime(a.import_date)) || (toTime(b.date)-toTime(a.date)));
  };

  const renderCard = (a, q) => {
    const node = $cardTpl.content.cloneNode(true);
    node.querySelector('h2').innerHTML = highlight(truncate(a.title || '(utan rubrik)', cfg.TITLE_MAX), q);
    node.querySelector('.date').textContent = svDate(a.date || a.import_date);
    node.querySelector('.summary').innerHTML = highlight(a.summary || '', q);
    node.querySelector('.category').textContent = a.category || 'Okategoriserad';
    node.querySelector('.readmore').href = a.url || '#';
    if (['true','1','ja','yes','y','t'].includes(String(a.paywall).toLowerCase())) {
      node.querySelector('.badge').classList.remove('hidden');
    }
    $results.appendChild(node);
  };

  const updateCount = () => {
    const total = filtered.length;
    if (!total) {
      $count.classList.add('hidden');
      $results.innerHTML = '';
      $results.appendChild($emptyTpl.content.cloneNode(true));
    } else {
      $count.classList.remove('hidden');
      $count.textContent = `${total} träff${total === 1 ? '' : 'ar'}`;
    }
    $loadMore.disabled = renderedCount >= total;
  };

  const renderNextChunk = () => {
    const q = $search.value.trim();
    const next = filtered.slice(renderedCount, renderedCount + cfg.PAGE_SIZE);
    next.forEach(a => renderCard(a, q));
    renderedCount += next.length;
    updateCount();
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
    $results.innerHTML = '';
    renderNextChunk();
    updateCount();
  };

  const debounce = (fn, ms=250) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(null,args), ms); }; };

  // ---------- Loaders ----------
  const loadViaBackend = async () => {
    const base = cfg.BACKEND_PROXY.BASE_URL.replace(/\/+$/,'');
    const artUrl = base + cfg.BACKEND_PROXY.ARTICLES_PATH;
    const catUrl = base + cfg.BACKEND_PROXY.CATEGORIES_PATH;

    const [artRes, catRes] = await Promise.all([
      fetch(artUrl, { credentials: 'omit' }),
      fetch(catUrl, { credentials: 'omit' })
    ]);
    if (!artRes.ok) throw new Error(`Backend articles HTTP ${artRes.status}`);
    if (!catRes.ok) throw new Error(`Backend categories HTTP ${catRes.status}`);

    const [artRows, catRows] = await Promise.all([artRes.json(), catRes.json()]);
    const categories = [];
    (Array.isArray(catRows) ? catRows : []).forEach(row => {
      const key = Object.keys(row).find(k => k.toLowerCase() === 'kategori');
      const v = key ? String(row[key]).trim() : '';
      if (v) categories.push(v);
    });
    const articles = (Array.isArray(artRows) ? artRows : []).map(normalizeArticle);
    return { articles, categories };
  };

  const parseGvizJson = (text) => {
    const start = text.indexOf('{'), end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('Ogiltigt GViz-svar');
    return JSON.parse(text.slice(start, end + 1));
  };

  const fetchGvizSheet = async (sheetName) => {
    const url = `https://docs.google.com/spreadsheets/d/${cfg.SHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`GViz HTTP ${res.status} (${sheetName})`);
    const txt = await res.text();
    const json = parseGvizJson(txt);
    if (json.status !== 'ok') throw new Error(`GViz-status: ${json.status}`);
    const cols = (json.table.cols || []).map(c => (c.label || c.id || '').trim());
    const rows = (json.table.rows || []).map(r => {
      const obj = {};
      (r.c || []).forEach((cell,i) => { const key = cols[i] || `col${i}`; obj[key] = cell && cell.v != null ? cell.v : ''; });
      return obj;
    });
    return rows;
  };

  const loadViaGviz = async () => {
    const [artRows, catRows] = await Promise.all([
      fetchGvizSheet(cfg.SHEET_ARTICLES),
      fetchGvizSheet(cfg.SHEET_CATEGORIES)
    ]);
    const categories = [];
    catRows.forEach(row => {
      const key = Object.keys(row).find(k => k.toLowerCase() === 'kategori');
      const v = key ? String(row[key]).trim() : '';
      if (v) categories.push(v);
    });
    const articles = artRows.map(normalizeArticle);
    return { articles, categories };
  };

  const loadViaTabletop = () => new Promise((resolve, reject) => {
    if (typeof Tabletop === 'undefined') return reject(new Error('Tabletop saknas'));
    Tabletop.init({
      key: cfg.SHEET_ID,
      simpleSheet: false,
      wanted: [cfg.SHEET_ARTICLES, cfg.SHEET_CATEGORIES],
      callback: (data) => {
        try {
          const catSheet = data[cfg.SHEET_CATEGORIES];
          const artSheet = data[cfg.SHEET_ARTICLES];
          const categories = [];
          if (catSheet && Array.isArray(catSheet.elements)) {
            catSheet.elements.forEach(row => {
              const key = Object.keys(row).find(k => k.toLowerCase() === 'kategori');
              const v = key ? String(row[key]).trim() : '';
              if (v) categories.push(v);
            });
          }
          const articles = (artSheet?.elements || []).map(normalizeArticle);
          resolve({ articles, categories });
        } catch (e) { reject(e); }
      }
    });
  });

  // ---------- Init ----------
  const init = async () => {
    try {
      let payload = null;

      // 1) Backend-proxy om påslaget
      if (cfg.BACKEND_PROXY?.enabled && cfg.BACKEND_PROXY.BASE_URL) {
        try { payload = await loadViaBackend(); }
        catch (e) { console.warn('[AI-Nyheter] Backend-proxy misslyckades:', e); }
      }

      // 2) GViz (kräver att arket kan visas av alla med länk / är publikt)
      if (!payload || !payload.articles?.length) {
        try { payload = await loadViaGviz(); }
        catch (e) { console.warn('[AI-Nyheter] GViz misslyckades:', e); }
      }

      // 3) Tabletop (kräver oftast “Publicera på webben”)
      if (!payload || !payload.articles?.length) {
        try { payload = await loadViaTabletop(); }
        catch (e) { console.warn('[AI-Nyheter] Tabletop misslyckades:', e); }
      }

      if (!payload || !payload.articles?.length) throw new Error('Hittade inga artiklar via proxy/GViz/Tabletop.');

      // Kategorier
      const opts = [...new Set(payload.categories)].sort((a,b)=>a.localeCompare(b,'sv'));
      opts.forEach(v => { const o = document.createElement('option'); o.value=v; o.textContent=v; $category.appendChild(o); });

      // Artiklar
      allArticles = sortArticles(payload.articles);
      filtered = [...allArticles];
      renderNextChunk();
      updateCount();

      // Listeners
      $category.addEventListener('change', applyFilters);
      $search.addEventListener('input', debounce(applyFilters, 250));
      $clear.addEventListener('click', () => { $search.value=''; $category.value=''; applyFilters(); });
      $loadMore.addEventListener('click', renderNextChunk);
    } catch (e) {
      console.error(e);
      showError(e.message || 'Okänt fel');
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
