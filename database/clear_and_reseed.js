const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'academic.db');
const db = new Database(dbPath);

console.log('🔄 Re-sembrando datos para Santiago (Diferenciación de periodos)...');

try {
    // 1. Obtener ID de Santiago (normalmente es 1)
    const santiago = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('santiago.espinosa01@unicatolica.edu.co');
    if (!santiago) throw new Error('No se encontró a Santiago');
    const santiagoId = santiago.id;

    // 2. Limpiar matriculas, calificaciones y asistencia actuales de Santiago
    db.prepare('DELETE FROM calificaciones WHERE matricula_id IN (SELECT id FROM matriculas WHERE estudiante_id = ?)').run(santiagoId);
    db.prepare('DELETE FROM asistencia WHERE matricula_id IN (SELECT id FROM matriculas WHERE estudiante_id = ?)').run(santiagoId);
    db.prepare('DELETE FROM matriculas WHERE estudiante_id = ?').run(santiagoId);

    // 3. Insertar datos para PERIODO 2025-II (ID 1 - Activo)
    // Materias: Bases de Datos, Redes, Ética, Proyecto 1, Electiva
    const cursosActuales = [1, 2, 3, 4, 5]; 
    cursosActuales.forEach((cursoId, index) => {
        const res = db.prepare('INSERT INTO matriculas (estudiante_id, curso_id) VALUES (?, ?)').run(santiagoId, cursoId);
        const matriculaId = res.lastInsertRowid;
        
        // Notas promedio 3.5 a 3.8
        db.prepare('INSERT INTO calificaciones (matricula_id, componente, valor, fecha) VALUES (?, ?, ?, ?)').run(matriculaId, 'Parcial 1', 3.5 + (index * 0.1), '2026-02-15');
        // Asistencia 80-90%
        db.prepare('INSERT INTO asistencia (matricula_id, fecha, tipo) VALUES (?, ?, ?)').run(matriculaId, '2026-02-20', 'presente');
    });

    // 4. Crear Periodo Pasado si no existe y sus cursos
    // Periodo 2025-I (ID 2)
    const periodoPasadoId = 2;
    
    // Crear cursos específicos para el periodo pasado (Materia 6: Cálculo, Materia 7: Física)
    // Asegurarnos que existan las materias
    db.prepare('INSERT OR IGNORE INTO materias (nombre, codigo, creditos) VALUES (?, ?, ?)').run('Cálculo Integral', 'CALC02', 4);
    db.prepare('INSERT OR IGNORE INTO materias (nombre, codigo, creditos) VALUES (?, ?, ?)').run('Física Mecánica', 'FIS01', 4);
    
    const mat6 = db.prepare('SELECT id FROM materias WHERE codigo = ?').get('CALC02').id;
    const mat7 = db.prepare('SELECT id FROM materias WHERE codigo = ?').get('FIS01').id;

    const cursoPasado1 = db.prepare('INSERT INTO cursos (materia_id, docente_id, periodo_id, horario, cupos) VALUES (?, ?, ?, ?, ?)').run(mat6, 2, periodoPasadoId, 'Remoto', 30).lastInsertRowid;
    const cursoPasado2 = db.prepare('INSERT INTO cursos (materia_id, docente_id, periodo_id, horario, cupos) VALUES (?, ?, ?, ?, ?)').run(mat7, 2, periodoPasadoId, 'Remoto', 30).lastInsertRowid;

    // Matricular a Santiago en el periodo pasado
    [cursoPasado1, cursoPasado2].forEach((cursoId) => {
        const res = db.prepare('INSERT INTO matriculas (estudiante_id, curso_id) VALUES (?, ?)').run(santiagoId, cursoId);
        const matriculaId = res.lastInsertRowid;
        
        // Notas MUY ALTAS (4.8 y 5.0) para que se vea el cambio
        db.prepare('INSERT INTO calificaciones (matricula_id, componente, valor, fecha) VALUES (?, ?, ?, ?)').run(matriculaId, 'Final', cursoId === cursoPasado1 ? 4.8 : 5.0, '2025-06-10');
        // Asistencia 100%
        db.prepare('INSERT INTO asistencia (matricula_id, fecha, tipo) VALUES (?, ?, ?)').run(matriculaId, '2025-05-15', 'presente');
    });

    console.log('✅ Datos re-sembrados con éxito. Santiago ahora tiene datos MUY diferentes entre periodos.');

} catch (err) {
    console.error('❌ Error al re-sembrar:', err.message);
} finally {
    db.close();
}
