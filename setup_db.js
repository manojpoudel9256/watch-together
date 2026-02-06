const mysql = require('mysql2/promise');

async function setup() {
    try {
        // Connect to MySQL (Root, no password default for XAMPP)
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: ''
        });

        console.log("Connected to MySQL.");

        // Create Database
        await connection.query(`CREATE DATABASE IF NOT EXISTS watch_together`);
        console.log("Database 'watch_together' checked/created.");

        // Use Database
        await connection.query(`USE watch_together`);

        // Create Users Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Table 'users' ready.");

        // Create Rooms Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log("Table 'rooms' ready.");

        // Seed some rooms
        await connection.query(`INSERT IGNORE INTO rooms (name) VALUES ('Lobby'), ('Movie Night'), ('Music Lounge')`);
        console.log("Seeded default rooms.");

        await connection.end();
        console.log("Setup complete.");
    } catch (err) {
        console.error("Setup failed:", err);
    }
}

setup();
