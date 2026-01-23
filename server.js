require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
// Puerto 80 para producción en Easypanel
const PORT = process.env.PORT || 80;

// --- DIAGNÓSTICO Y AUTO-INICIALIZACIÓN ---
async function startApp() {
    try {
        console.log('🔍 Probando conexión a la base de datos...');
        await db.query('SELECT NOW()');
        console.log('✅ Conexión EXITOSA a PostgreSQL');

        // Leer y ejecutar init.sql si es necesario
        const sqlPath = path.join(__dirname, 'init.sql');
        if (fs.existsSync(sqlPath)) {
            console.log('🚀 Ejecutando script de inicialización (init.sql)...');
            const sql = fs.readFileSync(sqlPath, 'utf8');
            await db.query(sql);
            console.log('✅ Tablas verificadas/creadas correctamente');
        }
    } catch (err) {
        console.error('❌ ERROR crítico de base de datos:', err.message);
        console.error('URL Intentada:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
    }
}

startApp();

// --- CONFIGURACIÓN DE SEGURIDAD (Desbloqueo de CSP) ---
// Este middleware soluciona el error "blocked:csp" que ves en tu pestaña Network
app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https:;"
    );
    next();
});

app.use(cors());
app.use(express.json());

// --- SERVIR ARCHIVOS ESTÁTICOS ---
app.use(express.static(path.join(__dirname, '')));

// --- RUTAS DE NAVEGACIÓN ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API Health Check ---
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// --- Autenticación ---
// --- Usuarios ---
app.get('/api/users', async (req, res) => {
    try {
        const result = await db.query('SELECT id, username, name, created_at FROM users ORDER BY username ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { username, password, name } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO users (username, password, name) VALUES ($1, $2, $3) RETURNING id, username, name',
            [username, password, name]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { username, password, name } = req.body;
    try {
        let query = 'UPDATE users SET username=$1, name=$2';
        let params = [username, name, id];

        if (password) {
            query += ', password=$3 WHERE id=$4';
            params = [username, name, password, id];
        } else {
            query += ' WHERE id=$3';
        }

        const result = await db.query(query + ' RETURNING id, username, name', params);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Authentication ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            res.json({ id: user.id, username: user.username, name: user.name });
        } else {
            res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/employee-auth', async (req, res) => {
    const { pin } = req.body;
    try {
        const result = await db.query('SELECT * FROM employees WHERE pin = $1 AND status = $2', [pin, 'Active']);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(401).json({ error: 'PIN incorrecto o empleado inactivo' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Error en la base de datos' });
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
    const { name, cedula, phone, pin, position, hourlyRate, status, startDate, endDate, applyCCSS, salaryHistory } = req.body;

    // Validación de campos obligatorios
    if (!name || !hourlyRate || !startDate) {
        return res.status(400).json({ error: 'Faltan campos obligatorios: name, hourlyRate o startDate' });
    }

    try {
        const result = await db.query(
            'INSERT INTO employees (name, cedula, phone, pin, position, hourly_rate, status, start_date, end_date, apply_ccss, salary_history) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
            [name, cedula, phone, pin, position, hourlyRate, status || 'Active', startDate, endDate || null, applyCCSS || false, JSON.stringify(salaryHistory || [])]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error("POST /api/employees error:", err.message);
        res.status(500).json({ error: "No se pudo crear el empleado: " + err.message });
    }
});

app.put('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    const { name, cedula, phone, pin, position, hourlyRate, status, startDate, endDate, applyCCSS, salaryHistory } = req.body;
    try {
        const result = await db.query(
            'UPDATE employees SET name=$1, cedula=$2, phone=$3, pin=$4, position=$5, hourly_rate=$6, status=$7, start_date=$8, end_date=$9, apply_ccss=$10, salary_history=$11 WHERE id=$12 RETURNING *',
            [name, cedula, phone, pin, position, hourlyRate, status, startDate, endDate, applyCCSS, JSON.stringify(salaryHistory || []), id]
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

// --- Logs ---
app.get('/api/logs', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM logs ORDER BY date DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/logs', async (req, res) => {
    const { employeeId, date, hours, timeIn, timeOut, isImported } = req.body;

    if (!employeeId || isNaN(employeeId)) {
        return res.status(400).json({ error: 'ID de empleado inválido o faltante' });
    }
    if (!date || !hours && hours !== 0) {
        return res.status(400).json({ error: 'Faltan campos obligatorios: date o hours' });
    }

    try {
        const result = await db.query(
            'INSERT INTO logs (employee_id, date, hours, time_in, time_out, is_imported) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [employeeId, date, hours, timeIn || null, timeOut || null, isImported || false]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error("POST /api/logs error:", err.message);
        res.status(500).json({ error: "No se pudo registrar la hora: " + err.message });
    }
});

app.delete('/api/logs/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM logs WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/logs/:id', async (req, res) => {
    const { id } = req.params;
    const { employeeId, date, hours, timeIn, timeOut, isImported, isPaid } = req.body;
    try {
        const result = await db.query(
            'UPDATE logs SET employee_id=$1, date=$2, hours=$3, time_in=$4, time_out=$5, is_imported=$6, is_paid=$7 WHERE id=$8 RETURNING *',
            [employeeId, date, hours, timeIn, timeOut, isImported, isPaid, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/logs/employee/:employeeId', async (req, res) => {
    try {
        await db.query('DELETE FROM logs WHERE employee_id = $1', [req.params.employeeId]);
        res.json({ success: true });
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

app.post('/api/payments', async (req, res) => {
    const { employeeId, amount, hours, deductionCCSS, netAmount, date, isImported } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO payments (employee_id, amount, hours, deduction_ccss, net_amount, date, is_imported) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [employeeId, amount, hours || 0, deductionCCSS || 0, netAmount || amount, date, isImported || false]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/payments/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// La ruta /api/employee-auth estaba duplicada, se mantiene una sola instancia.

// --- Mantenimiento ---
app.delete('/api/maintenance/clear-all', async (req, res) => {
    const { target } = req.query; // 'logs', 'payments', 'employees', 'all'
    try {
        if (target === 'logs') {
            await db.query('DELETE FROM logs');
        } else if (target === 'payments') {
            await db.query('DELETE FROM payments');
        } else if (target === 'employees') {
            await db.query('DELETE FROM employees');
        } else if (target === 'all') {
            await db.query('DELETE FROM logs');
            await db.query('DELETE FROM payments');
            await db.query('DELETE FROM employees');
        } else {
            return res.status(400).json({ error: 'Objetivo de limpieza no válido' });
        }
        res.json({ success: true, message: `Limpieza de ${target} completada` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor backend de Tom Tom Wok corriendo en puerto ${PORT}`);
});
