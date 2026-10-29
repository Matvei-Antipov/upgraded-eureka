# USOF (Ucode Stack Overflow — rozbir)

## Short description
**USOF (Ucode Stack Overflow / rozbir)** is a full-stack Q&A web platform for developers similar to Stack Overflow, combining an interactive single-page frontend application (SPA) with a RESTful backend API service. The platform manages user registration, JWT-based authentication, password recovery via email, creating and categorizing technical questions, nested comment discussions with Markdown and code blocks, an automated user rating system (likes/dislikes and community reactions), configurable content pagination, and role-based administration. Built with **React** and **Redux Toolkit** on the client side and **Node.js**, **Express**, and **MySQL** (using parameterized SQL queries without ORMs) on the server side.

![API Routes in Postman](./api/assets/screenshot-postman.png)
*An example of an API request via Postman showing the project in use.*

![E2E Testing Logs](./api/assets/screenshot-terminal.png)
*Terminal logs.*

---

## Technology Stack (Стек використаних технологій)

| Layer | Technology | Version / Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | **React** (`react`, `react-dom`) | `v19.2` — Component-based SPA architecture, hooks, custom modals, responsive Flexbox/Grid UI |
| **State Management** | **Redux Toolkit** (`@reduxjs/toolkit`, `react-redux`) | `v2.11` — Centralized normalized state (`authSlice`, `postsSlice`) and async thunks |
| **HTTP Client** | **Axios** | `v1.15` — REST API client with JWT `Bearer` request interceptor and `401` session expiration handling |
| **Localization (i18n)** | Custom Dictionary (`uk` / `en`) | Instant interface & server message switching between Ukrainian and English |
| **Backend Runtime & API** | **Node.js** + **Express** | `v18+` / `Express v5.1` — RESTful MVC architecture, routing, and static media serving (`/uploads`) |
| **Database (RDBMS)** | **MySQL 8.0** + `mysql2/promise` | Connection pooling, auto-initialization (`initDB`), parameterized SQL queries (`ON DELETE CASCADE`) |
| **Security & Auth** | **JWT** (`jsonwebtoken`) + **bcrypt** | Stateless token authentication (`24h` TTL) and salted password hashing (`10` salt rounds) |
| **File Uploads & Mail** | **Multer** + **Nodemailer** (Mailtrap) | Avatar image validation/storage (up to `5 MB`) and SMTP password reset token delivery |

---

## Requirements and dependencies
The following components must be installed on your machine to build and run the project:

**System Requirements:**
* Node.js (v18 or higher)
* MySQL Server (v8.0 or higher)
* Modern web browser (Chrome, Firefox, Safari, or Edge)
* A Mailtrap account for testing the password reset functionality

**NPM Dependencies (Frontend):**
* `react` & `react-dom` — Component-based library for building the user interface.
* `@reduxjs/toolkit` & `react-redux` — Centralized state management and asynchronous thunks (`authSlice`, `postsSlice`).
* `axios` — HTTP client with request/response interceptors for communicating with the REST API.
* `react-scripts` — Build, bundling, and development server tooling with API proxy support.

**NPM Dependencies (Backend — `./api`):**
* `express` — Web framework for routing.
* `mysql2` — MySQL driver for executing database queries.
* `bcrypt` — Utility for secure password hashing.
* `jsonwebtoken` — Generates and verifies JWT tokens for authorization.
* `multer` — Middleware for handling image uploads.
* `nodemailer` — Module for sending emails.
* `dotenv` — Manages environment variables.
* `nodemon` (dev) — Automatically restarts the server during development.

---

## How to run the solution
Follow these steps from cloning the repository to the first launch of the full-stack application:

1. **Clone the repository:**
   ```bash
   git clone ssh://git@git.green-lms.app:22022/challenge-665/mantipov-12264.git
   cd usof-frontend
   ```
