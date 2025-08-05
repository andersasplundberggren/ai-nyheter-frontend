const API = "https://ai-nyheter-backend.onrender.com/api";

const loader   = document.getElementById("loader");
const newsSec  = document.getElementById("news");
const alertBox = document.getElementById("alert");

/* ---------- 1. Hämta & visa nyheter ---------- */
fetch(`${API}/news`)
  .then(r => r.json())
  .then(renderNews)
  .catch(err => showError("Kunde inte ladda nyheter", err));

function renderNews(items) {
  const list = document.getElementById("news-list");
  if (!items.length) return showError("Inga nyheter just nu.");

  list.innerHTML = items.map(n => `
    <article class="bg-white px-10 rounded-lg shadow">
      <h3 class="font-semibold mb-1">
        <a href="${n.url}" target="_blank"
           class="text-indigo-600 hover:underline">${n.title}</a>
      </h3>
      <time class="text-xs text-gray-500">${n.date}</time>
      <p class="mt-2 text-sm">${n.summary}</p>
    </article>`).join("");

  loader.classList.add("hidden");
  newsSec.classList.remove("hidden");
}

/* ---------- 2. Ladda kategorier ---------- */
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
         <input type="checkbox" value="${c.Kategori}"
                class="accent-indigo-600" />
         <span class="ml-1">${c.Kategori}</span>
       </label>`
    ).join("");
  })
  .catch(err => console.error("settings-fel:", err));

/* ---------- 3. Prenumerationsformulär ---------- */
document.getElementById("sub-form").addEventListener("submit", async e => {
  e.preventDefault();
  const fd   = new FormData(e.target);
  const cats = [...document.querySelectorAll('#cat-boxes input:checked')]
               .map(c => c.value);

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
      document.querySelectorAll('#cat-boxes input').forEach(cb => cb.checked=false);
    } else {
      toggleAlert("error", res.error || "Något gick fel.");
    }
  } catch (err) {
    toggleAlert("error", "Nätverksfel. Försök igen.");
    console.error(err);
  }
});

/* ---------- Hjälpfunktioner ---------- */
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
