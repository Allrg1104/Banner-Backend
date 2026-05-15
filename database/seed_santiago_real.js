/**
 * Script de Sincronización Real para Santiago Espinosa
 * Setea las 6 materias oficiales del horario y asigna al profesor Arangel.
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

        // 2. Obtener el ID de Santiago
        const santiago = db.prepare('SELECT id FROM personas WHERE username = "santiago.espinosa01"').get();
        if (!santiago) throw new Error('No se encontró al estudiante Santiago');

        // 3. Asegurar que el periodo 2 esté activo
        db.prepare('UPDATE periodos SET activo = 0').run();
        db.prepare('UPDATE periodos SET activo = 1 WHERE id = 2').run();

        // 4. Limpiar matrículas previas de Santiago para el periodo actual (ID 2)
        console.log('🧹 Limpiando materias de prueba...');
        db.prepare('DELETE FROM asistencia WHERE matricula_id IN (SELECT id FROM matriculas WHERE estudiante_id = ? AND curso_id IN (SELECT id FROM cursos WHERE periodo_id = 2))').run(santiago.id);
        db.prepare('DELETE FROM calificaciones WHERE matricula_id IN (SELECT id FROM matriculas WHERE estudiante_id = ? AND curso_id IN (SELECT id FROM cursos WHERE periodo_id = 2))').run(santiago.id);
        db.prepare('DELETE FROM matriculas WHERE estudiante_id = ? AND curso_id IN (SELECT id FROM cursos WHERE periodo_id = 2)').run(santiago.id);

        // 5. Crear las materias reales y sus cursos
        const materiasReales = [
            { nombre: 'Gestión de Servicios en TIC', codigo: 'DPCI-23073', creditos: 3, nrc: '13424', horario: 'Lun-Mié 18:30-21:30', salon: 'A-101' },
            { nombre: 'Metodologías Ágiles en Software', codigo: 'DPCI-23105', creditos: 3, nrc: '13425', horario: 'Mar-Jue 18:30-21:30', salon: 'A-102' },
            { nombre: 'Electiva de Formación Social II', codigo: 'DPCS-32139', creditos: 2, nrc: '13776', horario: 'Vie 18:30-21:30', salon: 'A-201' },
            { nombre: 'Trabajo de Grado I', codigo: 'DPCI-22153', creditos: 2, nrc: '13816', horario: 'Sáb 06:30-09:30', salon: 'Sistemas 1' },
            { nombre: 'Electiva de Profundización IV', codigo: 'DPCI-23038', creditos: 3, nrc: '14041', horario: 'Lun-Mié 18:30-21:30', salon: 'B-101' },
            { nombre: 'Electiva de Profundización II', codigo: 'DPCI-23036', creditos: 3, nrc: '14273', horario: 'Mar-Jue 18:30-21:30', salon: 'B-102' }
        ];

        console.log('📚 Registrando asignaturas oficiales...');
        for (const m of materiasReales) {
            // Crear materia si no existe
            db.prepare('INSERT OR IGNORE INTO materias (nombre, codigo, creditos, programa_id) VALUES (?, ?, ?, 1)').run(m.nombre, m.codigo, m.creditos);
            const materiaId = db.prepare('SELECT id FROM materias WHERE codigo = ?').get(m.codigo).id;

            // Crear curso si no existe para este periodo y NRC (Asegurando horario y salon)
            db.prepare('INSERT OR REPLACE INTO cursos (materia_id, docente_id, periodo_id, nrc, horario, salon, estado) VALUES (?, ?, 2, ?, ?, ?, "activo")')
                .run(materiaId, arangel.id, m.nrc, m.horario, m.salon);
            
            const cursoId = db.prepare('SELECT id FROM cursos WHERE nrc = ? AND periodo_id = 2').get(m.nrc).id;

            // Matricular a Santiago
            db.prepare('INSERT INTO matriculas (estudiante_id, curso_id, estado) VALUES (?, ?, "activa")').run(santiago.id, cursoId);
        }

        db.save();
        console.log('✅ Sincronización exitosa. Santiago tiene 16 créditos con el profesor Arangel.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

syncRealData();
