const { initDB } = require('./database/db');
initDB().then(db => {
    console.log(db.prepare("SELECT id, username, rol, must_change_password, email FROM personas").all());
    process.exit(0);
});
