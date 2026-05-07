const express = require('express');
const router = express.Router();
const { getDB } = require('../database/db');
const auth = require('../middleware/auth');

// Middleware para asegurar que solo docentes accedan
const isTeacher = (req, res, next) => {
    if (req.user.rol !== 'docente' && req.user.rol !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado: Se requiere rol de docente' });
    }
    next();
};

// Listar mis cursos (como docente)
router.get('/my-courses', auth, isTeacher, (req, res) => {
    const db = getDB();
    try {
        const courses = db.prepare(`
            SELECT c.id, m.nombre as materia, m.codigo, p.nombre as periodo, c.salon, c.horario,
                   (SELECT COUNT(*) FROM matriculas WHERE curso_id = c.id) as num_estudiantes
            FROM cursos c
            JOIN materias m ON c.materia_id = m.id
            JOIN periodos p ON c.periodo_id = p.id
            WHERE c.docente_id = ?
            ORDER BY p.fecha_inicio DESC
        `).all(req.user.id);
        res.json(courses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listar estudiantes de un curso con sus notas
router.get('/courses/:id/students', auth, isTeacher, (req, res) => {
    const db = getDB();
    try {
        const students = db.prepare(`
            SELECT p.id as persona_id, p.nombres, p.apellidos, p.username, m.id as matricula_id
            FROM matriculas m
            JOIN personas p ON m.estudiante_id = p.id
            WHERE m.curso_id = ?
        `).all(req.params.id);

        // Para cada estudiante, traer sus notas de los 3 cortes
        const results = students.map(s => {
            const grades = db.prepare(`
                SELECT componente, valor FROM calificaciones 
                WHERE matricula_id = ?
            `).all(s.matricula_id);
            
            return {
                ...s,
                grades: {
                    'Corte 1': grades.find(g => g.componente === 'Corte 1')?.valor || null,
                    'Corte 2': grades.find(g => g.componente === 'Corte 2')?.valor || null,
                    'Corte 3': grades.find(g => g.componente === 'Corte 3')?.valor || null
                }
            };
        });

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Actualizar o insertar nota
router.post('/update-grade', auth, isTeacher, (req, res) => {
    const db = getDB();
    const { matricula_id, componente, valor } = req.body;

    try {
        // Verificar que el curso pertenezca al docente (seguridad)
        const courseCheck = db.prepare(`
            SELECT c.docente_id 
            FROM matriculas m 
            JOIN cursos c ON m.curso_id = c.id 
            WHERE m.id = ?
        `).get(matricula_id);

        if (!courseCheck || (courseCheck.docente_id !== req.user.id && req.user.rol !== 'admin')) {
            return res.status(403).json({ error: 'No tienes permiso para calificar este curso' });
        }

        // Upsert de la calificación
        const existing = db.prepare('SELECT id FROM calificaciones WHERE matricula_id = ? AND componente = ?').get(matricula_id, componente);
        
        if (existing) {
            db.prepare('UPDATE calificaciones SET valor = ?, updated_at = datetime("now") WHERE id = ?').run(valor, existing.id);
        } else {
            db.prepare('INSERT INTO calificaciones (matricula_id, componente, valor, fecha) VALUES (?, ?, ?, date("now"))').run(matricula_id, componente, valor);
        }

        res.json({ success: true, message: 'Nota actualizada correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
