// =================== KONFIG ===================
const SHEET_ID = "1vSsBLHX2RzL84v_6nIVn4umBt8t5t2sMsSe_WgR9p3M";
const CATS_TAB = "Kategorier";
const NEWS_TAB = "Artiklar";

// =================== ELEMENT ===================
const loader    = document.getElementById("loader");
const newsSec   = document.getElementById("news");
const newsList  = document.getElementById("news-list");
const loadBtn   = document.getElementById("load");
const catSelect = document.getElementById("catSelect");
const search    = document.getElementById("search");
const applyBtn  = document.getElementById("apply");

let allNews = [];
let allCategories = [];
let shownCount = 0;
const STEP = 10;

// =================== 1. LADDA DATA FRÅN SHEET ===================
Tabletop.init({
  key: SHEET_ID,
  simpleSheet: false,
  wanted: [CATS_TAB, NEWS_TAB],
  callback: (data) => {
    const articles = data[NEWS_TAB].elements || [];
    const categories = data[CATS_TAB].elements || [];

    allCategories = categories.map(c => c.Kategori);

    allCategories.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      catSelect.appendChild(opt);
    });

    allNews = articles.map(row => ({
      title: row.title,
      url: row.url,
      summary: row.summary,
      category: row.category,
      date: row.date,
      paywall: row.paywall === "TRUE"
    }));

    loader.classList.add("hidden");
    newsSec.classList.remove("hidden");
    renderMore();
  },
  error: (err) => {
    console.error("Kunde inte ladda data från Sheet:", err);
    loader.classList.add("hidden");
    newsSec.innerHTML = `<p class="text-red-600">Kunde inte ladda nyheter.</p>`;
    newsSec.classList.remove("hidden");
  }
});

// =================== 2. RENDERA ARTIKLAR ===================
function renderMore() {
  const filtered = filterNews();
  const next = filtered.slice(shownCount, shownCount + STEP);

  next.forEach(n => {
    const article = document.createElement("article");
    article.className = "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-6 rounded-lg shadow";
    article.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <h3 class="font-semibold">
          ${n.paywall ? "🔒 " : ""}
          <a href="${n.url}" target="_blank"
             class="text-indigo-600 dark:text-indigo-400 hover:underline">
            ${n.title}
          </a>
        </h3>
        <span class="text-xs bg-indigo-100 dark:bg-indigo-700 text-indigo-700 dark:text-indigo-100 px-2 py-0.5 rounded">
          ${n.category}
        </span>
      </div>
      <time class="text-xs text-gray-500 dark:text-gray-400">${n.date}</time>
      <p class="mt-2 text-sm">${n.summary}</p>
    `;
    newsList.appendChild(article);
  });

  shownCount += next.length;
  loadBtn.classList.toggle("hidden", shownCount >= filterNews().length);
}

// =================== 3. FILTRERING ===================
function filterNews() {
  const cat = catSelect.value;
  const keyword = search.value.toLowerCase();

  return allNews.filter(n => {
    const matchCat = !cat || n.category === cat;
    const matchText = !keyword || (
      n.title.toLowerCase().includes(keyword) ||
      n.summary.toLowerCase().includes(keyword)
    );
    return matchCat && matchText;
  });
}

applyBtn.addEventListener("click", () => {
  shownCount = 0;
  newsList.innerHTML = "";
  renderMore();
});

loadBtn.addEventListener("click", renderMore);
