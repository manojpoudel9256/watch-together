const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite file (creates it if missing)
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('SQLite connection error:', err);
    else console.log('Connected to SQLite database.');
});

// Initialize Tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Wrapper to mimic mysql2 promise API: db.query(sql, [params]) -> [rows, fields]
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        const queryType = sql.trim().split(' ')[0].toUpperCase();

        if (queryType === 'SELECT') {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve([rows, null]); // Match mysql2 return signature
            });
        } else {
            // INSERT, UPDATE, DELETE
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve([{ insertId: this.lastID, affectedRows: this.changes }, null]);
            });
        }
    });
}

module.exports = { query };
