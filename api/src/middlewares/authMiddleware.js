const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(403).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1]; 
    if (!token) {
        return res.status(403).json({ error: 'Malformed token' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        req.user = decoded;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Require Admin Role' });
    }
};

const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (!err) req.user = decoded; 
            next();
        });
    } else {
        next(); 
    }
};

module.exports = { verifyToken, isAdmin, optionalAuth };