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
 * GET /api/admin/programas
 * List all academic programs
 */
router.get('/programas', auth, rbac('admin'), (req, res) => {
    const db = getDB();
    try {
        const programas = db.prepare('SELECT id, nombre, facultad FROM programas WHERE activo = 1 ORDER BY nombre').all();
        res.json(programas);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/users
 * List all users with optional search
 */
router.get('/users', auth, rbac('admin'), (req, res) => {
    const { search } = req.query;
    const db = getDB();

    let query = `
        SELECT p.id, p.nombres, p.apellidos, p.email, p.username, p.rol, p.documento, 
               p.activo, p.telefono, p.fecha_nacimiento, p.tipo_documento, p.metadata,
               COALESCE(e.programa_id, pr.id) as programa_id
        FROM personas p
        LEFT JOIN estudiantes e ON p.id = e.persona_id
        LEFT JOIN programas pr ON p.id = pr.director_id
    `;
    const params = [];

    if (search) {
        query += ' WHERE p.nombres LIKE ? OR p.apellidos LIKE ? OR p.documento LIKE ? OR p.username LIKE ?';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY p.id DESC LIMIT 200';

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
        documento, tipo_documento, telefono, fecha_nacimiento, metadata, programa_id
    } = req.body;

    if (!nombres || !email || !username || !password || !rol) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const db = getDB();
    const password_hash = bcrypt.hashSync(password, 10);
    const metaString = metadata ? JSON.stringify(metadata) : '{}';

    try {
        db.transaction(() => {
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

            const newUserId = result.lastInsertRowid;

            // Vincular al programa según el rol
            if (rol === 'estudiante') {
                const codigo = documento || username; // Generar código por defecto si no existe
                db.prepare(`
                    INSERT INTO estudiantes (persona_id, programa_id, codigo, semestre_actual, estado)
                    VALUES (?, ?, ?, 1, 'activo')
                `).run(newUserId, programa_id || null, codigo);
            } else if (rol === 'director' && programa_id) {
                db.prepare(`UPDATE programas SET director_id = ? WHERE id = ?`).run(newUserId, programa_id);
            }
            
            res.status(201).json({ id: newUserId, message: 'Usuario creado exitosamente' });
        })();
    } catch (err) {
        console.error('Error creando usuario:', err);
        res.status(500).json({ error: 'Error al crear usuario (posible duplicado o error de base de datos)' });
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
        telefono, fecha_nacimiento, activo, metadata, programa_id
    } = req.body;
    const db = getDB();

    try {
        // Prevent disabling the master admin account (admin.ti)
        const user = db.prepare('SELECT username FROM personas WHERE id = ?').get(id);
        if (user && user.username === 'admin.ti' && activo === false) {
            return res.status(400).json({ error: 'No se puede deshabilitar el usuario administrador maestro (admin.ti)' });
        }

        const metaString = metadata ? JSON.stringify(metadata) : '{}';

        db.transaction(() => {
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

            // Actualizar vinculaciones según rol
            if (rol === 'estudiante' && programa_id) {
                const est = db.prepare('SELECT id FROM estudiantes WHERE persona_id = ?').get(id);
                if (est) {
                    db.prepare('UPDATE estudiantes SET programa_id = ? WHERE persona_id = ?').run(programa_id, id);
                } else {
                    const codigo = documento || user.username;
                    db.prepare(`
                        INSERT INTO estudiantes (persona_id, programa_id, codigo, semestre_actual, estado)
                        VALUES (?, ?, ?, 1, 'activo')
                    `).run(id, programa_id, codigo);
                }
            } else if (rol === 'director' && programa_id) {
                // Primero quitarlo como director de cualquier otro programa para evitar conflictos
                db.prepare('UPDATE programas SET director_id = NULL WHERE director_id = ?').run(id);
                // Luego asignarlo al nuevo
                db.prepare('UPDATE programas SET director_id = ? WHERE id = ?').run(id, programa_id);
            }

            res.json({ message: 'Usuario actualizado exitosamente' });
        })();
    } catch (err) {
        console.error('Error actualizando usuario:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/reset-password-bulk', auth, rbac('admin'), (req, res) => {
    const { userIds, newPassword } = req.body;
    if (!userIds || !Array.isArray(userIds) || !newPassword) {
        return res.status(400).json({ error: 'IDs de usuario y nueva contraseña requeridos' });
    }

    const db = getDB();
    
    // Check if admin.ti is in the userIds
    const adminUser = db.prepare('SELECT id FROM personas WHERE username = "admin.ti"').get();
    if (adminUser && userIds.includes(adminUser.id)) {
        return res.status(403).json({ error: 'Restricción: No se puede editar la contraseña del usuario Admin.TI' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);

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
