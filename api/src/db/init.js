const mysql = require('mysql2/promise');
require('dotenv').config();
const seedDatabase = require('./seed');

async function initDB() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    });

    try {
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
        await connection.query(`USE \`${process.env.DB_NAME}\`;`);
        console.log(`[Database] [INFO] Database '${process.env.DB_NAME}' is ready`);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                login VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                profile_picture VARCHAR(255) DEFAULT 'default-avatar.png',
                rating INT DEFAULT 0,
                role ENUM('admin', 'user') DEFAULT 'user'
            );
        `);
        console.log('[Database] [INFO] Table `users` is ready');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT
            );
        `);
        console.log('[Database] [INFO] Table `categories` is ready');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                author_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                publish_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status ENUM('active', 'inactive') DEFAULT 'active',
                content MEDIUMTEXT NOT NULL,
                FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
        console.log('[Database] [INFO] Table `posts` is ready');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS post_categories (
                post_id INT NOT NULL,
                category_id INT NOT NULL,
                PRIMARY KEY (post_id, category_id),
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            );
        `);
        console.log('[Database] [INFO] Table `post_categories` is ready');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                author_id INT NOT NULL,
                post_id INT NOT NULL,
                publish_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                content MEDIUMTEXT NOT NULL,
                status ENUM('active', 'inactive') DEFAULT 'active',
                FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
            );
        `);
        console.log('[Database] [INFO] Table `comments` is ready');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS likes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                author_id INT NOT NULL,
                publish_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                post_id INT DEFAULT NULL,
                comment_id INT DEFAULT NULL,
                type ENUM('like', 'dislike') NOT NULL,
                FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
                CHECK (
                    (post_id IS NOT NULL AND comment_id IS NULL) OR
                    (post_id IS NULL AND comment_id IS NOT NULL)
                )
            );
        `);
        console.log('[Database] [INFO] Table `likes` is ready');

        try {
            await connection.query(`ALTER TABLE posts MODIFY COLUMN content MEDIUMTEXT NOT NULL;`);
            await connection.query(`ALTER TABLE comments MODIFY COLUMN content MEDIUMTEXT NOT NULL;`);
        } catch (alterErr) {
            // column definition is already up to date
        }

        const [userCountRows] = await connection.query(`SELECT COUNT(*) AS count FROM users;`);
        if (userCountRows[0].count === 0) {
            console.log('[Database] [INFO] Database is empty. Seeding initial test data...');
            await seedDatabase(connection);
        }

    } catch (error) {
        console.error(`[Database] [ERROR] Error initializing database: ${error.message}`);
    } finally {
        await connection.end();
    }
}

module.exports = initDB;
