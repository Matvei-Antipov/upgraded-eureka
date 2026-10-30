const mysql = require('mysql2/promise');
require('dotenv').config();
const { users, categories, posts, postCategories, comments, likes } = require('./seedData');

async function seedDatabase(connection) {
  let shouldClose = false;
  if (!connection) {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'test_db'
    });
    shouldClose = true;
  }

  try {
    for (const u of users) {
      await connection.query(
        `INSERT INTO users (id, login, password, full_name, email, profile_picture, rating, role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE login=VALUES(login), password=VALUES(password), full_name=VALUES(full_name), email=VALUES(email), rating=VALUES(rating), role=VALUES(role)`,
        [u.id, u.login, u.password, u.full_name, u.email, u.profile_picture, u.rating, u.role]
      );
    }

    for (const c of categories) {
      await connection.query(
        `INSERT INTO categories (id, title, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description)`,
        [c.id, c.title, c.description]
      );
    }

    for (const p of posts) {
      await connection.query(
        `INSERT INTO posts (id, author_id, title, publish_date, status, content)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE author_id=VALUES(author_id), title=VALUES(title), publish_date=VALUES(publish_date), status=VALUES(status), content=VALUES(content)`,
        [p.id, p.author_id, p.title, p.publish_date, p.status, p.content]
      );
    }

    for (const pc of postCategories) {
      await connection.query(
        `INSERT IGNORE INTO post_categories (post_id, category_id) VALUES (?, ?)`,
        [pc.post_id, pc.category_id]
      );
    }

    for (const cm of comments) {
      await connection.query(
        `INSERT INTO comments (id, author_id, post_id, publish_date, content, status)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE author_id=VALUES(author_id), post_id=VALUES(post_id), publish_date=VALUES(publish_date), content=VALUES(content), status=VALUES(status)`,
        [cm.id, cm.author_id, cm.post_id, cm.publish_date, cm.content, cm.status]
      );
    }

    for (const lk of likes) {
      await connection.query(
        `INSERT INTO likes (id, author_id, post_id, comment_id, type)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE type=VALUES(type)`,
        [lk.id, lk.author_id, lk.post_id, lk.comment_id, lk.type]
      );
    }

    console.log('[Seed] [SUCCESS] All 6 tables populated with test data (users, categories, posts, post_categories, comments, likes).');
  } catch (err) {
    console.error(`[Seed] [ERROR] Seeding failed: ${err.message}`);
    throw err;
  } finally {
    if (shouldClose) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seedDatabase;
