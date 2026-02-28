const jwt = require('jsonwebtoken');
const { getDB } = require('../database/db');

module.exports = function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret_dev');
        // Verificar que el usuario sigue activo
        const db = getDB();
        const user = db.prepare('SELECT id,rol,activo FROM personas WHERE id=?').get(payload.id);
        if (!user || !user.activo) {
            return res.status(401).json({ error: 'Usuario inactivo o no encontrado' });
        }
        req.user = { id: payload.id, username: payload.username, rol: user.rol };
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};
