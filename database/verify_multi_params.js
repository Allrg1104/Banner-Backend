const { getDB, initDB } = require('./db');

async function test() {
    await initDB();
    const db = getDB();

    // Testing multiple positional arguments
    const username = 'admin.ti';
    const user = db.prepare('SELECT * FROM personas WHERE username = ? OR email = ?').get(username, username);

    if (user) {
        console.log('Success! Found user:', user.username);
    } else {
        console.log('Failure: Still cannot find user with multiple arguments');
    }
}

test();