2. **Install and configure the Backend API (`./api`):**
   ```bash
   cd api
   npm install
   ```
   Create a `.env` file inside the `api/` directory and add the following variables:
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=test_db
   JWT_SECRET=your_secret_key
   SMTP_USER=your_mailtrap_user
   SMTP_PASSWORD=your_mailtrap_password
   ```
3. **Start the Backend server:**
   The database schema and required tables will be initialized automatically upon startup on `http://localhost:3000`.
   ```bash
   npm run dev
   ```
4. **Install and start the Frontend application:**
   Open a new terminal window in the root project directory (`usof-frontend/`):
   ```bash
   npm install
   PORT=3001 npm start
   ```
   The web application will open in your browser at `http://localhost:3001` and automatically proxy `/api` and `/uploads` requests to `http://localhost:3000`.

---

## Non-Functional Requirements (Нефункціональні вимоги)

Відповідно до методичних рекомендацій, для системи **USOF** визначено конкретні вимірювані нефункціональні вимоги та критерії їх перевірки:

### 1. Продуктивність (Performance)
* **Час відгуку API:** час обробки REST-запиту сервером (`GET /api/posts`, `POST /api/posts`, `POST /api/posts/:id/like`) не перевищує **200 мс** при стандартному навантаженні та **≤ 1.5 с** при одночасній роботі до **500 активних користувачів** завдяки використанню пулу з'єднань `mysql2/promise` (`connectionLimit: 10`).
* **Швидкість завантаження SPA:** перше завантаження клієнтського бандла (`~131 КБ` після gzip) та рендеринг головної стрічки відбувається не довше **2.5 с** при швидкості з'єднання **10 Мбіт/с**.
* **Оптимізація трафіку:** клієнтське стиснення зображень у публікаціях до ширини **480 px** (JPEG quality `0.58`) та обмеження розміру аватара до **5 МБ**.
* *Метод перевірки:* Chrome DevTools (Network / Performance, Lighthouse), Postman Response Time metrics.

### 2. Безпека (Security)
* **Хешування паролів:** паролі користувачів ніколи не зберігаються у відкритому вигляді — використовується криптографічний алгоритм **bcrypt** із сіллю (**10 раундів**).
* **Автентифікація та авторизація:** захищені маршрути вимагають валідний **JWT-токен** (`HS256`, термін дії **24 години**) у заголовку `Authorization: Bearer <token>`. Розмежування прав доступу реалізовано на рівні мідлварів (`verifyToken`, `isAdmin`) та перевірки власника ресурсу (`author_id === req.user.userId`).
* **Захист від SQL-ін'єкцій та XSS:** усі запити до БД виконуються виключно через параметризовані підготовлені вирази (`Prepared Statements` із плейсхолдерами `?`), а клієнтський текст рендериться через безпечні React-компоненти без `dangerouslySetInnerHTML`.
* *Метод перевірки:* E2E/Postman-тестування захищених маршрутів без токена (`401 Unauthorized`), з чужим токеном (`403 Forbidden`) та перевірка записів таблиці `users` у MySQL.

### 3. Надійність та цілісність даних (Reliability)
* **Референційна цілісність БД:** усі зовнішні ключі у таблицях `posts`, `post_categories`, `comments`, `likes` налаштовані з каскадним видаленням (`ON DELETE CASCADE`), а таблиця `likes` має обмеження `CHECK` для поліморфних зв'язків, що унеможливлює появу «сирітських» записів.
* **Автоматичне відновлення схеми:** під час старту бекенду модуль `initDB()` автоматично перевіряє наявність бази даних та всіх 6 таблиць (`CREATE TABLE IF NOT EXISTS`).
* **Контроль стану з'єднання:** фронтенд періодично перевіряє доступність сервера (`checkApiHealth`) та відображає індикатор стану API у футері, а також автоматично зберігає чернетку нового питання у `localStorage`.
* *Метод перевірки:* перезапуск сервера БД/API під час роботи застосунку, перевірка збереження чернетки після оновлення сторінки.

