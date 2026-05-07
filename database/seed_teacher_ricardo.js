const { getDB, initDB } = require('./db');

async function seedRicardoTeacher() {
    await initDB();
    const db = getDB();

    try {
        console.log('🌱 Configurando materias para el profesor Ricardo Mendoza...');

        // 1. Obtener al profesor Ricardo
        const ricardo = db.prepare('SELECT id FROM personas WHERE username = ?').get('ricardo.mendoza');
        if (!ricardo) {
            console.error('❌ Error: No se encontró al profesor ricardo.mendoza');
            return;
        }

        // 2. Asegurar que las materias existan
        const materias = [
            { nombre: 'Cálculo Diferencial', codigo: 'CALC-DIF' },
            { nombre: 'Álgebra Lineal', codigo: 'ALG-LIN' },
            { nombre: 'Cálculo Integral', codigo: 'CALC-INT' }
        ];

        for (const mat of materias) {
            db.prepare(`
                INSERT OR IGNORE INTO materias (nombre, codigo, creditos, programa_id, semestre)
                VALUES (?, ?, 4, 1, 1)
            `).run(mat.nombre, mat.codigo);
        }

        // 3. Obtener IDs de las materias creadas
        const matIds = materias.map(m => db.prepare('SELECT id FROM materias WHERE codigo = ?').get(m.codigo).id);

        // 4. Obtener periodo activo (2025-2)
        const periodo = db.prepare('SELECT id FROM periodos WHERE nombre = ?').get('2025-2');
        if (!periodo) {
            console.error('❌ Error: No se encontró el periodo 2025-2');
            return;
        }

        // 5. Crear los cursos para Ricardo
        const salones = ['A-101', 'B-202', 'C-303'];
        const horarios = ['Lun-Mié 8-10', 'Mar-Jue 10-12', 'Vie 14-18'];
        
        const cursoIds = [];
        for (let i = 0; i < matIds.length; i++) {
            const res = db.prepare(`
                INSERT OR IGNORE INTO cursos (materia_id, docente_id, periodo_id, salon, cupo, horario)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(matIds[i], ricardo.id, periodo.id, salones[i], 30, horarios[i]);
            
            if (res.changes > 0) {
                cursoIds.push(res.lastInsertRowid);
            } else {
                const existing = db.prepare('SELECT id FROM cursos WHERE materia_id = ? AND docente_id = ? AND periodo_id = ?').get(matIds[i], ricardo.id, periodo.id);
                cursoIds.push(existing.id);
            }
        }

        // 6. Matricular estudiantes de prueba en estos cursos
        const estudiantes = db.prepare('SELECT id FROM personas WHERE rol = ? LIMIT 5').all('estudiante');
        
        db.transaction(() => {
            for (const cursoId of cursoIds) {
                for (const est of estudiantes) {
                    db.prepare(`
                        INSERT OR IGNORE INTO matriculas (estudiante_id, curso_id)
                        VALUES (?, ?)
                    `).run(est.id, cursoId);
                }
            }
        })();

        console.log('✅ Ricardo Mendoza ahora tiene 3 cursos asignados y estudiantes matriculados.');
        process.exit(0);

    } catch (err) {
        console.error('❌ Error en seed:', err.message);
        process.exit(1);
    }
}

seedRicardoTeacher();
