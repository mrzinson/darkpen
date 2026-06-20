const db = require('./config/db');

async function main() {
    try {
        const [users] = await db.execute('SELECT id, name, username, whatsapp_number, created_at FROM users ORDER BY id DESC LIMIT 50');
        console.log('--- USER LIST ---');
        console.log(JSON.stringify(users, null, 2));
    } catch (err) {
        console.error('Error listing users:', err);
    } finally {
        await db.end();
    }
}

main();
