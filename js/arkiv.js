/* js/arkiv.js */
const API       = "https://ai-nyheter-backend.onrender.com/api/archive-sheet";
const PER_PAGE  = 40;

let ALL   = [];
let view  = [];
let shown = 0;

fetch(API)
  .then(r => r.json())
  .then(data => {
    console.log("Antal poster:", data.length);   // debug
    ALL = data;
    initFilters();
    applyFilters();
  })
  .catch(err => {
    console.error(err);
    document.getElementById("loader").remove();
    document.getElementById("list").innerHTML =
      "<p class='text-red-600'>Kunde inte ladda arkivet.</p>";
  });

function initFilters() {
  const sel  = document.getElementById("catSelect");
  const cats = [...new Set(ALL.map(a => a.category))].sort();
  sel.innerHTML += cats.map(c => `<option>${c}</option>`).join("");
}

document.getElementById("apply").addEventListener("click", () => {
  shown = 0;
  applyFilters();
});

document.getElementById("load").addEventListener("click", () => {
  renderMore();
});

function applyFilters() {
  const cat = document.getElementById("catSelect").value.toLowerCase();
  const q   = document.getElementById("search").value.trim().toLowerCase();

  view = ALL.filter(a => {
    const hitCat = !cat || a.category.toLowerCase() === cat;
    const txt    = (a.title + a.summary).toLowerCase();
    const hitQ   = !q || txt.includes(q);
    return hitCat && hitQ;
  });

  document.getElementById("list").innerHTML = "";
  renderMore(true);
}

function renderMore(reset = false) {
  const list   = document.getElementById("list");
  const loader = document.getElementById("loader");
  const button = document.getElementById("load");

  if (reset) shown = 0;
  const slice = view.slice(shown, shown + PER_PAGE);

  slice.forEach(a => {
    list.insertAdjacentHTML("beforeend", `
      <article class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded">
            ${a.category}
          </span>
          ${a.paywall === "1" ? "🔒" : ""}
        </div>
        <h2 class="font-semibold">
          <a href="${a.url}" target="_blank" class="hover:underline">${a.title}</a>
        </h2>
        <time class="text-xs text-gray-500">${a.date}</time>
        <p class="mt-2 text-sm">${a.summary}</p>
      </article>
    `);
  });

  shown += slice.length;
  loader.classList.add("hidden");

  if (shown >= view.length) {
    button.classList.add("hidden");
  } else {
    button.classList.remove("hidden");
  }

  if (!view.length) {
    list.innerHTML = "<p>Inga träffar.</p>";
    button.classList.add("hidden");
  }
}
