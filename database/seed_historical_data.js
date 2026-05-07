const { getDB, initDB } = require('./db');

async function seedHistoricalData() {
    await initDB();
    const db = getDB();

    console.log('🌱 Iniciando carga de datos HISTÓRICOS (Periodos 1 y 2)...');

    try {
        // 1. Asegurar que los periodos existan
        const periodos = [
            { nombre: '2025-1', inicio: '2025-01-20', fin: '2025-06-15', activo: 0 },
            { nombre: '2025-2', inicio: '2025-07-07', fin: '2025-11-28', activo: 1 }
        ];

        for (const p of periodos) {
            db.prepare(`
                INSERT OR IGNORE INTO periodos (nombre, fecha_inicio, fecha_fin, activo)
                VALUES (?, ?, ?, ?)
            `).run(p.nombre, p.inicio, p.fin, p.activo);
        }

        const dbPeriods = db.prepare('SELECT id, nombre FROM periodos').all();
        const p1Id = dbPeriods.find(p => p.nombre === '2025-1').id;
        const p2Id = dbPeriods.find(p => p.nombre === '2025-2').id;

        // 2. Materias y Docentes
        const materias = db.prepare('SELECT id FROM materias').all();
        const docentes = db.prepare('SELECT id FROM personas WHERE rol = ?').all('docente');
        const estudiantes = db.prepare('SELECT persona_id as id FROM estudiantes').all();

        // 3. Función para poblar un periodo
        const populatePeriod = (periodId, prefix) => {
            console.log(`Poblando datos para ${prefix} (ID: ${periodId})...`);
            
            // Crear al menos 7 cursos para este periodo si no existen
            for (let i = 0; i < 7; i++) {
                const matId = materias[i % materias.length].id;
                const docId = docentes[i % docentes.length].id;
                db.prepare(`
                    INSERT OR IGNORE INTO cursos (materia_id, docente_id, periodo_id, salon, cupo, horario)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(matId, docId, periodId, `${prefix.charAt(0)}-${100 + i}`, 30, 'Horario Variable');
            }

            const cursos = db.prepare('SELECT id FROM cursos WHERE periodo_id = ?').all(periodId);

            db.transaction(() => {
                for (const est of estudiantes) {
                    // Matricular en exactamente 7 cursos (o todos los disponibles)
                    const myCursos = cursos.slice(0, 7);
                    
                    for (const c of myCursos) {
                        const res = db.prepare(`
                            INSERT OR IGNORE INTO matriculas (estudiante_id, curso_id) 
                            VALUES (?, ?)
                        `).run(est.id, c.id);

                        let matriculaId;
                        if (res.changes > 0) {
                            matriculaId = res.lastInsertRowid;
                        } else {
                            const existing = db.prepare('SELECT id FROM matriculas WHERE estudiante_id = ? AND curso_id = ?').get(est.id, c.id);
                            matriculaId = existing.id;
                        }

                        // Limpiar notas previas para este periodo y estudiante para evitar duplicados en pruebas
                        db.prepare('DELETE FROM calificaciones WHERE matricula_id = ?').run(matriculaId);

                        // Agregar exactamente 3 notas por materia
                        const componentes = ['Parcial 1', 'Parcial 2', 'Examen Final'];
                        for (const comp of componentes) {
                            const nota = (Math.random() * 2 + 3).toFixed(1); // Notas entre 3.0 y 5.0
                            db.prepare(`
                                INSERT INTO calificaciones (matricula_id, componente, valor, fecha) 
                                VALUES (?, ?, ?, ?)
                            `).run(matriculaId, comp, parseFloat(nota), prefix === '2025-1' ? '2025-04-15' : '2025-10-20');
                        }

                        // Agregar asistencia
                        db.prepare(`INSERT OR IGNORE INTO asistencia (matricula_id, fecha, tipo) VALUES (?, ?, 'presente')`)
                          .run(matriculaId, prefix === '2025-1' ? '2025-03-10' : '2025-09-15');
                    }
                }
            })();
        };

        populatePeriod(p1Id, '2025-1');
        populatePeriod(p2Id, '2025-2');

        console.log('✅ Carga completa. Todos los estudiantes tienen datos en 2025-1 y 2025-2.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

seedHistoricalData();
