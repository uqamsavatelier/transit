// Option simple (fonction publique — Verify JWT désactivé)
const FUNCTION_URL = "https://mimjugutzdolfkfpchzc.functions.supabase.co/podio-submit";

const form = document.getElementById("podio-form");
const msg  = document.getElementById("msg");

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  msg.className = "";
  msg.textContent = "Envoi en cours…";

  const payload = {
    marque_modele:      document.getElementById("marque_modele").value.trim(),
    numero_inventaire:  document.getElementById("numero_inventaire").value.trim(),
    date_achat:         document.getElementById("date_achat").value.trim(),
    date_fin_garantie:  document.getElementById("date_fin_garantie").value.trim(),
    fournisseur:        document.getElementById("fournisseur").value.trim(),
  };

  try {
    const r = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const t = await r.text();
    if (!r.ok) throw new Error(t || r.statusText);
    msg.className = "ok";
    msg.textContent = "✅ Envoyé à Podio !";
    form.reset();
  } catch (e) {
    msg.className = "err";
    msg.textContent = "❌ Erreur d’envoi: " + String(e.message || e);
  }
});
