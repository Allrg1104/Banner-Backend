const { getDB, initDB } = require('./db');

async function checkRicardo() {
    await initDB();
    const db = getDB();

    const ricardo = db.prepare('SELECT id FROM personas WHERE username = ?').get('ricardo.mendoza');
    console.log('Ricardo ID:', ricardo ? ricardo.id : 'NOT FOUND');

    if (ricardo) {
        const courses = db.prepare(`
            SELECT c.id, m.nombre as materia, p.nombre as periodo, c.docente_id
            FROM cursos c
            JOIN materias m ON c.materia_id = m.id
            JOIN periodos p ON c.periodo_id = p.id
            WHERE c.docente_id = ?
        `).all(ricardo.id);
        console.log('Cursos encontrados:', courses);
    }
    process.exit(0);
}

checkRicardo();
