const { Pool } = require('pg');

const pool = new Pool({
  // CAMBIO CRÍTICO: Debe ser exactamente el nombre que sale en Easypanel
  host: 'db-planillas', 
  user: 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: 'planillas_tom_tom_wok',
  port: 5432,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};