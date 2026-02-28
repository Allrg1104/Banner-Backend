/**
 * RBAC - Role Based Access Control
 * Uso: router.get('/ruta', auth, rbac('admin','registro'), handler)
 */
module.exports = function rbac(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        if (!roles.includes(req.user.rol)) {
            return res.status(403).json({
                error: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}`,
                tu_rol: req.user.rol
            });
        }
        next();
    };
};
