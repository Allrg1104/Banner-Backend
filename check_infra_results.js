const { initDB } = require('./database/db.js');

async function check() {
    const db = await initDB();
    const sedes = db.prepare('SELECT * FROM sedes').all();
    const bloques = db.prepare('SELECT * FROM bloques').all();
    const salones = db.prepare('SELECT * FROM salones').all();
    
    console.log('Sedes:', sedes.length);
    console.log('Bloques:', bloques.length);
    console.log('Salones:', salones.length);
    
    if (sedes.length > 0) {
        console.log('Primera sede:', sedes[0].nombre);
    }
    
    process.exit(0);
}

check();
