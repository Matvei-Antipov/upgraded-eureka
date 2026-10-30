const SEED_PASSWORD_HASH = '$2b$10$rTY0hm9ixDz2sBvKef8X6ufGeueUA33drmJEhHP4VgumGIaUg.Ut6';

const users = [
  {
    id: 1,
    login: 'admin',
    password: SEED_PASSWORD_HASH,
    full_name: 'System Administrator',
    email: 'admin@usof.dev',
    profile_picture: 'default-avatar.png',
    rating: 120,
    role: 'admin'
  },
  {
    id: 2,
    login: 'alex_kovalenko',
    password: SEED_PASSWORD_HASH,
    full_name: 'Alex Kovalenko',
    email: 'alex@usof.dev',
    profile_picture: 'default-avatar.png',
    rating: 45,
    role: 'user'
  },
  {
    id: 3,
    login: 'olena_m',
    password: SEED_PASSWORD_HASH,
    full_name: 'Olena Melnyk',
    email: 'olena@usof.dev',
    profile_picture: 'default-avatar.png',
    rating: 38,
    role: 'user'
  },
  {
    id: 4,
    login: 'dmytro_dev',
    password: SEED_PASSWORD_HASH,
    full_name: 'Dmytro Shevchenko',
    email: 'dmytro@usof.dev',
    profile_picture: 'default-avatar.png',
    rating: 22,
    role: 'user'
  },
  {
    id: 5,
    login: 'maria_k',
    password: SEED_PASSWORD_HASH,
    full_name: 'Maria Kravchenko',
    email: 'maria@usof.dev',
    profile_picture: 'default-avatar.png',
    rating: 15,
    role: 'user'
  },
  {
    id: 6,
    login: 'ivan_ts',
    password: SEED_PASSWORD_HASH,
    full_name: 'Ivan Tsybulskyi',
    email: 'ivan@usof.dev',
    profile_picture: 'default-avatar.png',
    rating: 8,
    role: 'user'
  }
];

const categories = [
  {
    id: 1,
    title: 'JavaScript',
    description: 'Core JavaScript syntax, asynchronous programming, event loop and ES6+ features.'
  },
  {
    id: 2,
    title: 'React',
    description: 'React library, component lifecycle, hooks, state management and performance.'
  },
  {
    id: 3,
    title: 'Node.js',
    description: 'Server-side JavaScript runtime, Express framework, streams and file system.'
  },
  {
    id: 4,
    title: 'Databases & SQL',
    description: 'Relational databases, MySQL, PostgreSQL, indexes, transactions and query optimization.'
  },
  {
    id: 5,
    title: 'Security & Auth',
    description: 'JWT, password hashing, CORS, OWASP best practices and API protection.'
  },
  {
    id: 6,
    title: 'CSS & UI/UX',
    description: 'Responsive design, Flexbox, CSS Grid, animations and modern web interfaces.'
  }
];

const posts = [
  {
    id: 1,
    author_id: 2,
    title: 'How to handle race conditions in React useEffect?',
    publish_date: '2026-10-25 10:15:00',
    status: 'active',
    content: 'When fetching data in a component based on props (like user ID or query string), multiple requests might return in an unexpected order.\n\nFor example:\n```javascript\nuseEffect(() => {\n  let isSubscribed = true;\n  fetchUserData(userId).then(data => {\n    if (isSubscribed) setUser(data);\n  });\n  return () => { isSubscribed = false; };\n}, [userId]);\n```\nIs this cleanup flag still recommended in React 19, or should we prefer AbortController?'
  },
  {
    id: 2,
    author_id: 3,
    title: 'Optimizing MySQL queries with composite indexes',
    publish_date: '2026-10-26 14:30:00',
    status: 'active',
    content: 'I have a posts table with author_id, status, and publish_date columns. Queries frequently filter by status and author, then sort by publish_date DESC:\n\n```sql\nSELECT * FROM posts \nWHERE status = \'active\' AND author_id = 42 \nORDER BY publish_date DESC LIMIT 10;\n```\nWhat is the best order of columns in a composite index for this query to avoid filesort?'
  },
  {
    id: 3,
    author_id: 4,
    title: 'Best practices for securing JWT tokens in single-page apps',
    publish_date: '2026-10-27 09:00:00',
    status: 'active',
    content: 'We are building a React SPA with a Node.js REST API. Currently, tokens are stored in localStorage, but there are concerns about XSS vulnerabilities.\n\nWhat are the modern industry standards for storing access and refresh tokens? Is httpOnly cookie with SameSite=Strict better?'
  },
  {
    id: 4,
    author_id: 5,
    title: 'Understanding CSS Grid vs Flexbox for complex dashboard layouts',
    publish_date: '2026-10-28 11:45:00',
    status: 'active',
    content: 'When designing responsive layouts with dynamic sidebars and data cards, when is it better to use CSS Grid over Flexbox?\n\nSpecifically interested in subgrid support and alignment strategies across different screen sizes.'
  },
  {
    id: 5,
    author_id: 6,
    title: 'Node.js memory leak detection in Express applications',
    publish_date: '2026-10-28 18:20:00',
    status: 'active',
    content: 'Our API server memory usage steadily increases over a few days until the process is terminated by the OS. How can we profile heap snapshots in production Node.js without taking the service down?'
  },
  {
    id: 6,
    author_id: 2,
    title: '[Archived] Legacy webpack configuration migration checklist',
    publish_date: '2026-10-29 08:10:00',
    status: 'inactive',
    content: 'This discussion is archived. Summary of steps to migrate from custom webpack 4 configs to modern tooling.'
  }
];

