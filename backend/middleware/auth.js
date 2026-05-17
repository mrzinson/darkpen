const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // Ka raadi token-ka header-ka
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
        return res.status(401).json({ message: 'Ogolaansho la\'aan (No Token)' });
    }

    // Header format waa "Bearer <token>"
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Ogolaansho la\'aan (Invalid Token)' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { id: ... }
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token-ku dhacay ama waa khalad' });
    }
};
