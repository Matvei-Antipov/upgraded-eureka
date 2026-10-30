-- USOF Database Schema and Seed Data
-- Database: test_db

CREATE DATABASE IF NOT EXISTS `test_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `test_db`;

-- 1. Table: users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    login VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    profile_picture VARCHAR(255) DEFAULT 'default-avatar.png',
    rating INT DEFAULT 0,
    role ENUM('admin', 'user') DEFAULT 'user'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table: categories
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table: posts
CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    author_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    publish_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'inactive') DEFAULT 'active',
    content MEDIUMTEXT NOT NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Table: post_categories
CREATE TABLE IF NOT EXISTS post_categories (
    post_id INT NOT NULL,
    category_id INT NOT NULL,
    PRIMARY KEY (post_id, category_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Table: comments
CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    author_id INT NOT NULL,
    post_id INT NOT NULL,
    publish_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    content MEDIUMTEXT NOT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Table: likes
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed: users (password for all test accounts: password123)
INSERT INTO users (id, login, password, full_name, email, profile_picture, rating, role) VALUES
(1, 'admin', '$2b$10$rTY0hm9ixDz2sBvKef8X6ufGeueUA33drmJEhHP4VgumGIaUg.Ut6', 'System Administrator', 'admin@usof.dev', 'default-avatar.png', 120, 'admin'),
(2, 'alex_kovalenko', '$2b$10$rTY0hm9ixDz2sBvKef8X6ufGeueUA33drmJEhHP4VgumGIaUg.Ut6', 'Alex Kovalenko', 'alex@usof.dev', 'default-avatar.png', 45, 'user'),
(3, 'olena_m', '$2b$10$rTY0hm9ixDz2sBvKef8X6ufGeueUA33drmJEhHP4VgumGIaUg.Ut6', 'Olena Melnyk', 'olena@usof.dev', 'default-avatar.png', 38, 'user'),
(4, 'dmytro_dev', '$2b$10$rTY0hm9ixDz2sBvKef8X6ufGeueUA33drmJEhHP4VgumGIaUg.Ut6', 'Dmytro Shevchenko', 'dmytro@usof.dev', 'default-avatar.png', 22, 'user'),
(5, 'maria_k', '$2b$10$rTY0hm9ixDz2sBvKef8X6ufGeueUA33drmJEhHP4VgumGIaUg.Ut6', 'Maria Kravchenko', 'maria@usof.dev', 'default-avatar.png', 15, 'user'),
(6, 'ivan_ts', '$2b$10$rTY0hm9ixDz2sBvKef8X6ufGeueUA33drmJEhHP4VgumGIaUg.Ut6', 'Ivan Tsybulskyi', 'ivan@usof.dev', 'default-avatar.png', 8, 'user')
ON DUPLICATE KEY UPDATE login=VALUES(login);

-- Seed: categories
INSERT INTO categories (id, title, description) VALUES
(1, 'JavaScript', 'Core JavaScript syntax, asynchronous programming, event loop and ES6+ features.'),
(2, 'React', 'React library, component lifecycle, hooks, state management and performance.'),
(3, 'Node.js', 'Server-side JavaScript runtime, Express framework, streams and file system.'),
(4, 'Databases & SQL', 'Relational databases, MySQL, PostgreSQL, indexes, transactions and query optimization.'),
(5, 'Security & Auth', 'JWT, password hashing, CORS, OWASP best practices and API protection.'),
(6, 'CSS & UI/UX', 'Responsive design, Flexbox, CSS Grid, animations and modern web interfaces.')
ON DUPLICATE KEY UPDATE title=VALUES(title);

-- Seed: posts
INSERT INTO posts (id, author_id, title, publish_date, status, content) VALUES
(1, 2, 'How to handle race conditions in React useEffect?', '2026-10-25 10:15:00', 'active', 'When fetching data in a component based on props (like user ID or query string), multiple requests might return in an unexpected order.\n\nFor example:\n```javascript\nuseEffect(() => {\n  let isSubscribed = true;\n  fetchUserData(userId).then(data => {\n    if (isSubscribed) setUser(data);\n  });\n  return () => { isSubscribed = false; };\n}, [userId]);\n```\nIs this cleanup flag still recommended in React 19, or should we prefer AbortController?'),
(2, 3, 'Optimizing MySQL queries with composite indexes', '2026-10-26 14:30:00', 'active', 'I have a posts table with author_id, status, and publish_date columns. Queries frequently filter by status and author, then sort by publish_date DESC:\n\n```sql\nSELECT * FROM posts \nWHERE status = \'active\' AND author_id = 42 \nORDER BY publish_date DESC LIMIT 10;\n```\nWhat is the best order of columns in a composite index for this query to avoid filesort?'),
(3, 4, 'Best practices for securing JWT tokens in single-page apps', '2026-10-27 09:00:00', 'active', 'We are building a React SPA with a Node.js REST API. Currently, tokens are stored in localStorage, but there are concerns about XSS vulnerabilities.\n\nWhat are the modern industry standards for storing access and refresh tokens? Is httpOnly cookie with SameSite=Strict better?'),
(4, 5, 'Understanding CSS Grid vs Flexbox for complex dashboard layouts', '2026-10-28 11:45:00', 'active', 'When designing responsive layouts with dynamic sidebars and data cards, when is it better to use CSS Grid over Flexbox?\n\nSpecifically interested in subgrid support and alignment strategies across different screen sizes.'),
(5, 6, 'Node.js memory leak detection in Express applications', '2026-10-28 18:20:00', 'active', 'Our API server memory usage steadily increases over a few days until the process is terminated by the OS. How can we profile heap snapshots in production Node.js without taking the service down?'),
(6, 2, '[Archived] Legacy webpack configuration migration checklist', '2026-10-29 08:10:00', 'inactive', 'This discussion is archived. Summary of steps to migrate from custom webpack 4 configs to modern tooling.')
ON DUPLICATE KEY UPDATE title=VALUES(title);

