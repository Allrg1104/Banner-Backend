const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDB } = require('../database/db');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { sendTempPasswordEmail } = require('../services/email.service');

/**
 * Gestión de Usuarios por Registro Académico
 */

router.get('/users', auth, rbac('registro', 'admin'), (req, res) => {
    const db = getDB();
    const users = db.prepare('SELECT id, nombres, apellidos, email, username, rol, activo, documento, metadata FROM personas').all();
    res.json(users);
});

router.post('/users', auth, rbac('registro', 'admin'), async (req, res) => {
    const { nombres, apellidos, email, rol, documento } = req.body;
    const username = email.split('@')[0];
    const tempPass = Math.random().toString(36).slice(-8); // Random temp password
    const hashedPassword = bcrypt.hashSync(tempPass, 10);

    const db = getDB();
    try {
        const info = db.prepare(`
      INSERT INTO personas (nombres, apellidos, email, username, password_hash, rol, documento, must_change_password)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(nombres, apellidos, email, username, hashedPassword, rol, documento);

        const userId = info.lastInsertRowid;

        // Si es estudiante, crear perfil académico
        if (rol === 'estudiante') {
            db.prepare("INSERT INTO estudiantes (persona_id, codigo) VALUES (?, ?)").run(userId, `EST-${Date.now().toString().slice(-6)}`);
        }

        await sendTempPasswordEmail(email, nombres, username, tempPass);
        res.json({ message: 'Usuario creado y notificación enviada', userId, username, tempPass });
    } catch (err) {
        res.status(400).json({ error: 'Error creando usuario (posible email duplicado)' });
    }
});

router.put('/users/:id', auth, rbac('registro', 'admin'), (req, res) => {
    const { nombres, apellidos, rol, activo, metadata, documento, tipo_documento, telefono, fecha_nacimiento } = req.body;
    const db = getDB();
    db.prepare(`
    UPDATE personas SET nombres=?, apellidos=?, rol=?, activo=?, metadata=?, documento=?, tipo_documento=?, telefono=?, fecha_nacimiento=?
    WHERE id=?
  `).run(
        nombres,
        apellidos,
        rol,
        activo !== undefined ? (activo ? 1 : 0) : 1,
        metadata ? (typeof metadata === 'object' ? JSON.stringify(metadata) : metadata) : '{}',
        documento,
        tipo_documento || 'CC',
        telefono,
        fecha_nacimiento,
        req.params.id
    );
    res.json({ message: 'Usuario actualizado' });
});

module.exports = router;
