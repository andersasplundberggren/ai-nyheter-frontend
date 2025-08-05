const API_BASE = "https://ai-nyheter-backend.onrender.com/api";

// ========== 1. Hämta & rendera nyheter ==========
fetch(`${API_BASE}/news`)
  .then(r => r.json())
  .then(renderNews)
  .catch(console.error);

function renderNews(items) {
  const list = document.getElementById("news-list");
  list.innerHTML = items.map(n => `
    <article>
      <h3><a href="${n.url}" target="_blank">${n.title}</a></h3>
      <small>${n.date}</small>
      <p>${n.summary}</p>
    </article>`).join("");
}

// ========== 2. Ladda kategorier ==========
fetch(`${API_BASE}/settings`)
  .then(r => r.json())
  .then(cats => {
    const boxWrap = document.getElementById("cat-boxes");
    boxWrap.innerHTML = cats.map(c =>
      `<label><input type="checkbox" value="${c.Kategori}" /> ${c.Kategori}</label>`
    ).join("<br>");
  })
  .catch(console.error);

// ========== 3. Hantera formulär ==========
document.getElementById("sub-form").addEventListener("submit", async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const selected = [...document.querySelectorAll('#cat-boxes input:checked')]
                   .map(cb => cb.value);

  const payload = {
    name:  fd.get("name"),
    email: fd.get("email"),
    categories: selected
  };

  const msgEl = document.getElementById("sub-msg");
  msgEl.textContent = "Skickar…";

  try {
    const r = await fetch(`${API_BASE}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const res = await r.json();
    msgEl.textContent = r.ok ? "Tack! Du är nu prenumerant." : res.error;
  } catch (err) {
    msgEl.textContent = "Något gick fel. Försök igen.";
    console.error(err);
  }
});
