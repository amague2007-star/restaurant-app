require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const QRCode = require('qrcode');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'dev_secret';

app.use(cors());
app.use(express.json());

// Servir le frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// ==================== AUTH ADMIN ====================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // Vérification en dur pour la production
    if (username === 'admin' && password === '12345678') {
        const token = jwt.sign({ id: 1 }, SECRET, { expiresIn: '1h' });
        return res.json({ token });
    }
    
    return res.status(401).json({ error: 'Identifiants invalides' });
});
});

app.post('/api/register-admin', async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  db.run("INSERT INTO admins (username, password) VALUES (?, ?)", [username, hash],
    function(err) {
      if (err) return res.status(400).json({ error: 'Admin existe déjà' });
      res.json({ id: this.lastID });
    });
});

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  try {
    req.admin = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

// ==================== MENU ====================
app.get('/api/plats', (req, res) => {
  db.all("SELECT * FROM plats WHERE disponible = 1", (err, rows) => {
    res.json(rows);
  });
});

app.post('/api/plats', authMiddleware, (req, res) => {
  const { nom, description, prix, categorie, image } = req.body;
  db.run("INSERT INTO plats (nom, description, prix, categorie, image) VALUES (?, ?, ?, ?, ?)",
    [nom, description, prix, categorie, image],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    });
});

app.delete('/api/plats/:id', authMiddleware, (req, res) => {
  db.run("DELETE FROM plats WHERE id=?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ==================== CONFIG PAIEMENT ====================
app.get('/api/paiement/operateurs', (req, res) => {
  db.all("SELECT * FROM config_paiement WHERE actif = 1", (err, rows) => {
    res.json(rows);
  });
});

// ==================== QR CODE ====================
app.post('/api/paiement/qr-direct', async (req, res) => {
  const { operateur, montant, commandeId } = req.body;

  db.get("SELECT * FROM config_paiement WHERE operateur = ? AND actif = 1",
    [operateur], async (err, op) => {
      if (!op) return res.status(404).json({ error: 'Opérateur non trouvé' });

      const id = commandeId || 'TEMP';
      let qrData;

      if (op.operateur === 'Wave') {
        qrData = `wave://send?phone=${op.numero}&amount=${montant}`;
      } else {
        qrData = `PAIEMENT ${op.operateur.toUpperCase()}\nNumero: ${op.numero}\nMontant: ${montant} EUR\nTitulaire: ${op.nom_titulaire}\nReference: CMD-${id}`;
      }

      try {
        const qrDataURL = await QRCode.toDataURL(qrData, {
          width: 400,
          margin: 2,
          errorCorrectionLevel: 'H'
        });
        res.json({ qr: qrDataURL, contenu: qrData });
      } catch (error) {
        res.status(500).json({ error: 'Erreur génération QR' });
      }
    });
});

// ==================== COMMANDES ====================
app.post('/api/commandes', (req, res) => {
  const {
    client_nom, client_tel, client_adresse, items,
    methode_paiement, reference_paiement, notes_paiement
  } = req.body;

  const total = items.reduce((sum, i) => sum + i.prix * i.quantite, 0);
  const statut_paiement = methode_paiement ? 'en_verification' : 'non_paye';
  const statut = methode_paiement ? 'paiement_en_attente' : 'en_attente';

  db.run(`INSERT INTO commandes 
    (client_nom, client_tel, client_adresse, total, statut, 
     methode_paiement, reference_paiement, statut_paiement, notes_paiement) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [client_nom, client_tel, client_adresse, total, statut,
     methode_paiement, reference_paiement, statut_paiement, notes_paiement || ''],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const commandeId = this.lastID;
      const stmt = db.prepare("INSERT INTO lignes_commande (commande_id, plat_id, quantite, prix_unitaire) VALUES (?, ?, ?, ?)");
      items.forEach(i => stmt.run([commandeId, i.id, i.quantite, i.prix]));
      stmt.finalize();
      res.json({ 
        id: commandeId, total, statut, statut_paiement,
        methode_paiement, reference_paiement
      });
    });
});

app.get('/api/commandes/:id', (req, res) => {
  db.get("SELECT * FROM commandes WHERE id=?", [req.params.id], (err, commande) => {
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
    db.all(`SELECT lc.*, p.nom FROM lignes_commande lc 
            JOIN plats p ON p.id = lc.plat_id WHERE lc.commande_id=?`,
      [commande.id], (err, lignes) => {
        res.json({ ...commande, lignes });
      });
  });
});

// ==================== ADMIN COMMANDES ====================
app.get('/api/admin/commandes', authMiddleware, (req, res) => {
  db.all("SELECT * FROM commandes ORDER BY date_commande DESC", (err, rows) => {
    res.json(rows);
  });
});

app.put('/api/admin/commandes/:id/statut', authMiddleware, (req, res) => {
  const { statut } = req.body;
  db.run("UPDATE commandes SET statut=? WHERE id=?", [statut, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
});

app.put('/api/admin/commandes/:id/valider-paiement', authMiddleware, (req, res) => {
  const { approuve, notes } = req.body;
  const statut_paiement = approuve ? 'paye' : 'refuse';
  const statut = approuve ? 'en_preparation' : 'annulee';

  db.run(`UPDATE commandes 
    SET statut_paiement=?, statut=?, date_paiement=CURRENT_TIMESTAMP, notes_paiement=? 
    WHERE id=?`,
    [statut_paiement, statut, notes || '', req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
});

// Fallback : renvoyer index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
