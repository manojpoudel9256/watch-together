const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

let db;
let type = 'sqlite';

if (process.env.DATABASE_URL) {
    type = 'postgres';
    db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    console.log('Connected to PostgreSQL.');
    initPostgres();
} else {
    type = 'sqlite';
    const dbPath = path.resolve(__dirname, 'database.sqlite');
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error('SQLite error:', err);
        else console.log('Connected to SQLite.');
    });
    initSqlite();
}

function initPostgres() {
    const usersTable = `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password TEXT NOT NULL
    );`;
    const roomsTable = `CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`;
    db.query(usersTable).catch(err => console.error('PG Init Error:', err));
    db.query(roomsTable).catch(err => console.error('PG Init Error:', err));
}

function initSqlite() {
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
}

// Wrapper to mimic mysql2 promise API
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (type === 'postgres') {
            // Convert ? to $1, $2, etc.
            let i = 1;
            const pgSql = sql.replace(/\?/g, () => `$${i++}`);

            db.query(pgSql, params)
                .then(res => {
                    // For SELECT, res.rows is the array.
                    // For INSERT, res.rowCount is useful, but current app ignores return of INSERT.
                    resolve([res.rows, res.fields]);
                })
                .catch(reject);
        } else {
            // SQLite
            const queryType = sql.trim().split(' ')[0].toUpperCase();
            if (queryType === 'SELECT') {
                db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve([rows, null]);
                });
            } else {
                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else resolve([{ insertId: this.lastID, affectedRows: this.changes }, null]);
                });
            }
        }
    });
}

module.exports = { query };
