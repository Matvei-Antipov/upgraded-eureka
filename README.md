# USOF Frontend (`розбір` — Developer Q&A Community)

## Short description
**USOF Frontend (`розбір`)** is a responsive Single-Page Application (SPA) built with **React** and **Redux Toolkit** as the client interface for the **USOF Backend** REST API. Inspired by Stack Overflow, the platform allows developers to publish technical questions with Markdown code blocks and screenshots, filter and sort discussions by date, likes, categories, and publication period, post nested answers, vote (like/dislike) on questions and comments, manage personal profiles and avatars, and administer categories, users, and content moderation.

### Key Features
* **Act: Basic**
  * Sticky header with service branding (`</> розбір`), instant search bar, language switcher (**UA / EN**), current user login, role badge (`Guest` / `User` / `Admin`), avatar button leading to the profile page, and sign-in / sign-up / log-out controls on every screen.
  * Left navigation & topic menu bar (`Sidebar`) with quick views and category filtering.
  * Main feed displaying questions with configurable sorting (by date or by likes, ascending/descending), category filter, date-range filter, admin status filter (`active` / `inactive` / `all`), and configurable pagination (page numbers with page-size selector `5 / 10 / 20 / 50` or endless scrolling).
  * Rich question cards with status badge, category tags, publication date, Markdown code & image preview, top-liked answer preview, author chip, and voting counter.
  * Full question page (`PostPage`) with complete metadata, nested comment threads (replying to comments), ascending/descending sorting of comments by likes, inline comment editing, and role-based moderation (activating/deactivating and deleting posts or comments).
  * User profile page (`ProfilePage`) with avatar upload (`PATCH /api/users/avatar`), personal data editing (`PATCH /api/users/:id`), filtering and sorting of the user's own questions, and an **Admin Panel** for full CRUD management of categories (`POST / PATCH / DELETE /api/categories`) and users (`GET / POST / PATCH / DELETE /api/users`).
* **Act: Creative**
  * Social sharing menu for every question (copy direct link `/?post=<id>`, Telegram, Facebook, Instagram).
  * Quick community reactions (`🔥`, `💡`, `❤️`, `👏`) on posts and comments.
  * Personal bookmarks (`Saved Questions`) isolated per user account.
  * Platform statistics view (`visits`, `question views`, `published questions`, `active categories`, `reactions`, `bookmarks`).
  * Live notification banner when another user comments on your question, plus automatic draft saving in the "Ask Question" modal.
  * Global footer with navigation shortcuts and live API connection indicator.

---

## Screenshots of the solution

![API & Backend Verification](./api/assets/screenshot-postman.png)
*REST API endpoints connected to the USOF service.*

![Backend & E2E Terminal Logs](./api/assets/screenshot-terminal.png)
*Server initialization and request logs.*

---

## Requirements and dependencies

### System Requirements
* **Node.js** v18.0+ and **npm** v9+
* **MySQL Server** v8.0+ (for the backend API in `./api`)

### Frontend NPM Dependencies (`./package.json`)
* `react` & `react-dom` — Component-based UI library.
* `@reduxjs/toolkit` & `react-redux` — Centralized state management and async thunks.
* `axios` — HTTP client with JWT request/response interceptors.
* `react-scripts` — Development server, bundler, and proxy configuration (`http://127.0.0.1:5000`).

### Backend NPM Dependencies (`./api/package.json`)
* `express`, `mysql2`, `bcrypt`, `jsonwebtoken`, `multer`, `nodemailer`, `dotenv`.

---

## How to run the solution

Follow these steps from cloning the repository to launching both the API and the React web application locally:

### 1. Clone the repository
```bash
git clone <repository_url>
cd usof-frontend
```

### 2. Configure and start the Backend API (`./api`)
```bash
cd api
npm install
```
Make sure MySQL is running (on macOS/Linux you can use `./start_db.sh`), and verify `api/.env`:
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=test_db
JWT_SECRET=super_secret_jwt_key_2026
SMTP_USER=your_mailtrap_user
SMTP_PASSWORD=your_mailtrap_password
```
Start the API server (it automatically creates the database and tables on startup):
```bash
npm start
```
The API will be available at `http://localhost:5000/api`.

