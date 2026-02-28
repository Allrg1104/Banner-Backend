const { getDB, initDB } = require('./db');

async function check() {
    try {
        await initDB();
        const db = getDB();

        const count = db.prepare('SELECT count(*) as total FROM personas').get();
        console.log('Total users:', count.total);

        const users = db.prepare('SELECT username, rol FROM personas').all();
        console.log('User list:', users);

        const admin = db.prepare('SELECT * FROM personas WHERE username = ?').get('admin.ti');
        if (admin) {
            console.log('Admin found:', admin.username);
        } else {
            console.log('Admin NOT found by username');
        }
    } catch (err) {
        console.error('Check Error:', err);
    }
}

check();
