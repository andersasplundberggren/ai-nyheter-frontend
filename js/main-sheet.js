// =================== KONFIG ===================
const SHEET_ID  = "PASTE_YOUR_SHEET_ID_HERE"; // <— byt till ditt riktiga ID
const CATS_TAB  = "Kategorier";
const NEWS_TAB  = "Artiklar";

const STEP = 12; // antal kort per laddning

// =================== ELEMENT ===================
const loader    = document.getElementById("loader");
const newsSec   = document.getElementById("news");
const newsList  = document.getElementById("news-list");
const loadBtn   = document.getElementById("load");
const catSelect = document.getElementById("catSelect");
const searchEl  = document.getElementById("search");
const applyBtn  = document.getElementById("apply");
const alertBox  = document.getElementById("alert");

let allNews = [];
let shownCount = 0;

// =================== HJÄLPARE ===================
function showError(msg) {
  loader.classList.add("hidden");
  newsSec.classList.remove("hidden");
  alertBox.className = "bg-red-100 text-red-700 p-3 rounded";
  alertBox.textContent = msg;
  alertBox.classList.remove("hidden");
}

function parseYmd(s) {
  // Return Date-objekt från "YYYY-MM-DD", annars epoch 0
  if (!s) return new Date(0);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return new Date(0);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function boolish(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (!v) return false;
  const s = String(v).toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "ja";
}

// =================== 1) LADDA DATA FRÅN SHEET ===================
Tabletop.init({
  key: SHEET_ID,
  simpleSheet: false,
  wanted: [CATS_TAB, NEWS_TAB],
  callback: (data) => {
    try {
      const articles = data[NEWS_TAB]?.elements || [];
      const categories = data[CATS_TAB]?.elements || [];

      // 1a) fyll kategoriväljaren
      categories.forEach(c => {
        const k = c.Kategori || c.kategori || c.category;
        if (!k) return;
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = k;
        catSelect.appendChild(opt);
      });

      // 1b) mappa artiklar (OBS: använder lowercase headrar som i ditt Sheet)
      allNews = articles.map(row => ({
        title:    row.title    ?? row.Titel    ?? "",
        url:      row.url      ?? row.Länk     ?? "",
        summary:  row.summary  ?? row.Sammanfattning ?? "",
        category: row.category ?? row.Kategori ?? "",
        date:     row.date     ?? row.Datum    ?? "",
        paywall:  boolish(row.paywall ?? row.Paywall),
        import_date: row.import_date ?? row.Import_date ?? row.importDate ?? ""
      }));

      // 1c) sortera: import_date DESC, fallback till date DESC
      allNews.sort((a, b) => {
        const ai = parseYmd(a.import_date);
        const bi = parseYmd(b.import_date);
        if (bi - ai !== 0) return bi - ai;
        return parseYmd(b.date) - parseYmd(a.date);
      });

      loader.classList.add("hidden");
      newsSec.classList.remove("hidden");
      renderMore();
    } catch (e) {
      console.error(e);
      showError("Kunde inte tolka data från Google Sheet.");
    }
  },
  error: (err) => {
    console.error(err);
    showError("Kunde inte ladda data från Google Sheet. Kontrollera delning/publicering.");
  }
});

// =================== 2) RENDERA ===================
function renderMore() {
  const filtered = filterNews();
  const next = filtered.slice(shownCount, shownCount + STEP);

  next.forEach(n => {
    const card = document.createElement("article");
    card.className = "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-6 rounded-lg shadow";
    card.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <h3 class="font-semibold">
          ${n.paywall ? "🔒 " : ""}
          <a href="${n.url}" target="_blank" rel="noopener"
             class="text-indigo-600 dark:text-indigo-400 hover:underline">
            ${n.title || "(saknar titel)"}
          </a>
        </h3>
        <span class="text-xs bg-indigo-100 dark:bg-indigo-700 text-indigo-700 dark:text-indigo-100 px-2 py-0.5 rounded">
          ${n.category || "Okänd"}
        </span>
      </div>
      <time class="text-xs text-gray-500 dark:text-gray-400">${n.date || ""}</time>
      <p class="mt-2 text-sm">${n.summary || ""}</p>
    `;
    newsList.appendChild(card);
  });

  shownCount += next.length;
  loadBtn.classList.toggle("hidden", shownCount >= filterNews().length);
}

// =================== 3) FILTRERING ===================
function filterNews() {
  const cat = catSelect.value;
  const kw  = (searchEl.value || "").toLowerCase();

  return allNews.filter(n => {
    const okCat = !cat || (n.category || "").toLowerCase() === cat.toLowerCase();
    const text  = `${n.title || ""} ${n.summary || ""}`.toLowerCase();
    const okKw  = !kw || text.includes(kw);
    return okCat && okKw;
  });
}

// =================== 4) EVENTS ===================
applyBtn.addEventListener("click", () => {
  shownCount = 0;
  newsList.innerHTML = "";
  renderMore();
});
loadBtn.addEventListener("click", renderMore);
