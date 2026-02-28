const bcrypt = require('bcryptjs');
const { getDB, initDB } = require('./db');

async function test() {
    await initDB();
    const db = getDB();
    const user = db.prepare('SELECT * FROM personas WHERE username = ?').get('admin.ti');

    if (!user) {
        console.log('User not found');
        return;
    }

    const testPass = 'Admin2024!';
    const valid = bcrypt.compareSync(testPass, user.password_hash);
    console.log(`Testing admin.ti with ${testPass}: ${valid}`);
    console.log(`Stored Hash: ${user.password_hash}`);
}

test();
