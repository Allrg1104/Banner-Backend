const { getDB, initDB } = require('./database/db');

async function check() {
    await initDB();
    const db = getDB();
    const personas = db.prepare('SELECT id, nombres, rol FROM personas').all();
    const periodos = db.prepare('SELECT id, nombre, activo FROM periodos').all();
    const matriculas = db.prepare('SELECT count(*) as count FROM matriculas').get();
    
    console.log('--- Personas ---');
    console.table(personas);
    console.log('--- Periodos ---');
    console.table(periodos);
    console.log('--- Matriculas ---');
    console.log(matriculas);
}

check();
