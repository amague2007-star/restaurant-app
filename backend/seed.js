const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db'); 
const db = new sqlite3.Database(dbPath);

db.serialize(async () => {
    db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);

    const hash = await bcrypt.hash('12345678', 10);

    db.run(`INSERT OR REPLACE INTO admins (id, username, password) VALUES (?, ?, ?)`, [1, 'admin', hash], (err) => {
        if (err) console.error(err.message);
        else console.log("Compte admin cree !");
        db.close();
    });
});
