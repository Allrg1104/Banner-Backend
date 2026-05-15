const express = require('express');
const router = express.Router();
const { getDB } = require('../database/db');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { getStudentDashboardMetrics } = require('../services/analytics.service');

// Listar periodos donde el estudiante tiene matrículas
router.get('/:id/periodos', auth, (req, res) => {
    const db = getDB();
    const targetId = parseInt(req.params.id);

    try {
        const periods = db.prepare(`
            SELECT DISTINCT p.id, p.nombre, p.activo 
            FROM periodos p
            JOIN cursos c ON p.id = c.periodo_id
            JOIN matriculas m ON c.id = m.curso_id
            WHERE m.estudiante_id = ?
            ORDER BY p.fecha_inicio DESC
        `).all(targetId);
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
    try {
        const grades = db.prepare(`
            SELECT mat.nombre as materia, c.componente, c.valor, c.fecha
            FROM matriculas m
            JOIN calificaciones c ON m.id = c.matricula_id
            JOIN cursos cu ON m.curso_id = cu.id
            JOIN materias mat ON cu.materia_id = mat.id
            JOIN periodos p ON cu.periodo_id = p.id
            WHERE m.estudiante_id = ? AND p.activo = 1
            ORDER BY mat.nombre, c.fecha
        `).all(targetId);
        res.json(grades || []);
    } catch (err) {
        console.error('Error en /grades:', err);
        res.status(500).json({ error: 'Error al obtener calificaciones' });
    }
});

router.get('/:id/attendance', auth, (req, res) => {
    const targetId = parseInt(req.params.id);
    if (req.user.rol === 'estudiante' && req.user.id !== targetId) return res.status(403).json({ error: 'Acceso denegado' });

    const db = getDB();
    try {
        const attendance = db.prepare(`
            SELECT mat.nombre as materia, a.fecha, a.tipo
            FROM matriculas m
            JOIN asistencia a ON m.id = a.matricula_id
            JOIN cursos cu ON m.curso_id = cu.id
            JOIN materias mat ON cu.materia_id = mat.id
            JOIN periodos p ON cu.periodo_id = p.id
            WHERE m.estudiante_id = ? AND p.activo = 1
            ORDER BY a.fecha DESC
        `).all(targetId);
        res.json(attendance || []);
    } catch (err) {
        console.error('Error en /attendance:', err);
        res.status(500).json({ error: 'Error al obtener asistencia' });
    }
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

// Listar solicitudes del estudiante
router.get('/:id/requests', auth, (req, res) => {
    const targetId = parseInt(req.params.id);
    
    // Seguridad: Estudiante solo ve el suyo.
    if (req.user.rol === 'estudiante' && req.user.id !== targetId) {
        return res.status(403).json({ error: 'No tienes permiso para ver estas solicitudes' });
    }

    const db = getDB();
    try {
        const requests = db.prepare(`
            SELECT * FROM solicitudes 
            WHERE estudiante_id = ? 
            ORDER BY fecha DESC
        `).all(targetId);
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Crear nueva solicitud
router.post('/:id/requests', auth, (req, res) => {
    const targetId = parseInt(req.params.id);

    // Seguridad: Estudiante solo crea para sí mismo
    if (req.user.rol === 'estudiante' && req.user.id !== targetId) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    const db = getDB();
    const { tipo, descripcion } = req.body;
    try {
        db.prepare(`
            INSERT INTO solicitudes (estudiante_id, tipo, descripcion, estado)
            VALUES (?, ?, ?, 'pendiente')
        `).run(targetId, tipo, descripcion);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- INSCRIPCIONES ---

/**
 * Buscar cursos disponibles para inscripción en el periodo activo.
 * Permite filtrar por nombre de materia o NRC.
 */
router.get('/courses/search', auth, (req, res) => {
    const db = getDB();
    let query = req.query.q || '';
    
    // Normalizar la consulta (quitar acentos y pasar a minúsculas)
    const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    try {
        // En SQLite, usamos REPLACE para normalizar las vocales en la búsqueda
        const courses = db.prepare(`
            SELECT 
                c.id as curso_id,
                m.nombre as materia,
                m.codigo,
                m.creditos,
                c.nrc,
                c.horario,
                c.salon,
                p.nombres || ' ' || p.apellidos as docente
            FROM cursos c
            JOIN materias m ON c.materia_id = m.id
            JOIN personas p ON c.docente_id = p.id
            JOIN periodos per ON c.periodo_id = per.id
            WHERE per.activo = 1 AND c.estado = 'activo'
            AND (
                LOWER(m.nombre) LIKE ? OR 
                REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(m.nombre), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u') LIKE ? OR
                c.nrc LIKE ?
            )
            LIMIT 15
        `).all(`%${query.toLowerCase()}%`, `%${normalizedQuery}%`, `%${query}%`);
        
        res.json(courses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Inscribir una materia (Crear matrícula)
 */
router.post('/:id/enroll', auth, rbac('estudiante', 'admin'), (req, res) => {
    const db = getDB();
    const studentId = parseInt(req.params.id);
    const { cursoId } = req.body;

    if (!cursoId) return res.status(400).json({ error: 'Falta cursoId' });

    try {
        // Verificar si ya está matriculado
        const exists = db.prepare('SELECT id FROM matriculas WHERE estudiante_id = ? AND curso_id = ?').get(studentId, cursoId);
        if (exists) return res.status(400).json({ error: 'Ya estás inscrito en esta materia' });

        // Verificar cruce de horario (Opcional pero recomendado para un sistema premium)
        // Por ahora inscripción simple
        db.prepare('INSERT INTO matriculas (estudiante_id, curso_id, estado) VALUES (?, ?, "activa")').run(studentId, cursoId);
        
        res.json({ success: true, message: 'Inscripción exitosa' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Obtener el horario semanal del estudiante (Periodo activo)
 */
router.get('/:id/schedule', auth, (req, res) => {
    const db = getDB();
    const studentId = parseInt(req.params.id);

    try {
        const schedule = db.prepare(`
            SELECT 
                m.nombre as materia,
                c.nrc,
                c.horario,
                c.salon,
                p.nombres || ' ' || p.apellidos as docente
            FROM matriculas mat
            JOIN cursos c ON mat.curso_id = c.id
            JOIN materias m ON c.materia_id = m.id
            JOIN personas p ON c.docente_id = p.id
            JOIN periodos per ON c.periodo_id = per.id
            WHERE mat.estudiante_id = ? AND per.activo = 1
        `).all(studentId);
        
        res.json(schedule);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
