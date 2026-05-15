/**
 * Script de Poblamiento de Datos Históricos (Periodo Anterior)
 * Crea el periodo 2025-1 y asigna materias/notas a Santiago para pruebas de cambio de periodo.
 */
const { initDB } = require('./db');

async function seedHistorical() {
    console.log('⏳ Iniciando poblamiento de datos históricos (2025-1)...');
    const db = await initDB();
    
    try {
        // 1. Asegurar que el periodo 2025-1 exista y tenga ID 1
        // (Ya existe por el seed.js pero vamos a asegurar datos)
        const p1 = db.prepare('SELECT id FROM periodos WHERE nombre = "2025-1"').get();
        if (!p1) throw new Error('El periodo 2025-1 no existe. Ejecuta el seed principal primero.');

        // 2. Obtener Santiago (estudiante_id 1 en personas)
        const santiago = db.prepare('SELECT id FROM personas WHERE username = "santiago.espinosa01"').get();
        if (!santiago) throw new Error('Santiago no encontrado.');

        // 3. Crear materias históricas
        const materias = [
            { nombre: 'Lógica de Programación', codigo: 'PROG100', creditos: 4 },
            { nombre: 'Introducción a la Ingeniería', codigo: 'INGE101', creditos: 2 },
            { nombre: 'Matemáticas Básicas', codigo: 'MATH099', creditos: 3 },
            { nombre: 'Comunicación Oral y Escrita', codigo: 'HUMA101', creditos: 3 }
        ];

        console.log('📚 Registrando materias de primer semestre...');
        for (const m of materias) {
            db.prepare('INSERT OR IGNORE INTO materias (nombre, codigo, creditos, programa_id, semestre) VALUES (?, ?, ?, 1, 1)').run(m.nombre, m.codigo, m.creditos);
            const materiaId = db.prepare('SELECT id FROM materias WHERE codigo = ?').get(m.codigo).id;

            // Crear curso en 2025-1 (ID 1)
            db.prepare('INSERT OR IGNORE INTO cursos (materia_id, docente_id, periodo_id, nrc, estado) VALUES (?, 7, ?, ?, "activo")').run(materiaId, p1.id, 'H'+m.codigo);
            const cursoId = db.prepare('SELECT id FROM cursos WHERE nrc = ? AND periodo_id = ?').get('H'+m.codigo, p1.id).id;

            // Matricular a Santiago
            db.prepare('INSERT OR IGNORE INTO matriculas (estudiante_id, curso_id, estado) VALUES (?, ?, "aprobada")').run(santiago.id, cursoId);
            const matriculaId = db.prepare('SELECT id FROM matriculas WHERE estudiante_id = ? AND curso_id = ?').get(santiago.id, cursoId).id;

            // Poner notas (Santiago fue buen estudiante en 1er semestre)
            const nota = 4.0 + (Math.random() * 1.0);
            db.prepare('INSERT INTO calificaciones (matricula_id, componente, porcentaje, valor) VALUES (?, "Nota Final", 100, ?)').run(matriculaId, nota.toFixed(1));
            
            // Asistencia perfecta en el pasado
            db.prepare('INSERT INTO asistencia (matricula_id, fecha, tipo) VALUES (?, "2025-02-10", "presente")').run(matriculaId);
            db.prepare('INSERT INTO asistencia (matricula_id, fecha, tipo) VALUES (?, "2025-03-10", "presente")').run(matriculaId);
        }

        db.save();
        console.log('✅ Datos históricos del periodo 2025-1 cargados exitosamente.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

seedHistorical();
