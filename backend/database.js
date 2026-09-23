const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/data/restaurant.db'
  : path.join(__dirname, 'restaurant.db');

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS plats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    description TEXT,
    prix REAL NOT NULL,
    categorie TEXT NOT NULL,
    image TEXT,
    disponible INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS commandes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_nom TEXT NOT NULL,
    client_tel TEXT NOT NULL,
    client_adresse TEXT,
    total REAL NOT NULL,
    statut TEXT DEFAULT 'en_attente',
    methode_paiement TEXT,
    reference_paiement TEXT,
    statut_paiement TEXT DEFAULT 'non_paye',
    date_paiement DATETIME,
    notes_paiement TEXT,
    date_commande DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS lignes_commande (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commande_id INTEGER,
    plat_id INTEGER,
    quantite INTEGER,
    prix_unitaire REAL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS config_paiement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operateur TEXT UNIQUE,
    numero TEXT,
    nom_titulaire TEXT,
    actif INTEGER DEFAULT 1
  )`);

  // Plats par défaut
  db.get("SELECT COUNT(*) as count FROM plats", (err, row) => {
    if (row && row.count === 0) {
      const plats = [
        ['Pizza Margherita', 'Tomate, mozzarella, basilic', 12.50, 'Pizza', '🍕'],
        ['Burger Royal', 'Bœuf, cheddar, salade, tomate', 14.00, 'Burger', '🍔'],
        ['Pâtes Carbonara', 'Crème, lardons, parmesan', 13.00, 'Pâtes', '🍝'],
        ['Salade César', 'Poulet, croûtons, parmesan', 10.50, 'Salade', '🥗'],
        ['Tiramisu', 'Dessert italien classique', 6.50, 'Dessert', '🍰'],
        ['Coca-Cola', 'Boisson 33cl', 3.00, 'Boisson', '🥤']
      ];
      const stmt = db.prepare("INSERT INTO plats (nom, description, prix, categorie, image) VALUES (?, ?, ?, ?, ?)");
      plats.forEach(p => stmt.run(p));
      stmt.finalize();
    }
  });

  // Opérateurs paiement par défaut
  db.get("SELECT COUNT(*) as count FROM config_paiement", (err, row) => {
    if (row && row.count === 0) {
      const ops = [
        ['Nita', '87773340', 'Mon Restaurant'],
        ['Amana', '82424509', 'Mon Restaurant'],
        ['Wave', '87773340', 'Mon Restaurant']
      ];
      const stmt = db.prepare("INSERT INTO config_paiement (operateur, numero, nom_titulaire) VALUES (?, ?, ?)");
      ops.forEach(o => stmt.run(o));
      stmt.finalize();
    }
  });
});

module.exports = db;