# USOF (Ucode Stack Overflow)

## Short description
**USOF** is a full-stack Q&A web application for developers similar to Stack Overflow. The project combines a single-page React frontend with a Node.js and Express REST API. Users can register, log in with JWT, recover passwords via email, ask questions, select categories, write comments and replies, vote with likes and dislikes, bookmark posts, and manage their profile. The backend uses MySQL with raw SQL queries without any ORM.

![API Routes in Postman](./api/assets/screenshot-postman.png)
*Postman request example.*

![E2E Testing Logs](./api/assets/screenshot-terminal.png)
*Server terminal logs.*

## Technology stack
* **Frontend:** React 19, Redux Toolkit, React-Redux, Axios, CSS (Flexbox / Grid).
* **Backend:** Node.js (v18+), Express 5.
* **Database:** MySQL 8.0 (`mysql2/promise` connection pool, raw SQL queries).
* **Authentication & Security:** JSON Web Tokens (`jsonwebtoken`), `bcrypt` password hashing.
* **Files & Mail:** `multer` for avatar uploads, `nodemailer` (Mailtrap SMTP) for password reset emails.

## Requirements and dependencies
To run the project locally you need:
* Node.js (v18 or higher)
* MySQL Server (v8.0 or higher)
* Web browser (Chrome, Firefox, Safari, or Edge)
* Mailtrap account (for password reset emails)

**Frontend dependencies (`package.json`):**
* `react`, `react-dom` - UI components and rendering
* `@reduxjs/toolkit`, `react-redux` - state management (`authSlice`, `postsSlice`)
* `axios` - HTTP requests to the backend API
* `react-scripts` - dev server and build scripts

**Backend dependencies (`api/package.json`):**
* `express` - routing and middleware
* `mysql2` - MySQL connection pool and queries
* `bcrypt` - password hashing
* `jsonwebtoken` - JWT generation and verification
* `multer` - avatar file uploads
* `nodemailer` - sending password reset emails
* `dotenv` - environment variables
* `nodemon` - auto-restart during development

## How to run the solution
1. **Clone the repository:**
   ```bash
   git clone ssh://git@git.green-lms.app:22022/challenge-665/mantipov-12264.git
   cd usof-frontend
   ```
2. **Set up the backend (`./api`):**
   ```bash
   cd api
   npm install
   ```
   Create a `.env` file inside `api/`:
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
3. **Start the backend server:**
   Tables are created automatically on startup (`http://localhost:3000`).
   ```bash
   npm run dev
   ```
4. **Start the frontend (`usof-frontend/`):**
   Open a second terminal in the project root:
   ```bash
   npm install
   PORT=3001 npm start
   ```
   Open `http://localhost:3001` in the browser. Requests to `/api` and `/uploads` are proxied to `http://localhost:3000`.

## Non-functional requirements (Нефункціональні вимоги)

1. **Продуктивність**
   * Час відповіді сервера на типові запити API (`GET /api/posts`, `POST /api/posts`, `POST /api/posts/:id/like`) не перевищує 200 мс у звичайному режимі та 1.5 с при навантаженні до 500 одночасних користувачів.
   * Початкове завантаження сторінки застосунку займає до 2.5 с при швидкості інтернету 10 Мбіт/с.
   * Розмір файлу аватара обмежено до 5 МБ, а вбудовані зображення у питаннях стискаються на клієнті до ширини 480 px.
   * *Перевірка:* вкладка Network і Lighthouse у Chrome DevTools, заміри часу у Postman.

2. **Безпека**
   * Паролі зберігаються у БД у вигляді хешів `bcrypt` (10 раундів солі).
   * Доступ до захищених ендпоінтів здійснюється за допомогою JWT-токенів (термін дії 24 години) через заголовок `Authorization: Bearer <token>`.
   * Перевірка ролей (`user`, `admin`) та автора запису виконується на бекенді в `authMiddleware` та контролерах.
   * Усі SQL-запити виконуються через параметризовані вирази (`?`), що захищає від SQL-ін'єкцій.
   * *Перевірка:* тестування захищених маршрутів без токена (401) і без прав адміністратора (403) через Postman.

3. **Надійність**
   * Зовнішні ключі у таблицях БД мають правило `ON DELETE CASCADE`, а таблиця `likes` має перевірку `CHECK`, щоб уникнути некоректних записів.
   * При запуску сервера функція `initDB()` автоматично створює базу даних і всі таблиці, якщо їх ще немає.
   * Чернетка нового питання зберігається у `localStorage`, тому текст не втрачається при випадковому оновленні вкладки.
   * *Перевірка:* перезапуск сервера і перевірка збереження даних у MySQL та чернетки у браузері.

