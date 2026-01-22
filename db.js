const { Pool } = require('pg');

const pool = new Pool({
  host: 'bd-planillas-tomtomwok', // Nombre del servicio en Easypanel
  user: 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: 'planillas_tom_tom_wok',
  port: 5432,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};