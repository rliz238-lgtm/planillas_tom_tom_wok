const { Pool } = require('pg');

const pool = new Pool({
  // Este es el Internal Host que muestra Easypanel en tus credenciales
  host: 'planillas_tom_tom_wok_db-planillas', 
  user: 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: 'planillas_tom_tom_wok',
  port: 5432,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};