### 4. Масштабованість (Scalability)
* **Stateless-архітектура API:** використання JWT-токенів замість серверних сесій у пам'яті дозволяє горизонтально масштабувати Node.js-сервер за балансувальником навантаження до **5 000+ одночасних підключень**.
* **Керована пагінація:** підтримка посторінкової навігації та нескінченного скролу з налаштовуваним лімітом (**5, 10, 20 або 50** публікацій на сторінку) запобігає перевантаженню DOM-дерева браузера при зростанні бази питань.
* *Метод перевірки:* тестування рендерингу стрічки при зміні параметрів `limit` та `page`.

### 5. Зручність використання та доступність (Usability & Localization)
* **Адаптивний інтерфейс (Responsive Design):** верстка автоматично адаптується під десктопні монітори (`> 900px`), планшети (`≤ 900px`) та мобільні пристрої (`≤ 520px`).
* **Двомовна локалізація (UA / EN):** миттєве перемикання мови інтерфейсу та серверних повідомлень (українська / англійська) без перезавантаження сторінки.
* **Зворотний зв'язок та доступність:** семантична розмітка (`role="dialog"`, `aria-modal`, `aria-label`), миттєва валідація форм і система інформативних тост-сповіщень забезпечують оцінку зручності за шкалою **SUS > 80 балів зі 100** та відповідність базовим критеріям **WCAG 2.1 Level A**.
* *Метод перевірки:* перевірка у Chrome DevTools Device Toolbar (`375px`, `768px`, `1440px`) та аудит Lighthouse Accessibility.

---

## UML 2.5 Diagrams & Database Schema (Діаграми проєкту)

Усі діаграми побудовано відповідно до стандарту **UML 2.5** та методичних вказівок кафедри. Векторні файли діаграм зберігаються у директорії [`./docs/diagrams/`](./docs/diagrams/).

### 1. Діаграма варіантів використання (Use–Case Diagram)
Відображає три рівні акторів (**Гість**, **Авторизований користувач**, **Адміністратор**), пов'язаних відношенням узагальнення (`Generalization`), межі системи та основні варіанти використання зі зв'язками `«include»` і `«extend»`.

![Use-Case Diagram](./docs/diagrams/01-use-case-diagram.svg)

---

### 2. Діаграма компонентів (Component Diagram)
Ілюструє модульну структуру клієнтської підсистеми (`USOF Frontend SPA`) та серверної підсистеми (`USOF Backend API`), порти взаємодії, надані (`Provided`) і необхідні (`Required`) інтерфейси та залежності від зовнішніх сервісів (**MySQL 8**, **SMTP**).

![Component Diagram](./docs/diagrams/02-component-diagram.svg)

---

### 3. Діаграма розгортання (Deployment Diagram)
Показує фізичне розгортання артефактів і програмних компонентів по апаратних вузлах (`Client Browser :3001`, `Application Web Server :3000`, `DB Server :3306`, `Mail Server :2525`) та мережеві протоколи взаємодії між ними (`HTTP / REST JSON`, `TCP/IP`, `SMTP / TLS`).

![Deployment Diagram](./docs/diagrams/03-deployment-diagram.svg)

---

### 4. Діаграма діяльності (Activity Diagram)
Моделює наскрізний бізнес-процес створення нової публікації з поділом на три доріжки відповідальності (`Swimlanes`: **Користувач**, **Клієнтський стор**, **Бекенд сервер**), умовами перевірки авторизації/валідації та паралельним збереженням даних (`Fork / Join`).

![Activity Diagram](./docs/diagrams/04-activity-diagram.svg)

---

### 5. Діаграма послідовності дій (Sequence Diagram)
Деталізує хронологічний порядок обміну синхронними викликами та відповідями між об'єктами `:AskQuestionModal`, `:postsSlice`, `:authMiddleware`, `:PostController`, `:PostModel` та `:Database`, включно з обробкою виключень у фреймі `break`.

![Sequence Diagram](./docs/diagrams/05-sequence-diagram.svg)

---

### 6. Схема бази даних (Database ER Diagram)
Відображає реляційну схему бази даних **MySQL 8.0**, що складається з 6 таблиць (`users`, `posts`, `categories`, `post_categories`, `comments`, `likes`), первинних (`PK`) і зовнішніх (`FK`) ключів та кардинальностей зв'язків (`1:N`, `M:N`).

