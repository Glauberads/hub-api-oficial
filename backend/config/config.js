require('dotenv').config({ path: __dirname + '/../.env' });

module.exports = {
  development: {
    username: process.env.DB_USER || "waticket",
    password: process.env.DB_PASS || "senha123",
    database: process.env.DB_NAME || "chat",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: process.env.DB_DIALECT || "postgres",
    logging: false
  },
  production: {
    username: process.env.DB_USER || "waticket",
    password: process.env.DB_PASS || "senha123",
    database: process.env.DB_NAME || "chat",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: process.env.DB_DIALECT || "postgres",
    logging: false
  },
  test: {
    username: process.env.DB_USER || "waticket",
    password: process.env.DB_PASS || "senha123",
    database: process.env.DB_NAME || "chat",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: process.env.DB_DIALECT || "postgres",
    logging: false
  }
};
