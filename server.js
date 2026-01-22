const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
require('dotenv').config();

const app = express();
// Cambiado a puerto 80 para que coincida con tus logs de Easypanel
const PORT = process.env.PORT || 80;

app.use(cors());
app.use(express.json());

// --- SERVIR ARCHIVOS ESTÁTICOS (HTML, CSS, IMÁGENES) ---
// Esto permite que el servidor encuentre el logo y los estilos de Tom Tom Wok
app.use(express.static(path.join(__dirname, '')));

// --- RUTAS DE NAVEGACIÓN ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Middleware de Salud ---
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// --- Autenticación ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            res.json({ id: user.id, username: user.username, name: user.name });
        } else {
            res.status(401).json({ error: 'Credenciales inválidas' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Empleados ---
app.get('/api/employees', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM employees ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/employees', async (req, res) => {
    const { name, cedula, phone, pin, position, hourlyRate, status, startDate, endDate, applyCCSS } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO employees (name, cedula, phone, pin, position, hourly_rate, status, start_date, end_date, apply_ccss) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
            [name, cedula, phone, pin, position, hourlyRate, status, startDate, endDate, applyCCSS]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Logs (Registro de Horas) ---
app.post('/api/logs', async (req, res) => {
    const { employeeId, date, hours, timeIn, timeOut } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO logs (employee_id, date, hours, time_in, time_out) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [employeeId, date, hours, timeIn, timeOut]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor backend de Tom Tom Wok corriendo en puerto ${PORT}`);
});