![Database ER Schema](./docs/diagrams/06-database-schema.svg)

---

## Full-fledged documentation

### Description of progress after every completed CBL stage
The development process followed the Challenge Based Learning framework:

* **Engage:** Analyzed the functional, non-functional, and UX requirements for a developer Q&A platform. Designed the full-stack architecture connecting a responsive React + Redux single-page application (SPA) with an MVC RESTful backend (`./api`) backed by a relational MySQL database. Formalized the system behavior and structure using UML 2.5 diagrams (Use-Case, Component, Deployment, Activity, Sequence) and planned role permissions for Guests, Users, and Administrators.
* **Investigate:** Researched SPA state synchronization using Redux Toolkit and asynchronous thunks, JWT session persistence, and Axios interceptors for token injection and automatic expiration handling. Investigated client-side input validation, responsive Flexbox/Grid layouts across mobile, tablet, and desktop viewports, pagination strategies (numbered pages vs. endless scrolling), and secure backend interaction using prepared SQL statements in `mysql2/promise`, `multer` avatar uploads, and `nodemailer` SMTP recovery flows.
* **Act:** Implemented the complete frontend interface and integrated all backend API endpoints. Built the global header with instant search, language switcher (UA/EN), user role/login/avatar display, and logout control on every view. Implemented the main question feed with sorting (by date or likes), filtering (by category, date interval, and active/inactive status), configurable pagination, and top-answer previews. Created the full question page with nested comment replies, ascending/descending like sorting, Markdown code blocks, image attachments, social sharing, bookmarks, and platform statistics, as well as the user profile and administrator management panels.

### Description of the algorithm of the whole program
The full-stack application operates based on the following algorithm:

1. **Startup & Database Initialization:** When the backend server starts (`api/src/server.js`), it executes `initDB()`, connecting to MySQL and automatically creating the database and relational tables (`users`, `categories`, `posts`, `post_categories`, `comments`, `likes`) if they do not exist. The Express server then listens on port `3000`.
2. **Client Initialization & Session Hydration:** When the user opens the React application (`src/index.js` -> `MainPage.jsx`), the Redux store (`authSlice` and `postsSlice`) initializes. The client checks `localStorage` for an active JWT token, verifies its expiration, and dispatches `verifySession()` (`GET /api/users/:id`) and `checkApiHealth()` (`GET /api`) to hydrate the authenticated user's profile and confirm API connectivity.
3. **Feed Loading, Filtering & Pagination:** `PostFeed` dispatches `fetchCategories()` (`GET /api/categories`) and `fetchPosts()` (`GET /api/posts`) with sorting (`date` or `likes`), sort order (`DESC`/`ASC`), category filter, date range (`startDate`/`endDate`), and status parameters. For visible publications, `fetchPostPreviewComments()` loads associated categories (`GET /api/posts/:id/categories`), comments (`GET /api/posts/:id/comments`), and vote scores (`GET /api/posts/:id/like`), rendering bounded previews and paginating results via either page numbers or endless scrolling.
4. **Request Interception & Middleware Processing:** When a user performs a protected action (creating/editing a post, commenting, voting, updating profile data, or using the admin panel), the centralized Axios client (`src/api/client.js`) attaches the `Authorization: Bearer <token>` header. On the backend, `authMiddleware` (`verifyToken`, `optionalAuth`, `isAdmin`) validates the JWT signature and checks role permissions, returning `401` or `403` if unauthorized.
5. **Controllers & Database Persistence:** Validated requests reach the corresponding Express controllers (`AuthController`, `UserController`, `PostController`, `CategoryController`, `CommentController`, `LikeController`), which invoke model methods (`api/src/models/`) to execute parameterized SQL queries against the MySQL connection pool and return JSON responses.
6. **Reactive State Update & UI Rendering:** Upon receiving the HTTP response, Redux Toolkit `extraReducers` update the normalized client state (`items`, `categories`, `currentPostComments`, `postLikesMap`, `commentLikesMap`, `usersMap`), dynamically recalculating user ratings and triggering immediate re-renders and toast notifications without reloading the browser page.
