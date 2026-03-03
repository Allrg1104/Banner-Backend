const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { getDB } = require('../database/db');
const bcrypt = require('bcryptjs');

/**
 * Admin TI Routes - Gestión total
 */

/**
 * GET /api/admin/users
 * List all users with optional search
 */
router.get('/users', auth, rbac('admin'), (req, res) => {
    const { search } = req.query;
    const db = getDB();

    let query = 'SELECT id, nombres, apellidos, email, username, rol, documento, activo, telefono, fecha_nacimiento, tipo_documento, metadata FROM personas';
    const params = [];

    if (search) {
        query += ' WHERE nombres LIKE ? OR apellidos LIKE ? OR documento LIKE ? OR username LIKE ?';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY id DESC LIMIT 200';

    try {
        const users = db.prepare(query).all(...params);
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/admin/users
 * Create a new user
 */
router.post('/users', auth, rbac('admin'), (req, res) => {
    const {
        nombres, apellidos, email, username, password, rol,
        documento, tipo_documento, telefono, fecha_nacimiento, metadata
    } = req.body;

    if (!nombres || !email || !username || !password || !rol) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const db = getDB();
    const password_hash = bcrypt.hashSync(password, 10);
    const metaString = metadata ? JSON.stringify(metadata) : '{}';

    try {
        const result = db.prepare(`
            INSERT INTO personas (
                nombres, apellidos, email, username, password_hash, rol, 
                documento, tipo_documento, telefono, fecha_nacimiento, metadata, must_change_password
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
            nombres, apellidos, email, username, password_hash, rol,
            documento, tipo_documento || 'CC', telefono, fecha_nacimiento, metaString
        );

        res.status(201).json({ id: result.lastInsertRowid, message: 'Usuario creado exitosamente' });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear usuario (posible duplicado de email/username)' });
    }
});

/**
 * PUT /api/admin/users/:id
 * Update user profile
 */
router.put('/users/:id', auth, rbac('admin'), (req, res) => {
    const { id } = req.params;
    const {
        nombres, apellidos, email, rol, documento, tipo_documento,
        telefono, fecha_nacimiento, activo, metadata
    } = req.body;
    const db = getDB();

    try {
        // Prevent disabling the master admin account (admin.ti)
        const user = db.prepare('SELECT username FROM personas WHERE id = ?').get(id);
        if (user && user.username === 'admin.ti' && activo === false) {
            return res.status(400).json({ error: 'No se puede deshabilitar el usuario administrador maestro (admin.ti)' });
        }

        const metaString = metadata ? JSON.stringify(metadata) : '{}';

        db.prepare(`
            UPDATE personas 
            SET nombres = ?, apellidos = ?, email = ?, rol = ?, documento = ?, 
                tipo_documento = ?, telefono = ?, fecha_nacimiento = ?, 
                activo = ?, metadata = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(
            nombres, apellidos, email, rol, documento,
            tipo_documento, telefono, fecha_nacimiento,
            activo ? 1 : 0, metaString, id
        );

        res.json({ message: 'Usuario actualizado exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/reset-password-bulk', auth, rbac('admin'), (req, res) => {
    const { userIds, newPassword } = req.body;
    if (!userIds || !Array.isArray(userIds) || !newPassword) {
        return res.status(400).json({ error: 'IDs de usuario y nueva contraseña requeridos' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    const db = getDB();

    const stmt = db.prepare('UPDATE personas SET password_hash = ?, must_change_password = 1 WHERE id = ?');
    const bulk = db.transaction((ids) => {
        for (const id of ids) stmt.run(hashedPassword, id);
    });

    try {
        bulk(userIds);
        res.json({ message: `Se restableció la contraseña para ${userIds.length} usuarios` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/system-stats', auth, rbac('admin'), (req, res) => {
    const db = getDB();
    try {
        const stats = db.prepare(`
            SELECT 
                COUNT(*) as total_users,
                SUM(CASE WHEN rol = 'estudiante' THEN 1 ELSE 0 END) as total_students,
                SUM(CASE WHEN rol = 'docente' THEN 1 ELSE 0 END) as total_teachers,
                SUM(CASE WHEN activo = 1 THEN 1 ELSE 0 END) as active_users,
                (SELECT COUNT(*) FROM matriculas) as total_enrollments
            FROM personas
        `).get();
        res.json(stats);
    } catch (err) {
        console.error('[DEBUG] System Stats Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
