const express = require('express');
const router = express.Router();
const { getDB } = require('../database/db');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { getStudentDashboardMetrics } = require('../services/analytics.service');

// Listar periodos donde el estudiante tiene matrículas
router.get('/periodos', auth, (req, res) => {
    const db = getDB();
    const studentId = req.user.id;

    try {
        const periods = db.prepare(`
            SELECT DISTINCT p.id, p.nombre, p.activo 
            FROM periodos p
            JOIN cursos c ON p.id = c.periodo_id
            JOIN matriculas m ON c.id = m.curso_id
            WHERE m.estudiante_id = ?
            ORDER BY p.fecha_inicio DESC
        `).all(studentId);
        res.json(periods);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Solo estudiantes o admin/registro/director/decano pueden ver el dashboard de un estudiante
router.get('/:id/dashboard', auth, (req, res) => {
    const targetId = parseInt(req.params.id);
    const periodoId = req.query.periodoId ? parseInt(req.query.periodoId) : null;

    // Seguridad: Estudiante solo ve el suyo. Otros roles (ver rbac) pueden ver cualquiera.
    if (req.user.rol === 'estudiante' && req.user.id !== targetId) {
        return res.status(403).json({ error: 'No tienes permiso para ver este dashboard' });
    }

    try {
        const metrics = getStudentDashboardMetrics(targetId, periodoId);
        res.json(metrics);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id/grades', auth, (req, res) => {
    const targetId = parseInt(req.params.id);
    if (req.user.rol === 'estudiante' && req.user.id !== targetId) return res.status(403).json({ error: 'Acceso denegado' });

    const db = getDB();
    const grades = db.prepare(`
    SELECT mat.nombre as materia, c.componente, c.valor, c.porcentaje, c.fecha
    FROM matriculas m
    JOIN calificaciones c ON m.id = c.matricula_id
    JOIN cursos cu ON m.curso_id = cu.id
    JOIN materias mat ON cu.materia_id = mat.id
    JOIN periodos p ON cu.periodo_id = p.id
    WHERE m.estudiante_id = ? AND p.activo = 1
    ORDER BY mat.nombre, c.fecha
  `).all(targetId);

    res.json(grades);
});

router.get('/:id/attendance', auth, (req, res) => {
    const targetId = parseInt(req.params.id);
    if (req.user.rol === 'estudiante' && req.user.id !== targetId) return res.status(403).json({ error: 'Acceso denegado' });

    const db = getDB();
    const attendance = db.prepare(`
    SELECT mat.nombre as materia, a.fecha, a.tipo, a.observacion
    FROM matriculas m
    JOIN asistencia a ON m.id = a.matricula_id
    JOIN cursos cu ON m.curso_id = cu.id
    JOIN materias mat ON cu.materia_id = mat.id
    JOIN periodos p ON cu.periodo_id = p.id
    WHERE m.estudiante_id = ? AND p.activo = 1
    ORDER BY a.fecha DESC
  `).all(targetId);

    res.json(attendance);
});

router.get('/:id/activity', auth, (req, res) => {
    const targetId = parseInt(req.params.id);
    if (req.user.rol === 'estudiante' && req.user.id !== targetId) return res.status(403).json({ error: 'Acceso denegado' });

    const db = getDB();
    try {
        const activity = db.prepare(`
            SELECT * FROM (
                SELECT 'Calificación: ' || comp.componente || ' - ' || mat.nombre as actividad,
                       comp.fecha as fecha,
                       comp.valor || ' / 5.0' as resultado,
                       'grade' as tipo
                FROM calificaciones comp
                JOIN matriculas m ON comp.matricula_id = m.id
                JOIN cursos c ON m.curso_id = c.id
                JOIN materias mat ON c.materia_id = mat.id
                WHERE m.estudiante_id = ?
                
                UNION ALL
                
                SELECT 'Asistencia: ' || mat.nombre as actividad,
                       a.fecha as fecha,
                       CASE WHEN a.tipo = 'presente' THEN 'Presente' ELSE 'Ausente' END as resultado,
                       'attendance' as tipo
                FROM asistencia a
                JOIN matriculas m ON a.matricula_id = m.id
                JOIN cursos c ON m.curso_id = c.id
                JOIN materias mat ON c.materia_id = mat.id
                WHERE m.estudiante_id = ?
            )
            ORDER BY fecha DESC LIMIT 10
        `).all(targetId, targetId);

        res.json(activity);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/reseed-debug', (req, res) => {
    const db = getDB();
    try {
        const santiago = db.prepare('SELECT id FROM personas WHERE email LIKE ?').get('%santiago.espinosa01%');
        if (!santiago) return res.status(404).send('Santiago no encontrado');
        const santiagoId = santiago.id;

        // --- LIMPIEZA PROFUNDA ---
        db.prepare('DELETE FROM calificaciones WHERE matricula_id IN (SELECT id FROM matriculas WHERE estudiante_id = ?)').run(santiagoId);
        db.prepare('DELETE FROM asistencia WHERE matricula_id IN (SELECT id FROM matriculas WHERE estudiante_id = ?)').run(santiagoId);
        db.prepare('DELETE FROM matriculas WHERE estudiante_id = ?').run(santiagoId);
        
        // Borrar periodos y materias de prueba anteriores para evitar duplicados/conflictos
        db.prepare('DELETE FROM periodos WHERE id IN (1, 2)').run();
        db.prepare('DELETE FROM materias WHERE id >= 990').run();
        db.prepare('DELETE FROM cursos WHERE id >= 1 AND id <= 5').run();
        db.prepare('DELETE FROM cursos WHERE id >= 990').run();

        // --- PERIODO 2025-II (ID 1 - ACTUAL) ---
        db.prepare("INSERT INTO periodos (id, nombre, fecha_inicio, fecha_fin, activo) VALUES (1, '2025-II', '2025-07-01', '2025-12-31', 1)").run();
        
        [1, 2, 3, 4, 5].forEach((id) => {
            db.prepare("INSERT OR REPLACE INTO materias (id, nombre, codigo, creditos) VALUES (?, ?, ?, ?)").run(id, 'Materia Actual ' + id, 'MAT-' + id, 3);
            db.prepare("INSERT INTO cursos (id, materia_id, docente_id, periodo_id, cupo) VALUES (?, ?, 2, 1, 30)").run(id, id);
            const m = db.prepare('INSERT INTO matriculas (estudiante_id, curso_id) VALUES (?, ?)').run(santiagoId, id);
            const mid = m.lastInsertRowid;
            db.prepare('INSERT INTO calificaciones (matricula_id, componente, valor, fecha) VALUES (?, ?, ?, ?)').run(mid, 'Parcial', 3.5, '2026-03-01');
            db.prepare('INSERT INTO asistencia (matricula_id, fecha, tipo) VALUES (?, ?, ?)').run(mid, '2026-03-01', 'presente');
        });

        // --- PERIODO 2025-I (ID 2 - PASADO) ---
        db.prepare("INSERT INTO periodos (id, nombre, fecha_inicio, fecha_fin, activo) VALUES (2, '2025-I', '2025-01-01', '2025-06-30', 0)").run();
        
        const materiasPasadas = [
            {id: 990, n: 'Cálculo Diferencial', c: 'CAL-01', cr: 4},
            {id: 991, n: 'Fundamentos de Programación', c: 'PROG-01', cr: 3},
            {id: 992, n: 'Álgebra Lineal', c: 'ALG-01', cr: 3},
            {id: 993, n: 'Deportes', c: 'DEP-01', cr: 1}
        ];

        materiasPasadas.forEach(mat => {
            db.prepare("INSERT INTO materias (id, nombre, codigo, creditos) VALUES (?, ?, ?, ?)").run(mat.id, mat.n, mat.c, mat.cr);
            db.prepare("INSERT INTO cursos (id, materia_id, docente_id, periodo_id, cupo) VALUES (?, ?, 2, 2, 30)").run(mat.id, mat.id);
            const m = db.prepare('INSERT INTO matriculas (estudiante_id, curso_id) VALUES (?, ?)').run(santiagoId, mat.id);
            const mid = m.lastInsertRowid;
            db.prepare('INSERT INTO calificaciones (matricula_id, componente, valor, fecha) VALUES (?, ?, ?, ?)').run(mid, 'Final', 4.8, '2025-06-15');
            db.prepare('INSERT INTO asistencia (matricula_id, fecha, tipo) VALUES (?, ?, ?)').run(mid, '2025-06-15', 'presente');
        });

        db.save();
        res.send('✅ SANTIAGO RESETEADO: Periodos 1 y 2 creados con materias distintas.');
    } catch (err) {
        res.status(500).send('ERROR: ' + err.message);
    }
});

module.exports = router;
