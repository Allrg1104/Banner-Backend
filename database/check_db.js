const { getDB, initDB } = require('./db');
async function check() {
    await initDB();
    const db = getDB();
    const users = db.prepare('SELECT username, password_hash, rol FROM personas').all();
    console.log(JSON.stringify(users, null, 2));
}
check();
