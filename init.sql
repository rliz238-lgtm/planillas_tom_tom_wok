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
    salary_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Logs (Registro de horas)
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hours DECIMAL(10, 2) NOT NULL,
    time_in TIME,
    time_out TIME,
    is_imported BOOLEAN DEFAULT FALSE,
    is_paid BOOLEAN DEFAULT FALSE, -- Nueva columna para control de pagos
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Pagos
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    hours DECIMAL(10, 2) DEFAULT 0,
    deduction_ccss DECIMAL(12, 2) DEFAULT 0,
    net_amount DECIMAL(12, 2) DEFAULT 0,
    date DATE NOT NULL,
    is_imported BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Configuración (Key-Value)
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT
);

-- Migraciones para bases de datos existentes
DO $$ 
BEGIN 
    -- Logs Migrations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='is_paid') THEN
        ALTER TABLE logs ADD COLUMN is_paid BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='is_imported') THEN
        ALTER TABLE logs ADD COLUMN is_imported BOOLEAN DEFAULT FALSE;
    END IF;

    -- Employees Migrations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='salary_history') THEN
        ALTER TABLE employees ADD COLUMN salary_history JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='hourly_rate') THEN
        -- Si por alguna razón no existe, la creamos (debería existir según el schema base)
        ALTER TABLE employees ADD COLUMN hourly_rate DECIMAL(10, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='apply_ccss') THEN
        ALTER TABLE employees ADD COLUMN apply_ccss BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Insertar usuario admin por defecto
INSERT INTO users (username, password, name) 
VALUES ('admin', 'password1102', 'Administrador Principal')
ON CONFLICT (username) DO NOTHING;

-- Insertar usuario rli001
INSERT INTO users (username, password, name) 
VALUES ('rli001', 'rli001', 'Usuario RLI')
ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password;

