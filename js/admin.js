const API = "https://ai-nyheter-backend.onrender.com/api";

async function loadSubs() {
  const token = document.getElementById("token").value.trim();
  const r = await fetch(`${API}/subscribers`, {
    headers: { "X-Admin-Token": token }
  });
  const data = await r.json();
  const tbl = document.getElementById("sub-table");
  if (!r.ok) return tbl.innerHTML = `<tr><td>${data.error}</td></tr>`;

  tbl.innerHTML = data.map(row => `
    <tr>
      <td>${row.Namn}</td>
      <td>${row["E-post"]}</td>
      <td>${row.Kategorier}</td>
      <td><button onclick="delSub('${row['E-post']}', '${token}')">Ta bort</button></td>
    </tr>`).join("");
}

async function delSub(email, token) {
  if (!confirm(`Ta bort ${email}?`)) return;
  await fetch(`${API}/delete-subscriber`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Token": token
    },
    body: JSON.stringify({ email })
  });
  loadSubs();
}