### 3. Install dependencies and start the Frontend (root directory)
Open a second terminal in the repository root (`usof-frontend`):
```bash
npm install
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser. All `/api/*` and `/uploads/*` requests are automatically proxied to `http://127.0.0.1:5000`.

---

## Full-fledged documentation

### Description of progress after every completed CBL stage

* **Engage:** Formulated the core idea of building a clean, developer-oriented interface for the USOF REST API following Don Norman's usability principles (*keeping it simple*, immediate visual feedback, clear affordances, and responsive layout).
* **Investigate:** Analyzed SPA architecture with React and Redux Toolkit, JWT session lifecycle, input validation strategies, XSS-safe Markdown rendering for code snippets and images, and pagination patterns (page-based vs. endless scroll). Audited all backend endpoints in `./api` to align request payloads, role permissions, and error handling.
* **Act (Basic & Creative):**
  1. Configured a unified Axios client (`src/api/client.js`) that attaches `Authorization: Bearer <token>` and handles `401 Unauthorized` session expiration automatically.
  2. Built `authSlice` and `postsSlice` using `createAsyncThunk` to communicate directly with the MySQL-backed API for authentication, users, posts, categories, comments, and likes.
  3. Implemented `Header`, `Sidebar`, `PostFeed`, `PostPage`, `ProfilePage`, `AskQuestionModal`, `AuthModal`, `RichContent`, and `Footer` with bilingual localization (`uk` / `en`) and mobile/tablet media queries.
* **Document & Share:** Documented the architecture, setup instructions, and program algorithm in `README.md`.

### Description of the algorithm of the whole program

1. **Initialization & Session Verification:**
   * When the application mounts (`src/index.js` -> `MainPage.jsx`), Redux initializes `auth` and `posts` slices.
   * `MainPage` dispatches `verifySession()` (validates JWT expiration and loads `/api/users/:id`), `checkApiHealth()` (`GET /api`), `fetchCategories()` (`GET /api/categories`), and `fetchPosts()` (`GET /api/posts`).
   * If the URL contains `?post=<id>`, the application opens that question directly; if it contains a password-reset token (`?token=...` or `/api/auth/password-reset/:token`), `AuthModal` opens in password-reset mode.
2. **Feed Filtering, Sorting, and Pagination (`PostFeed.jsx`):**
   * Whenever sorting (`date` / `likes`), sort order (`DESC` / `ASC`), category (`categoryId`), date interval (`startDate` / `endDate`), or admin status filter (`active` / `inactive` / `all`) changes, `fetchPosts` queries `/api/posts` with the corresponding parameters.
   * Client-side search (`searchQuery`) and the `Unanswered` / `Saved` tabs refine the list in real time.
   * The resulting list is sliced according to `paginationMode` (`pages` or `infinite`) and `limit` (`5 / 10 / 20 / 50`). For visible cards, `fetchPostPreviewComments` loads categories, comments, and like scores in parallel, while `fetchUserById` caches author profiles in `usersMap`.
3. **Question Details & Nested Comments (`PostPage.jsx`):**
   * Clicking a question dispatches `openPostPage(postId)` and `fetchPostDetails(postId)`, which fetches `/api/posts/:id`, `/categories`, `/comments`, and `/like` (plus `/api/comments/:id/like` for each comment).
   * Comments are organized into a logical tree by `buildCommentTree` (`src/utils/comments.js`) using a lightweight `[reply:<parent_id>]` header stored in the comment content so nested threads persist in MySQL across all users and browsers. Each level is sorted by likes (`asc` by default, switchable to `desc`).
4. **Authentication, Profile & Admin Operations (`AuthModal.jsx`, `ProfilePage.jsx`):**
   * Sign-in (`POST /api/auth/login`) stores the JWT and loads the user's profile.
   * On `ProfilePage`, users can upload an avatar (`PATCH /api/users/avatar`), update their full name and email (`PATCH /api/users/:id`), and filter/sort their own publications.
   * Administrators additionally see the Category Management panel (`POST / PATCH / DELETE /api/categories`), the User Management panel (`GET / POST / DELETE /api/users`), and status toggles (`active` / `inactive`) on every post and comment.
