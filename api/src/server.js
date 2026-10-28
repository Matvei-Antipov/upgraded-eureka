require('dotenv').config();
const app = require('./app');
const initDB = require('./db/init');

const PORT = process.env.PORT || 3000;

initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`[Server] [INFO] Server is running on port ${PORT}`);
        console.log(`[Server] [HINT] Base API URL is http://localhost:${PORT}/api`);
    });
}).catch(err => {
    console.error(`[Server] [ERROR] Failed to start application: ${err.message}`);
});