const { getDB, initDB } = require('./db');

async function cleanupAndSeedRicardo() {
    await initDB();
    const db = getDB();

    try {
        console.log('🧹 Limpiando cursos antiguos de Ricardo Mendoza...');

        const ricardo = db.prepare('SELECT id FROM personas WHERE username = ?').get('ricardo.mendoza');
        if (!ricardo) return console.error('No se encontró a Ricardo');

        // Borrar cursos y matrículas asociadas a él para empezar de cero
        const cursosViejos = db.prepare('SELECT id FROM cursos WHERE docente_id = ?').all(ricardo.id);
        db.transaction(() => {
            for (const c of cursosViejos) {
                db.prepare('DELETE FROM calificaciones WHERE matricula_id IN (SELECT id FROM matriculas WHERE curso_id = ?)').run(c.id);
                db.prepare('DELETE FROM asistencia WHERE matricula_id IN (SELECT id FROM matriculas WHERE curso_id = ?)').run(c.id);
                db.prepare('DELETE FROM matriculas WHERE curso_id = ?').run(c.id);
            }
            db.prepare('DELETE FROM cursos WHERE docente_id = ?').run(ricardo.id);
        })();

        console.log('🌱 Cargando las 3 materias oficiales...');
        const periodo = db.prepare('SELECT id FROM periodos WHERE nombre = "2025-2"').get();
        
        const materias = [
            { n: 'Cálculo Diferencial', c: 'CALC-DIF' },
            { n: 'Álgebra Lineal', c: 'ALG-LIN' },
            { n: 'Cálculo Integral', c: 'CALC-INT' }
        ];

        for (let i = 0; i < materias.length; i++) {
            db.prepare('INSERT OR IGNORE INTO materias (nombre, codigo, creditos, programa_id, semestre) VALUES (?, ?, 4, 1, 1)').run(materias[i].n, materias[i].c);
            const mId = db.prepare('SELECT id FROM materias WHERE codigo = ?').get(materias[i].c).id;
            
            const res = db.prepare('INSERT INTO cursos (materia_id, docente_id, periodo_id, salon, cupo, horario) VALUES (?, ?, ?, ?, 30, ?)')
                          .run(mId, ricardo.id, periodo.id, `S-30${i+1}`, `L-M-V 0${8+i}:00`);
            
            const cursoId = res.lastInsertRowid;

            // Matricular a Santiago (ID 1) y otros 5 estudiantes
            const estudiantes = db.prepare('SELECT id FROM personas WHERE rol = "estudiante" LIMIT 6').all();
            for (const est of estudiantes) {
                db.prepare('INSERT OR IGNORE INTO matriculas (estudiante_id, curso_id) VALUES (?, ?)').run(est.id, cursoId);
            }
        }

        console.log('✅ Ricardo ahora tiene exactamente 3 materias con estudiantes reales.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

cleanupAndSeedRicardo();
