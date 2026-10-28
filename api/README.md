# USOF Backend (Ucode Stack Overflow)

## Short description
**USOF Backend** is a RESTful API service for a Q&A platform similar to Stack Overflow, serving as a back-end solution that handles application logic. The program manages user registration, JWT-based authentication, creating posts and categories, writing comments, and a rating system (likes/dislikes). Built with Node.js and Express, it uses a MySQL relational database with raw SQL queries, completely avoiding ORMs.

![API Routes in Postman](./assets/screenshot-postman.png)
*An example of an API request via Postman showing the project in use.*

![E2E Testing Logs](./assets/screenshot-terminal.png)
*Terminal logs.*

## Requirements and dependencies
The following components must be installed on your machine to build and run the project:

**System Requirements:**
* Node.js (v18 or higher)
* MySQL Server (v8 or higher)
* A Mailtrap account for testing the password reset functionality

**NPM Dependencies:**
* `express` — Web framework for routing.
* `mysql2` — MySQL driver for executing database queries.
* `bcrypt` — Utility for secure password hashing.
* `jsonwebtoken` — Generates and verifies JWT tokens for authorization.
* `multer` — Middleware for handling image uploads.
* `nodemailer` — Module for sending emails.
* `dotenv` — Manages environment variables.
* `nodemon` (dev) — Automatically restarts the server during development.

## How to run the solution
Follow these steps from cloning the repository to the first launch of the program:

1. **Clone the repository:**
   ```bash
   git clone <repository_link>
   cd usof-backend
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure environment variables:**
   Create a `.env` file in the root directory and add the following variables:
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
4. **Run the program:**
   The database schema and required tables will be initialized automatically upon startup.
   ```bash
   npm run dev
   ```

## Full-fledged documentation

### Description of progress after every competed CBL stage
The development process followed the Challenge Based Learning framework:

* **Engage:** Analyzed the technical requirements to build a functional Q&A API. Designed the MVC architecture (Model-View-Controller) and structured a strict relational database schema. This included many-to-many relationships for posts/categories and polymorphic relations for likes.
* **Investigate:** Researched stateless JWT authentication mechanisms. Investigated secure database practices using `mysql2/promise` with prepared statements to prevent SQL injections, as ORMs were prohibited. Explored file system operations for avatar uploads via `multer` and SMTP protocols via `nodemailer`.
* **Act:** Implemented core modules for users, posts, categories, comments, and likes. Developed flexible middlewares for role-based access control (Admin, User, Guest). Created custom Node.js End-to-End (E2E) testing scripts to verify business logic and edge cases directly in the console, confirming the application's stability.

### Description of the algorithm of the whole program
The application operates based on the following algorithm:

1. **Startup & Initialization:** When the application starts (`server.js`), it calls the asynchronous `initDB()` function. This connects to MySQL, checks for the database and tables, and executes table creation queries if necessary. The Express server then begins listening on the specified port.
2. **Routing:** A client sends an HTTP request. The `app.js` file routes this request to the appropriate router in the `routes/` directory based on the URL path.
3. **Middleware Processing:** Protected routes trigger the `authMiddleware`. The server extracts the JWT from the headers, verifies it, and attaches the decoded user data to the request object. If the token is missing or permissions are insufficient, the algorithm halts and returns a 401 or 403 status code.
4. **Controllers (Business Logic):** The request reaches the appropriate controller, which extracts and validates the parameters. Invalid data triggers a 400 Bad Request error.
5. **Models (Database Interaction):** For valid requests, the controller calls static methods from the `models/` directory. These models encapsulate raw SQL queries, executing them securely via the connection pool, and return the data.
6. **Response:** The controller receives the data from the model, logs the successful action to the server console, and sends an HTTP JSON response with the relevant status code back to the client.