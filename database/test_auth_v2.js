const bcrypt = require('bcryptjs');
const { getDB, initDB } = require('./db');

async function test() {
    await initDB();
    const db = getDB();
    const user = db.prepare('SELECT * FROM personas WHERE username = ?').get('admin.ti');

    if (!user) {
        console.log('User admin.ti not found');
        return;
    }

    console.log('User found:', user.username);
    console.log('Stored hash:', user.password_hash);

    const pass = 'Admin2024!';
    const isValid = bcrypt.compareSync(pass, user.password_hash);
    console.log(`Bcrypt comparison for "${pass}": ${isValid}`);

    // Test hashing again
    const newHash = bcrypt.hashSync(pass, 10);
    console.log('New hash for same pass:', newHash);
    console.log('Comparison of new hash:', bcrypt.compareSync(pass, newHash));
}

test();
