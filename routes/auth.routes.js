const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const cryptoJS = require('crypto-js');
const { getDB } = require('../database/db');
const { sendPasswordResetEmail } = require('../services/email.service');
const auth = require('../middleware/auth');

/**
 * POST /api/auth/login
 */
router.post('/login', (req, res) => {
    let { username, password, data } = req.body;

    if (data) {
        try {
            const secret = 'banner-secret-key-2024';
            const bytes = cryptoJS.AES.decrypt(data, secret);
            const decryptedData = JSON.parse(bytes.toString(cryptoJS.enc.Utf8));
            username = decryptedData.username;
            password = decryptedData.password;
        } catch (e) {
            return res.status(400).json({ error: 'Payload de datos corrupto o inválido' });
        }
    }

    if (!username || !password) return res.status(400).json({ error: 'Username y password requeridos' });

    const db = getDB();

    const user = db.prepare('SELECT * FROM personas WHERE username = ? OR email = ?').get(username, username);

    if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!user.activo) {
        return res.status(401).json({ error: 'Usuario inactivo' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);

    if (!valid) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
        { id: user.id, username: user.username, rol: user.rol },
        process.env.JWT_SECRET || 'secret_dev',
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
        token,
        user: {
            id: user.id,
            nombres: user.nombres,
            apellidos: user.apellidos,
            username: user.username,
            email: user.email,
            rol: user.rol,
            must_change_password: !!user.must_change_password
        }
    });
});

/**
 * GET /api/auth/me
 * Retorna los datos actuales del usuario autenticado
 */
router.get('/me', auth, (req, res) => {
    const db = getDB();
    const user = db.prepare('SELECT id, nombres, apellidos, username, email, rol, documento, tipo_documento, telefono, fecha_nacimiento, activo, metadata, must_change_password FROM personas WHERE id = ?').get(req.user.id);
    
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    // Convertir booleano para consistencia con login
    user.must_change_password = !!user.must_change_password;
    
    res.json(user);
});

/**
 * POST /api/auth/request-password-change
 * Inicia flujo de cambio de contraseña con confirmación por email
 */
router.post('/request-password-change', auth, async (req, res) => {
    const db = getDB();
    const user = db.prepare('SELECT id, email, nombres FROM personas WHERE id = ?').get(req.user.id);

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60000).toISOString(); // 15 min

    db.prepare(`
    INSERT INTO password_resets (user_id, token, expires_at)
    VALUES (?, ?, ?)
  `).run(user.id, token, expiresAt);

    try {
        await sendPasswordResetEmail(user.email, user.nombres, token);
        res.json({ message: 'Se ha enviado un correo de confirmación' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error enviando el correo' });
    }
});

/**
 * POST /api/auth/confirm-password-change
 */
router.post('/confirm-password-change', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token y nueva contraseña requeridos' });

    const db = getDB();
    const reset = db.prepare('SELECT * FROM password_resets WHERE token = ? AND used = 0').get(token);

    if (!reset || new Date(reset.expires_at) < new Date()) {
        return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    db.transaction(() => {
        db.prepare('UPDATE personas SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hashedPassword, reset.user_id);
        db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(reset.id);
    })();

    res.json({ message: 'Contraseña actualizada correctamente' });
});

/**
 * POST /api/auth/change-password
 * Direct change for authenticated users
 */
router.post('/change-password', auth, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    const db = getDB();
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    try {
        db.prepare('UPDATE personas SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hashedPassword, req.user.id);
        res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar la contraseña' });
    }
});
// Ruta de Olvido de Contraseña (sin autenticación)
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    const db = getDB();

    if (!email) {
        return res.json({ message: 'Si el correo existe, se enviará un enlace' });
    }

    const user = db.prepare(`
        SELECT id, email, nombres 
        FROM personas 
        WHERE email = ? OR username = ?
    `).get(email, email);

    // ⚠️ Esto es importante por seguridad
    if (!user) {
        return res.json({ message: 'Si el correo existe, se enviará un enlace' });
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60000).toISOString();

    db.prepare(`
        INSERT INTO password_resets (user_id, token, expires_at)
        VALUES (?, ?, ?)
    `).run(user.id, token, expiresAt);

    try {
        await sendPasswordResetEmail(user.email, user.nombres, token);
    } catch (err) {
        console.error('Error enviando correo de recuperación:', err);
    }

    res.json({ message: 'Si el correo existe, se enviará un enlace' });
});

module.exports = router;