const postCategories = [
  { post_id: 1, category_id: 1 },
  { post_id: 1, category_id: 2 },
  { post_id: 2, category_id: 4 },
  { post_id: 3, category_id: 3 },
  { post_id: 3, category_id: 5 },
  { post_id: 4, category_id: 6 },
  { post_id: 5, category_id: 3 },
  { post_id: 6, category_id: 1 }
];

const comments = [
  {
    id: 1,
    author_id: 3,
    post_id: 1,
    publish_date: '2026-10-25 11:00:00',
    status: 'active',
    content: 'AbortController is definitely cleaner because it actually cancels the network request:\n```javascript\nconst controller = new AbortController();\nfetch(url, { signal: controller.signal });\nreturn () => controller.abort();\n```\nThis also saves client bandwidth.'
  },
  {
    id: 2,
    author_id: 2,
    post_id: 1,
    publish_date: '2026-10-25 11:20:00',
    status: 'active',
    content: '[reply:1]\nThanks Olena! Just need to make sure to catch AbortError so it does not log unhandled errors in console.'
  },
  {
    id: 3,
    author_id: 1,
    post_id: 2,
    publish_date: '2026-10-26 15:10:00',
    status: 'active',
    content: 'Put equality columns first, then range/sort columns:\n```sql\nCREATE INDEX idx_status_author_date ON posts (status, author_id, publish_date DESC);\n```\nThis allows MySQL to satisfy both the WHERE filter and ORDER BY using the index alone.'
  },
  {
    id: 4,
    author_id: 4,
    post_id: 2,
    publish_date: '2026-10-26 15:45:00',
    status: 'active',
    content: '[reply:3]\nTested with EXPLAIN and type changed to \'ref\', filesort disappeared completely. Thanks!'
  },
  {
    id: 5,
    author_id: 3,
    post_id: 3,
    publish_date: '2026-10-27 10:30:00',
    status: 'active',
    content: 'Storing refresh tokens in httpOnly, Secure, SameSite=Strict cookies and keeping access tokens in memory (React state/store) is the most resilient against XSS.'
  },
  {
    id: 6,
    author_id: 6,
    post_id: 4,
    publish_date: '2026-10-28 12:15:00',
    status: 'active',
    content: 'Rule of thumb: CSS Grid is two-dimensional (rows and columns simultaneously), whereas Flexbox is one-dimensional (content in row OR column). For overall dashboard shell, use Grid.'
  },
  {
    id: 7,
    author_id: 1,
    post_id: 5,
    publish_date: '2026-10-28 19:00:00',
    status: 'active',
    content: 'Try running Node with --inspect and connect Chrome DevTools, or use heapdump module triggered by SIGUSR2 signal.'
  },
  {
    id: 8,
    author_id: 5,
    post_id: 5,
    publish_date: '2026-10-28 19:35:00',
    status: 'active',
    content: '[reply:7]\nAlso check for unclosed event listeners or timers retaining closures.'
  }
];

const likes = [
  { id: 1, author_id: 1, post_id: 1, comment_id: null, type: 'like' },
  { id: 2, author_id: 3, post_id: 1, comment_id: null, type: 'like' },
  { id: 3, author_id: 4, post_id: 1, comment_id: null, type: 'like' },
  { id: 4, author_id: 1, post_id: 2, comment_id: null, type: 'like' },
  { id: 5, author_id: 2, post_id: 2, comment_id: null, type: 'like' },
  { id: 6, author_id: 2, post_id: 3, comment_id: null, type: 'like' },
  { id: 7, author_id: 3, post_id: 3, comment_id: null, type: 'like' },
  { id: 8, author_id: 2, post_id: null, comment_id: 1, type: 'like' },
  { id: 9, author_id: 4, post_id: null, comment_id: 3, type: 'like' },
  { id: 10, author_id: 5, post_id: null, comment_id: 3, type: 'like' },
  { id: 11, author_id: 6, post_id: null, comment_id: 5, type: 'like' },
  { id: 12, author_id: 3, post_id: 6, comment_id: null, type: 'dislike' }
];

module.exports = {
  users,
  categories,
  posts,
  postCategories,
  comments,
  likes
};
