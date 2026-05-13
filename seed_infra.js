
const { initDB } = require('./database/db.js');

async function run() {
    console.log('Starting seed...');
    const db = await initDB();
    
    try {
        db._db.run('DELETE FROM salones');
        db._db.run('DELETE FROM bloques');
        db._db.run('DELETE FROM sedes');
        
        console.log('Inserting Sedes...');
        db.prepare('INSERT INTO sedes (id, nombre) VALUES (?, ?)').run(1, 'PANCE');
        db.prepare('INSERT INTO sedes (id, nombre) VALUES (?, ?)').run(2, 'MELENDEZ');

        console.log('Inserting Bloques...');
        const bloques = [
            [1, 1, 'BLOQUE A'], [2, 1, 'BLOQUE B'], [3, 1, 'BLOQUE C'],
            [4, 2, 'BLOQUE 1'], [5, 2, 'BLOQUE 2'], [6, 2, 'BLOQUE 3']
        ];
        const insBloque = db.prepare('INSERT INTO bloques (id, sede_id, nombre) VALUES (?, ?, ?)');
        bloques.forEach(b => insBloque.run(...b));

        console.log('Inserting Salones...');
        const insSalon = db.prepare('INSERT INTO salones (bloque_id, nombre, tipo) VALUES (?, ?, ?)');
        for(let b=1; b<=6; b++) {
            for(let s=1; s<=5; s++) {
                insSalon.run(b, `SALON ${b}0${s}`, 'AULA');
            }
        }

        console.log('Updating Cursos...');
        const salones = db.prepare('SELECT id FROM salones').all();
        const cursos = db.prepare('SELECT id FROM cursos').all();
        cursos.forEach((c, i) => {
            const sid = salones[i % salones.length].id;
            db.prepare('UPDATE cursos SET salon_id = ?, horario = ? WHERE id = ?').run(sid, 'Lun-Mie 07:30-09:30', c.id);
        });

        console.log('Saving...');
        db.save();
        console.log('DONE! Total Sedes in DB:', db.prepare('SELECT count(*) as count FROM sedes').get().count);
        process.exit(0);
    } catch (e) {
        console.error('SEED ERROR:', e);
        process.exit(1);
    }
}

run();