-- Seed: post_categories
INSERT IGNORE INTO post_categories (post_id, category_id) VALUES
(1, 1),
(1, 2),
(2, 4),
(3, 3),
(3, 5),
(4, 6),
(5, 3),
(6, 1);

-- Seed: comments
INSERT INTO comments (id, author_id, post_id, publish_date, content, status) VALUES
(1, 3, 1, '2026-10-25 11:00:00', 'AbortController is definitely cleaner because it actually cancels the network request:\n```javascript\nconst controller = new AbortController();\nfetch(url, { signal: controller.signal });\nreturn () => controller.abort();\n```\nThis also saves client bandwidth.', 'active'),
(2, 2, 1, '2026-10-25 11:20:00', '[reply:1]\nThanks Olena! Just need to make sure to catch AbortError so it does not log unhandled errors in console.', 'active'),
(3, 1, 2, '2026-10-26 15:10:00', 'Put equality columns first, then range/sort columns:\n```sql\nCREATE INDEX idx_status_author_date ON posts (status, author_id, publish_date DESC);\n```\nThis allows MySQL to satisfy both the WHERE filter and ORDER BY using the index alone.', 'active'),
(4, 4, 2, '2026-10-26 15:45:00', '[reply:3]\nTested with EXPLAIN and type changed to \'ref\', filesort disappeared completely. Thanks!', 'active'),
(5, 3, 3, '2026-10-27 10:30:00', 'Storing refresh tokens in httpOnly, Secure, SameSite=Strict cookies and keeping access tokens in memory (React state/store) is the most resilient against XSS.', 'active'),
(6, 6, 4, '2026-10-28 12:15:00', 'Rule of thumb: CSS Grid is two-dimensional (rows and columns simultaneously), whereas Flexbox is one-dimensional (content in row OR column). For overall dashboard shell, use Grid.', 'active'),
(7, 1, 5, '2026-10-28 19:00:00', 'Try running Node with --inspect and connect Chrome DevTools, or use heapdump module triggered by SIGUSR2 signal.', 'active'),
(8, 5, 5, '2026-10-28 19:35:00', '[reply:7]\nAlso check for unclosed event listeners or timers retaining closures.', 'active')
ON DUPLICATE KEY UPDATE content=VALUES(content);

-- Seed: likes
INSERT INTO likes (id, author_id, post_id, comment_id, type) VALUES
(1, 1, 1, NULL, 'like'),
(2, 3, 1, NULL, 'like'),
(3, 4, 1, NULL, 'like'),
(4, 1, 2, NULL, 'like'),
(5, 2, 2, NULL, 'like'),
(6, 2, 3, NULL, 'like'),
(7, 3, 3, NULL, 'like'),
(8, 2, NULL, 1, 'like'),
(9, 4, NULL, 3, 'like'),
(10, 5, NULL, 3, 'like'),
(11, 6, NULL, 5, 'like'),
(12, 3, 6, NULL, 'dislike')
ON DUPLICATE KEY UPDATE type=VALUES(type);
