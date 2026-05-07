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

        // 4. Poblar solicitudes aleatorias
        console.log('Generando historial de solicitudes (5 por estudiante)...');
        
        // Limpiar solicitudes previas de prueba para tener un estado limpio
        db.prepare('DELETE FROM solicitudes').run();

        const requestTypes = [
            'Certificados Académicos: Certificado de Estudio',
            'Certificados Académicos: Certificado de Notas',
            'Certificados Académicos: Certificado de Horario',
            'Solicitudes Académicas: Reingreso',
            'Solicitudes Académicas: Cancelación de Semestre',
            'Solicitudes Financieras: Certificado Financiero'
        ];
        const statusOptions = ['pendiente', 'en_proceso', 'aprobada', 'rechazada'];
        const responses = {
            'aprobada': 'Tu solicitud ha sido procesada exitosamente. El documento fue enviado a tu correo institucional.',
            'rechazada': 'No es posible procesar tu solicitud debido a inconsistencias en los datos proporcionados.',
            'en_proceso': 'Estamos verificando tu información con el departamento correspondiente.'
        };

        db.transaction(() => {
            for (const est of estudiantes) {
                // 5 solicitudes aleatorias por estudiante
                for (let i = 0; i < 5; i++) {
                    const tipo = requestTypes[Math.floor(Math.random() * requestTypes.length)];
                    const estado = statusOptions[Math.floor(Math.random() * statusOptions.length)];
                    const respuesta = (estado === 'pendiente') ? null : (responses[estado] || 'Trámite finalizado.');
                    
                    db.prepare(`
                        INSERT INTO solicitudes (estudiante_id, tipo, estado, descripcion, respuesta, fecha)
                        VALUES (?, ?, ?, ?, ?, datetime('now', ?))
                    `).run(
                        est.id, 
                        tipo, 
                        estado, 
                        'Trámite realizado a través del portal estudiantil dinámico.',
                        respuesta,
                        `-${Math.floor(Math.random() * 20)} days`
                    );
                }
            }
        })();

        console.log('✅ Carga completa. Todos los estudiantes tienen materias, notas y 5 solicitudes en su historial.');
        process.exit(0);

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

seedHistoricalData();
