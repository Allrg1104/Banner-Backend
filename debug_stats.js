const { initDB, getDB } = require('./database/db');

async function testStats() {
    try {
        await initDB();
        const db = getDB();

        const stats = db.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM personas) as total_users,
                (SELECT COUNT(*) FROM personas WHERE rol = 'estudiante') as total_students,
                (SELECT COUNT(*) FROM personas WHERE rol = 'docente') as total_teachers,
                (SELECT COUNT(*) FROM matriculas) as total_enrollments,
                (SELECT COUNT(*) FROM personas WHERE activo = 1) as active_users
        `).get();

        console.log('--- STATS RESULTS ---');
        console.log(JSON.stringify(stats, null, 2));

        const userSample = db.prepare('SELECT id, username, rol FROM personas LIMIT 5').all();
        console.log('--- USER SAMPLE ---');
        console.log(JSON.stringify(userSample, null, 2));

    } catch (err) {
        console.error('Test Error:', err);
    }
}

testStats();
