const { getDB, initDB } = require('./db');

async function check() {
    await initDB();
    const db = getDB();
    const users = db.prepare('SELECT * FROM personas').all();

    console.log('Total users found:', users.length);
    users.forEach(u => {
        console.log(`- [${u.id}] Username: "${u.username}", Rol: ${u.rol}`);
    });

    const admin = users.find(u => u.username === 'admin.ti');
    if (admin) {
        console.log('Found admin.ti via Array.find');
        const bcrypt = require('bcryptjs');
        console.log('Test "Admin2024!":', bcrypt.compareSync('Admin2024!', admin.password_hash));
    } else {
        console.log('admin.ti NOT found in list');
    }
}

check();
