const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

app.put('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    const { name, cedula, phone, pin, position, hourlyRate, status, startDate, endDate, applyCCSS } = req.body;
    try {
        const result = await db.query(
            'UPDATE employees SET name=$1, cedula=$2, phone=$3, pin=$4, position=$5, hourly_rate=$6, status=$7, start_date=$8, end_date=$9, apply_ccss=$10 WHERE id=$11 RETURNING *',
            [name, cedula, phone, pin, position, hourlyRate, status, startDate, endDate, applyCCSS, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/employees/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM employees WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Logs (Registro de Horas) ---
app.get('/api/logs', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM logs ORDER BY date DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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

// Endpoint para validar PIN de empleado (para el portal)
app.post('/api/employee-auth', async (req, res) => {
    const { pin } = req.body;
    try {
        const result = await db.query('SELECT * FROM employees WHERE pin = $1 AND status = \'Active\'', [pin]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(401).json({ error: 'PIN incorrecto o empleado inactivo' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Pagos ---
app.get('/api/payments', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM payments ORDER BY date DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en puerto ${PORT}`);
});
