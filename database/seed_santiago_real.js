/**
 * Script de Sincronización Real para Santiago Espinosa
 * Setea las 6 materias oficiales del horario y asigna al profesor Arangel.
 * CORRECCIÓN: Usa UPDATE si el NRC ya existe para no romper las matrículas.
 */
const { initDB } = require('./db');
const bcrypt = require('bcryptjs');

async function syncRealData() {
    console.log('📡 Iniciando sincronización de datos reales...');
    const db = await initDB();
    
    try {
        // 1. Asegurar que el profesor Arangel exista
        let arangel = db.prepare('SELECT id FROM personas WHERE username = "arangel"').get();
        if (!arangel) {
            console.log('👨‍🏫 Creando profesor Arangel...');
            const hash = bcrypt.hashSync('Docente2024!', 10);
            db.prepare(`
                INSERT INTO personas (nombres, apellidos, email, username, password_hash, rol, documento, must_change_password)
                VALUES ("Arangel", "Docente", "arangel@unicatolica.edu.co", "arangel", ?, "docente", "80000001", 0)
            `).run(hash);
            arangel = db.prepare('SELECT id FROM personas WHERE username = "arangel"').get();
            db.prepare('INSERT INTO docentes (persona_id, departamento, titulo) VALUES (?, "Sistemas", "Ingeniero de Sistemas")').run(arangel.id);
        }

        const santiago = db.prepare('SELECT id FROM personas WHERE username = "santiago.espinosa01"').get();
        if (!santiago) throw new Error('No se encontró al estudiante Santiago');

        db.prepare('UPDATE periodos SET activo = 0').run();
        db.prepare('UPDATE periodos SET activo = 1 WHERE id = 2').run();

        // 2. Limpiar matrículas "huérfanas" o erróneas de Santiago para el periodo actual
        console.log('🧹 Limpiando inscripciones erróneas...');
        db.prepare('DELETE FROM matriculas WHERE estudiante_id = ? AND curso_id NOT IN (SELECT id FROM cursos WHERE nrc IN ("13424", "13425", "13776", "13816", "14041", "14273"))').run(santiago.id);

        const materiasReales = [
            { nombre: 'Gestión de Servicios en TIC', codigo: 'DPCI-23073', creditos: 3, nrc: '13424', horario: 'Lun-Mié 18:30-21:30' },
            { nombre: 'Metodologías Ágiles en Software', codigo: 'DPCI-23105', creditos: 3, nrc: '13425', horario: 'Mar-Jue 18:30-21:30' },
            { nombre: 'Electiva de Formación Social II', codigo: 'DPCS-32139', creditos: 2, nrc: '13776', horario: 'Vie 18:30-21:30' },
            { nombre: 'Trabajo de Grado I', codigo: 'DPCI-22153', creditos: 2, nrc: '13816', horario: 'Sáb 06:30-09:30' },
            { nombre: 'Electiva de Profundización IV', codigo: 'DPCI-23038', creditos: 3, nrc: '14041', horario: 'Lun-Mié 18:30-21:30' },
            { nombre: 'Electiva de Profundización II', codigo: 'DPCI-23036', creditos: 3, nrc: '14273', horario: 'Mar-Jue 18:30-21:30' }
        ];

        console.log('📚 Sincronizando asignaturas oficiales (manteniendo IDs)...');
        for (const m of materiasReales) {
            db.prepare('INSERT OR IGNORE INTO materias (nombre, codigo, creditos, programa_id) VALUES (?, ?, ?, 1)').run(m.nombre, m.codigo, m.creditos);
            const materiaId = db.prepare('SELECT id FROM materias WHERE codigo = ?').get(m.codigo).id;

            // Verificar si el curso ya existe para NO usar REPLACE
            const existingCourse = db.prepare('SELECT id FROM cursos WHERE nrc = ? AND periodo_id = 2').get(m.nrc);
            
            let cursoId;
            if (existingCourse) {
                // Solo actualizar horario (no tocamos salón ni ID)
                db.prepare('UPDATE cursos SET horario = ?, materia_id = ?, docente_id = ? WHERE id = ?').run(m.horario, materiaId, arangel.id, existingCourse.id);
                cursoId = existingCourse.id;
            } else {
                // Crear nuevo
                const res = db.prepare('INSERT INTO cursos (materia_id, docente_id, periodo_id, nrc, horario, estado) VALUES (?, ?, 2, ?, ?, "activo")')
                    .run(materiaId, arangel.id, m.nrc, m.horario);
                cursoId = res.lastInsertRowid;
            }

            // Asegurar matrícula
            db.prepare('INSERT OR IGNORE INTO matriculas (estudiante_id, curso_id, estado) VALUES (?, ?, "activa")').run(santiago.id, cursoId);
        }

        db.save();
        console.log('✅ Sincronización completada con éxito.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

syncRealData();
