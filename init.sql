-- Tablas para Planillas Tom Tom Wok

-- Tabla de Usuarios (Administradores)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Empleados
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    cedula VARCHAR(20),
    phone VARCHAR(20),
    pin VARCHAR(4),
    position VARCHAR(100),
    hourly_rate DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'Active',
    start_date DATE NOT NULL,
    end_date DATE,
    apply_ccss BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Logs (Registro de horas)
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hours DECIMAL(5, 2) NOT NULL,
    time_in TIME,
    time_out TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Pagos
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Configuración (Key-Value)
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT
);

-- Insertar usuario admin por defecto (password: password123)
-- Nota: En producción esto debería estar hasheado
INSERT INTO users (username, password, name) 
VALUES ('admin', 'password123', 'Administrador Principal')
ON CONFLICT (username) DO NOTHING;

-- Insertar usuario solicitado rli001 (password: rli001)
INSERT INTO users (username, password, name) 
VALUES ('rli001', 'rli001', 'Usuario RLI')
ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password;
