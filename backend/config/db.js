const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 10000
});

const promisePool = pool.promise();

// Keep pool connections warm to eliminate cold startup database latency
setInterval(async () => {
    try {
        await promisePool.query('SELECT 1');
    } catch (err) {
        // Ignore normal closed socket errors during keep-alive pinging
        if (err.code !== 'ECONNRESET' && err.code !== 'PROTOCOL_CONNECTION_LOST') {
            console.error('[DB Keep-Alive Error]:', err.message);
        }
    }
}, 15000);

const RETRYABLE_ERRORS = new Set([
    'ECONNRESET',
    'ETIMEDOUT',
    'EPIPE',
    'PROTOCOL_CONNECTION_LOST'
]);

function shouldRetry(error) {
    return RETRYABLE_ERRORS.has(error?.code) || (error?.fatal && error?.syscall === 'read');
}

async function withRetry(action, label) {
    try {
        return await action();
    } catch (error) {
        if (!shouldRetry(error)) {
            throw error;
        }

        console.warn(`[DB] ${label} failed with ${error.code || error.message}; retrying once.`);
        return action();
    }
}

module.exports = {
    execute: (...args) => withRetry(() => promisePool.execute(...args), 'execute'),
    query: (...args) => withRetry(() => promisePool.query(...args), 'query'),
    getConnection: () => withRetry(() => promisePool.getConnection(), 'getConnection'),
    end: (...args) => promisePool.end(...args),
};
