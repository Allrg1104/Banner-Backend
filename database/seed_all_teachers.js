const { getDB, initDB } = require('./db');

async function seedAllTeachers() {
    await initDB();
    const db = getDB();

    try {
        console.log('🧹 Iniciando limpieza y carga masiva de docentes...');

        const docentes = [
            { username: 'ricardo.mendoza', materias: [
                { n: 'Cálculo Diferencial', c: 'CALC-DIF' },
                { n: 'Álgebra Lineal', c: 'ALG-LIN' },
                { n: 'Cálculo Integral', c: 'CALC-INT' }
            ]},
            { username: 'andrea.sanchez', materias: [
                { n: 'Fundamentos de Programación', c: 'PROG-101' },
                { n: 'Estructuras de Datos', c: 'EST-DAT' },
                { n: 'Base de Datos I', c: 'BD-101' }
            ]},
            { username: 'arangel', materias: [
                { n: 'Ética y Valores', c: 'ETI-VAL' },
                { n: 'Constitución Política', c: 'CONST-POL' },
                { n: 'Inglés I', c: 'ING-101' }
            ]}
        ];

        const periodo = db.prepare('SELECT id FROM periodos WHERE nombre = "2025-2"').get();
        if (!periodo) throw new Error('No se encontró el periodo 2025-2');

        const estudiantes = db.prepare('SELECT id FROM personas WHERE rol = "estudiante"').all();

        db.transaction(() => {
            for (const doc of docentes) {
                const persona = db.prepare('SELECT id FROM personas WHERE username = ?').get(doc.username);
                if (!persona) {
                    console.log(`⚠️ Saltando ${doc.username}: No encontrado`);
                    continue;
                }

                // 1. Limpiar cursos previos de este docente
                const cursosViejos = db.prepare('SELECT id FROM cursos WHERE docente_id = ?').all(persona.id);
                for (const c of cursosViejos) {
                    db.prepare('DELETE FROM calificaciones WHERE matricula_id IN (SELECT id FROM matriculas WHERE curso_id = ?)').run(c.id);
                    db.prepare('DELETE FROM asistencia WHERE matricula_id IN (SELECT id FROM matriculas WHERE curso_id = ?)').run(c.id);
                    db.prepare('DELETE FROM matriculas WHERE curso_id = ?').run(c.id);
                }
                db.prepare('DELETE FROM cursos WHERE docente_id = ?').run(persona.id);

                // 2. Crear y asignar nuevas materias
                doc.materias.forEach((mat, index) => {
                    db.prepare('INSERT OR IGNORE INTO materias (nombre, codigo, creditos, programa_id, semestre) VALUES (?, ?, 3, 1, 1)').run(mat.n, mat.c);
                    const mId = db.prepare('SELECT id FROM materias WHERE codigo = ?').get(mat.c).id;

                    const res = db.prepare('INSERT INTO cursos (materia_id, docente_id, periodo_id, salon, cupo, horario) VALUES (?, ?, ?, ?, 30, ?)')
                                  .run(mId, persona.id, periodo.id, `Aula-${100 + persona.id + index}`, `Horario-${index + 1}`);
                    
                    const cursoId = res.lastInsertRowid;

                    // 3. Matricular a todos los estudiantes en estas materias para que tengan datos
                    for (const est of estudiantes) {
                        db.prepare('INSERT OR IGNORE INTO matriculas (estudiante_id, curso_id) VALUES (?, ?)').run(est.id, cursoId);
                    }
                });

                console.log(`✅ ${doc.username} configurado con ${doc.materias.length} materias únicas.`);
            }
        })();

        db.save();
        console.log('\n🚀 Carga masiva completada con éxito. Todos los docentes tienen materias únicas.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Error fatal:', e.message);
        process.exit(1);
    }
}

seedAllTeachers();
