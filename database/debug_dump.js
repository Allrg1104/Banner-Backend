const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'academic.db');
const db = new Database(dbPath);

console.log('--- DEBUG DATABASE DUMP ---');

const santiago = db.prepare('SELECT id, nombres, email FROM personas WHERE email LIKE ?').get('%santiago.espinosa01%');
console.log('Santiago Persona:', santiago);

const periodos = db.prepare('SELECT * FROM periodos').all();
console.log('Periodos:', periodos);

if (santiago) {
    const matriculas = db.prepare(`
        SELECT m.id, m.estudiante_id, m.curso_id, c.periodo_id, mat.nombre as materia
        FROM matriculas m
        JOIN cursos c ON m.curso_id = c.id
        JOIN materias mat ON c.materia_id = mat.id
        WHERE m.estudiante_id = ?
    `).all(santiago.id);
    console.log('Matriculas de Santiago:', matriculas);
}

db.close();
