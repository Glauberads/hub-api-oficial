require('dotenv/config');

module.exports = {
  dialect: process.env.DB_DIALECT || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_bin'
  },
  pool: {
    max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 100,
    min: process.env.DB_POOL_MIN ? parseInt(process.env.DB_POOL_MIN, 10) : 15,
    acquire: process.env.DB_POOL_ACQUIRE ? parseInt(process.env.DB_POOL_ACQUIRE, 10) : 30000,
    idle: process.env.DB_POOL_IDLE ? parseInt(process.env.DB_POOL_IDLE, 10) : 600000
  },
  logging: false
};
