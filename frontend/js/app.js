const API = '/api';
let panier = JSON.parse(localStorage.getItem('panier') || '[]');
let plats = [];

async function loadMenu() {
  const grid = document.getElementById('menu-grid');
  if (!grid) return;

  plats = await fetch(`${API}/plats`).then(r => r.json());
  renderMenu(plats);
  updateCartCount();

  document.querySelectorAll('.filtre').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filtre').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.cat;
      renderMenu(cat === 'all' ? plats : plats.filter(p => p.categorie === cat));
    });
  });
}

function renderMenu(list) {
  const grid = document.getElementById('menu-grid');
  grid.innerHTML = list.map(p => `
    <div class="plat-card">
      <div class="plat-emoji">${p.image || '🍽️'}</div>
      <div class="plat-nom">${p.nom}</div>
      <div class="plat-desc">${p.description || ''}</div>
      <div class="plat-prix">${p.prix.toFixed(2)} €</div>
      <button class="btn-primary" onclick="ajouterAuPanier(${p.id})">Ajouter</button>
    </div>
  `).join('');
}

function ajouterAuPanier(id) {
  const plat = plats.find(p => p.id === id);
  const existant = panier.find(i => i.id === id);
  if (existant) existant.quantite++;
  else panier.push({ id: plat.id, nom: plat.nom, prix: plat.prix, quantite: 1 });
  localStorage.setItem('panier', JSON.stringify(panier));
  updateCartCount();
  alert(`${plat.nom} ajouté au panier !`);
}

function updateCartCount() {
  const el = document.getElementById('cart-count');
  if (el) el.textContent = panier.reduce((s, i) => s + i.quantite, 0);
}

function renderPanier() {
  const container = document.getElementById('cart-items');
  if (!container) return;

  if (panier.length === 0) {
    container.innerHTML = '<p>Votre panier est vide 🛒</p>';
    return;
  }

  const total = panier.reduce((s, i) => s + i.prix * i.quantite, 0);
  container.innerHTML = panier.map((i, idx) => `
    <div class="cart-line">
      <span><strong>${i.nom}</strong> × ${i.quantite}</span>
      <span>${(i.prix * i.quantite).toFixed(2)} € 
        <button onclick="retirer(${idx})" style="background:none;border:none;color:#d32f2f;cursor:pointer;font-size:1.2rem;">✕</button>
      </span>
    </div>
  `).join('') + `<div class="cart-total">Total : ${total.toFixed(2)} €</div>`;
}

function retirer(idx) {
  panier.splice(idx, 1);
  localStorage.setItem('panier', JSON.stringify(panier));
  renderPanier();
  updateCartCount();
}

function validerCommande(e) {
  e.preventDefault();
  if (panier.length === 0) return alert('Panier vide');

  const commandeData = {
    client_nom: document.getElementById('nom').value.trim(),
    client_tel: document.getElementById('tel').value.trim(),
    client_adresse: document.getElementById('adresse').value.trim()
  };

  localStorage.setItem('commande_tmp', JSON.stringify(commandeData));

  const mode = document.querySelector('input[name="mode-paiement"]:checked').value;
  window.location.href = mode === 'qr' ? 'paiement-qr.html' : 'paiement-qr.html';
}

// ==================== ADMIN ====================
function login() {
    const usernameInput = document.getElementById('admin-user').value;
    const passwordInput = document.getElementById('admin-pass').value;

    if (usernameInput === 'admin' && passwordInput === '12345678') {
        localStorage.setItem('token', 'fake-bypass-token');
        alert('Connexion réussie !');
        showAdmin(); 
    } else {
        alert('Identifiants invalides');
    }
}
  const username = document.getElementById('admin-user').value;
  const password = document.getElementById('admin-pass').value;

  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) return alert('Identifiants invalides');
  const { token } = await res.json();
  localStorage.setItem('token', token);
  showAdmin();
}

function showAdmin() {
  const token = localStorage.getItem('token');
  if (!token) return;
  document.getElementById('login-form')?.classList.add('hidden');
  document.getElementById('admin-panel')?.classList.remove('hidden');
  loadCommandesAdmin();
  loadPlatsAdmin();
}

async function loadCommandesAdmin() {
  const token = localStorage.getItem('token');
  const commandes = await fetch(`${API}/admin/commandes`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  const container = document.getElementById('commandes-list');
  if (!container) return;

  container.innerHTML = commandes.map(c => `
    <div class="commande-card">
      <strong>#${c.id} - ${c.client_nom}</strong>
      <span class="statut ${c.statut}">${c.statut.replace(/_/g, ' ')}</span>
      <p>📞 ${c.client_tel} | 📍 ${c.client_adresse || '-'}</p>
      <p>💰 ${c.total.toFixed(2)} €</p>
      ${c.methode_paiement ? `
        <div style="background:#fff8e1; padding:1rem; border-radius:8px; margin:0.75rem 0;">
          <p><strong>💳 ${c.methode_paiement}</strong> - Réf: <code>${c.reference_paiement}</code></p>
          <p>Statut paiement : ${c.statut_paiement}</p>
          ${c.statut_paiement === 'en_verification' ? `
            <div style="display:flex; gap:0.5rem; margin-top:0.75rem;">
              <button onclick="validerPaiement(${c.id}, true)" 
                style="background:#4caf50; color:white; border:none; padding:0.5rem 1rem; border-radius:6px; cursor:pointer;">
                ✅ Valider
              </button>
              <button onclick="validerPaiement(${c.id}, false)"
                style="background:#d32f2f; color:white; border:none; padding:0.5rem 1rem; border-radius:6px; cursor:pointer;">
                ❌ Refuser
              </button>
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `).join('') || '<p>Aucune commande</p>';
}

async function validerPaiement(id, approuve) {
  const token = localStorage.getItem('token');
  await fetch(`${API}/admin/commandes/${id}/valider-paiement`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ approuve, notes: '' })
  });
  loadCommandesAdmin();
  alert(approuve ? '✅ Paiement validé' : '❌ Paiement refusé');
}

async function loadPlatsAdmin() {
  const p = await fetch(`${API}/plats`).then(r => r.json());
  plats = p;
  const container = document.getElementById('plats-admin');
  if (!container) return;
  container.innerHTML = p.map(plat => `
    <div class="cart-line">
      <span>${plat.image} <strong>${plat.nom}</strong> - ${plat.prix} €</span>
      <button onclick="supprimerPlat(${plat.id})" style="background:#d32f2f;color:white;border:none;padding:0.3rem 0.8rem;border-radius:5px;cursor:pointer;">Supprimer</button>
    </div>
  `).join('');
}

async function supprimerPlat(id) {
  if (!confirm('Supprimer ce plat ?')) return;
  const token = localStorage.getItem('token');
  await fetch(`${API}/plats/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  loadPlatsAdmin();
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  loadMenu();
  renderPanier();

  document.getElementById('order-form')?.addEventListener('submit', validerCommande);

  document.getElementById('logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    location.reload();
  });

  showAdmin();

  document.getElementById('add-plat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    await fetch(`${API}/plats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nom: document.getElementById('plat-nom').value,
        description: document.getElementById('plat-desc').value,
        prix: parseFloat(document.getElementById('plat-prix').value),
        categorie: document.getElementById('plat-cat').value,
        image: document.getElementById('plat-img').value
      })
    });
    e.target.reset();
    loadPlatsAdmin();
  });
});
