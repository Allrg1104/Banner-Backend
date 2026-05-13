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

router.get('/salones/estructura', auth, rbac('registro', 'admin'), (req, res) => {
    const db = getDB();
    try {
        const sedes = db.prepare('SELECT * FROM sedes').all();
        const bloques = db.prepare('SELECT * FROM bloques').all();
        const salones = db.prepare('SELECT * FROM salones').all();
        
        const result = sedes.map(sede => {
            const sedeBloques = bloques.filter(b => b.sede_id === sede.id).map(bloque => {
                const bloqueSalones = salones.filter(s => s.bloque_id === bloque.id);
                return { ...bloque, salones: bloqueSalones };
            });
            return { ...sede, bloques: sedeBloques };
        });
        
        console.log(`[DEBUG] /salones/estructura: Encontradas ${sedes.length} sedes`);
        res.json(result);
    } catch (err) {
        console.error(`[ERROR] /salones/estructura: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

router.get('/salones/:salon_id/ocupacion', auth, rbac('registro', 'admin'), (req, res) => {
    const db = getDB();
    try {
        const salon = db.prepare('SELECT * FROM salones WHERE id = ?').get(req.params.salon_id);
        if (!salon) return res.status(404).json({ error: 'Salón no encontrado' });

        const activePeriod = db.prepare('SELECT id FROM periodos WHERE activo = 1').get();
        if (!activePeriod) return res.json([]);

        const ocupacion = db.prepare(`
            SELECT c.id as curso_id, c.horario, m.nombre as asignatura, m.codigo as nrc, p.nombres, p.apellidos
            FROM cursos c
            JOIN materias m ON c.materia_id = m.id
            JOIN personas p ON c.docente_id = p.id
            WHERE c.salon_id = ? AND c.periodo_id = ? AND c.estado = 'activo'
        `).all(salon.id, activePeriod.id);

        res.json(ocupacion);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/salones/asignar', auth, rbac('registro', 'admin'), (req, res) => {
    const { curso_id, salon_id, horario } = req.body;
    const db = getDB();
    try {
        // Validación de conflictos simples por texto de horario
        const conflict = db.prepare(`
            SELECT id FROM cursos 
            WHERE salon_id = ? AND horario = ? AND id != ? AND periodo_id = (SELECT id FROM periodos WHERE activo = 1)
            AND estado = 'activo'
        `).get(salon_id, horario, curso_id || 0);

        if (conflict) {
            return res.status(400).json({ error: 'El salón ya está ocupado en ese horario.' });
        }

        db.prepare('UPDATE cursos SET salon_id = ?, horario = ? WHERE id = ?').run(salon_id, horario, curso_id);
        db.save();
        res.json({ message: 'Asignación guardada correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/cursos/activos', auth, rbac('registro', 'admin'), (req, res) => {
    const db = getDB();
    try {
        const activePeriod = db.prepare('SELECT id FROM periodos WHERE activo = 1').get();
        if (!activePeriod) return res.json([]);

        const cursos = db.prepare(`
            SELECT c.id, m.nombre as asignatura, m.codigo as nrc, p.nombres, p.apellidos, c.horario, c.salon_id
            FROM cursos c
            JOIN materias m ON c.materia_id = m.id
            JOIN personas p ON c.docente_id = p.id
            WHERE c.periodo_id = ? AND c.estado = 'activo'
        `).all(activePeriod.id);
        res.json(cursos);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Update password functionality for Registro Académico
router.post('/reset-password-user', auth, rbac('registro', 'admin'), (req, res) => {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
        return res.status(400).json({ error: 'ID de usuario y nueva contraseña requeridos' });
    }

    const db = getDB();
    const targetUser = db.prepare('SELECT username FROM personas WHERE id = ?').get(userId);
    if (!targetUser) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (targetUser.username === 'admin.ti') {
        return res.status(403).json({ error: 'Restricción: No se puede editar la contraseña del usuario Admin.TI' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    try {
        db.prepare('UPDATE personas SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(hashedPassword, userId);
        res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
