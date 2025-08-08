// ==================== KONSTANTER ====================
const API = "https://ai-nyheter-backend.onrender.com/api";
const loader    = document.getElementById("loader");
const newsSec   = document.getElementById("news");
const newsList  = document.getElementById("news-list");
const alertBox  = document.getElementById("alert");
const loadBtn   = document.getElementById("load");
const catSelect = document.getElementById("catSelect");
const search    = document.getElementById("search");
const applyBtn  = document.getElementById("apply");

let allNews = [];
let shownCount = 0;
const STEP = 10;

// ==================== 1. HÄMTA & VISA ARTIKLAR ====================
Promise.all([
  fetch(`${API}/all`).then(r => r.json()),
  fetch(`${API}/settings`).then(r => r.json())
])
.then(([articles, categories]) => {
  allNews = articles;
  loader.classList.add("hidden");
  newsSec.classList.remove("hidden");

  // Fyll kategoriväljaren
  categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.Kategori;
    opt.textContent = c.Kategori;
    catSelect.appendChild(opt);
  });

  renderMore();
})
.catch(err => showError("Kunde inte ladda nyheter", err));

// ==================== 2. RENDERA ARTIKLAR ====================
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
  if (shownCount >= filterNews().length) {
    loadBtn.classList.add("hidden");
  } else {
    loadBtn.classList.remove("hidden");
  }
}

// ==================== 3. FILTRERA ====================
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

// ==================== 4. LADDKNAPP & FILTRERING ====================
loadBtn.addEventListener("click", renderMore);

applyBtn.addEventListener("click", () => {
  shownCount = 0;
  newsList.innerHTML = "";
  renderMore();
});

// ==================== 5. LADDA KATEGORIER I FORMULÄR ====================
fetch(`${API}/settings`)
  .then(r => r.json())
  .then(cats => {
    const wrap = document.getElementById("cat-boxes");
    if (!cats.length) {
      wrap.innerHTML = "<em>Inga kategorier i systemet</em>";
      return;
    }
    wrap.innerHTML = cats.map(c =>
      `<label class="inline-flex items-center mr-4 mt-2">
         <input type="checkbox" value="${c.Kategori}" class="accent-indigo-600" />
         <span class="ml-1">${c.Kategori}</span>
       </label>`
    ).join("");
  })
  .catch(err => console.error("settings-fel:", err));

// ==================== 6. PRENUMERATION ====================
document.getElementById("sub-form").addEventListener("submit", async e => {
  e.preventDefault();
  const fd   = new FormData(e.target);
  const cats = [...document.querySelectorAll('#cat-boxes input:checked')].map(c => c.value);

  toggleAlert("info", "Skickar …");

  try {
    const r = await fetch(`${API}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:  fd.get("name"),
        email: fd.get("email"),
        categories: cats
      })
    });
    const res = await r.json();
    if (r.ok) {
      toggleAlert("success", "Tack! Du är nu prenumerant.");
      e.target.reset();
      document.querySelectorAll('#cat-boxes input').forEach(cb => cb.checked = false);
    } else {
      toggleAlert("error", res.error || "Något gick fel.");
    }
  } catch (err) {
    toggleAlert("error", "Nätverksfel. Försök igen.");
    console.error(err);
  }
});

// ==================== 7. HJÄLPFUNKTIONER ====================
function toggleAlert(type, msg) {
  const styles = {
    info:    "bg-blue-100 text-blue-700",
    success: "bg-green-100 text-green-700",
    error:   "bg-red-100 text-red-700"
  };
  alertBox.className = `${styles[type]} mb-4 p-3 rounded`;
  alertBox.textContent = msg;
  alertBox.classList.remove("hidden");
}

function showError(msg, err) {
  console.error(err || msg);
  loader.classList.add("hidden");
  newsSec.innerHTML = `<p class="text-red-600">${msg}</p>`;
  newsSec.classList.remove("hidden");
}