4. **Масштабованість**
   * Сервер не зберігає сесії в оперативній пам'яті (використовується JWT), тому можна запускати кілька екземплярів Node.js-сервера.
   * Стрічка питань підтримує пагінацію з вибором кількості елементів на сторінці (5, 10, 20, 50) або режим підвантаження кнопкою.
   * *Перевірка:* робота стрічки питань при різних значеннях `page` та `limit`.

5. **Зручність використання**
   * Адаптивна верстка для десктопів, планшетів (до 900 px) і смартфонів (до 520 px).
   * Підтримка двох мов інтерфейсу (українська та англійська) з перемиканням у шапці сайту.
   * Валідація всіх полів форм із підказками про помилки та спливаючими тост-повідомленнями. Оцінка зручності за шкалою SUS становить понад 75 балів зі 100, базові елементи відповідають рівню A стандарту WCAG 2.1.
   * *Перевірка:* режим мобільних пристроїв у Chrome DevTools та перевірка форм з порожніми/некоректними полями.

## UML diagrams and database schema

### 1. Use-Case Diagram (Діаграма варіантів використання)
![Use-Case Diagram](./docs/diagrams/01-use-case-diagram.svg)

### 2. Component Diagram (Діаграма компонентів)
![Component Diagram](./docs/diagrams/02-component-diagram.svg)

### 3. Deployment Diagram (Діаграма розгортання)
![Deployment Diagram](./docs/diagrams/03-deployment-diagram.svg)

### 4. Activity Diagram (Діаграма діяльності)
![Activity Diagram](./docs/diagrams/04-activity-diagram.svg)

### 5. Sequence Diagram (Діаграма послідовності дій)
![Sequence Diagram](./docs/diagrams/05-sequence-diagram.svg)

### 6. Database Schema (Схема бази даних)
![Database ER Schema](./docs/diagrams/06-database-schema.svg)

## Full-fledged documentation

### Description of progress after every completed CBL stage
* **Engage:** Studied the task requirements for the frontend and backend parts of USOF. Planned the page structure (`Header`, `Sidebar`, `PostFeed`, `PostPage`, `ProfilePage`, `AskQuestionModal`, `AuthModal`, `Footer`), user roles (Guest, User, Admin), and UML diagrams for the project.
* **Investigate:** Chose Redux Toolkit for managing application state and Axios for API requests. Looked into JWT token handling on the client, form validation rules, pagination options, nested comment replies, and responsive CSS layout for mobile and desktop screens.
* **Act:** Built all components and connected them to the Express + MySQL API. Added sorting by likes and date, filtering by category, date interval, and status, pagination (pages and load more), question creation and editing with code blocks and images, nested comments, voting and rating calculation, user profile editing with avatar upload, and admin tools for managing users and categories.

### Description of the algorithm of the whole program
1. **Database and server startup:** When `api/src/server.js` starts, `initDB()` connects to MySQL and creates the database and tables (`users`, `categories`, `posts`, `post_categories`, `comments`, `likes`) if they do not exist. After that, Express starts listening on port `3000`.
2. **App initialization:** When the browser opens the React app (`src/index.js` -> `MainPage.jsx`), Redux initializes `authSlice` and `postsSlice`. If a JWT token is found in `localStorage`, the app checks its expiration and requests the current user's profile (`GET /api/users/:id`).
3. **Loading the feed:** `PostFeed` loads categories (`GET /api/categories`) and posts (`GET /api/posts`), applying the selected sort order, category filter, date interval, and pagination settings. For visible posts, it also fetches their categories, comment count/preview, and like score.
4. **Sending authenticated requests:** When an authorized user creates a post, leaves a comment, votes, or edits their profile, the Axios interceptor in `src/api/client.js` adds the `Authorization: Bearer <token>` header. On the backend, `authMiddleware` checks the token and user role, returning `401` or `403` if access is denied.
5. **Database queries:** The matching controller (`AuthController`, `UserController`, `PostController`, `CategoryController`, `CommentController`, `LikeController`) validates input data and calls model methods (`api/src/models/`) to run SQL queries through the MySQL pool.
6. **Updating the UI:** After the server responds with JSON, Redux updates the store state, recalculates user ratings, shows a notification toast, and re-renders the updated components on screen.
