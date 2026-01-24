/**
 * Planillas Tom Tom Wok - Core Logic (API Version)
 * Restauración Completa desde Backup con Soporte PostgreSQL
 */

// --- Utilities ---
window.togglePassword = (id) => {
    const el = document.getElementById(id);
    if (!el) {
        // Buscamos por nombre si no hay ID
        const input = document.querySelector(`input[name="${id}"]`);
        if (input) {
            input.type = input.type === 'password' ? 'text' : 'password';
        }
    } else {
        el.type = el.type === 'password' ? 'text' : 'password';
    }
};

// --- Data Persistence Layer (API) ---
const Storage = {
    SCHEMA: {
        employees: 'employees',
        logs: 'logs',
        payments: 'payments',
        settings: 'settings',
        users: 'users'
    },

    getLocalDate(d = new Date()) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    showLoader(show, text = 'Procesando...', progress = 0) {
        const overlay = document.getElementById('loader-overlay');
        const textEl = document.getElementById('loader-text');
        const progressEl = document.getElementById('loader-progress');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
            if (textEl) textEl.innerText = text;
            if (progressEl) progressEl.style.width = `${progress}%`;
        }
    },

    async get(key) {
        try {
            // Añadimos un timestamp para evitar que el navegador devuelva datos viejos (caché)
            const response = await fetch(`/api/${this.SCHEMA[key]}?_t=${Date.now()}`);
            if (!response.ok) throw new Error('Error al obtener datos');
            return await response.json();
        } catch (err) {
            console.error(err);
            return [];
        }
    },

    async add(key, data) {
        try {
            const response = await fetch(`/api/${this.SCHEMA[key]}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                console.error(`API Error (${key}):`, result.error || 'Unknown error');
                return { error: result.error || 'Error al guardar datos', success: false };
            }
            return { ...result, success: true };
        } catch (err) {
            console.error(`Fetch Error (${key}):`, err);
            return { error: err.message, success: false };
        }
    },

    async update(key, id, updates) {
        try {
            const response = await fetch(`/api/${this.SCHEMA[key]}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (!response.ok) throw new Error('Error al actualizar dato');
            return await response.json();
        } catch (err) {
            console.error(err);
            return null;
        }
    },

    async delete(key, id) {
        try {
            const response = await fetch(`/api/${this.SCHEMA[key]}/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Error al eliminar dato');
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    },

    async deleteLogsByEmployee(employeeId) {
        try {
            const response = await fetch(`/api/logs/employee/${employeeId}`, {
                method: 'DELETE'
            });
            return response.ok;
        } catch (err) {
            console.error(err);
            return false;
        }
    }
};

// --- Authentication Layer ---
const Auth = {
    SCHEMA: 'ttw_session_v2026',

    async login(username, password) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const user = await response.json();
                localStorage.setItem(this.SCHEMA, JSON.stringify({
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    role: 'admin',
                    loginTime: Date.now()
                }));
                return true;
            }
            return false;
        } catch (err) {
            console.error('Error en login:', err);
            return false;
        }
    },

    async employeeAuth(pin) {
        try {
            const response = await fetch('/api/employee-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin })
            });

            if (response.ok) {
                const emp = await response.json();
                localStorage.setItem(this.SCHEMA, JSON.stringify({
                    id: emp.id,
                    name: emp.name,
                    role: 'employee',
                    loginTime: Date.now()
                }));
                return true;
            }
            return false;
        } catch (err) {
            console.error('Error en auth empleado:', err);
            return false;
        }
    },

    logout() {
        localStorage.removeItem(this.SCHEMA);
        location.reload();
    },

    getUser() {
        const session = localStorage.getItem(this.SCHEMA);
        return session ? JSON.parse(session) : null;
    },

    isAuthenticated() {
        return !!this.getUser();
    }
};

// --- View Engine ---
const App = {
    currentView: 'dashboard',

    async init() {
        if (!Auth.isAuthenticated()) {
            this.renderLogin();
            return;
        }

        const user = Auth.getUser();
        const appElem = document.getElementById('app');
        const loginView = document.getElementById('login-view');
        if (appElem) appElem.style.display = 'flex';
        if (loginView) loginView.style.display = 'none';

        const userNameDisplay = document.querySelector('.username');
        if (userNameDisplay) userNameDisplay.textContent = user.name + (user.role === 'employee' ? ' (Empleado)' : '');

        // --- Role-based UI Adjustments ---
        if (user.role === 'employee') {
            // Ocultar elementos de admin en el sidebar
            document.querySelectorAll('.nav-item').forEach(btn => {
                const view = btn.dataset.view;
                if (['dashboard', 'employees', 'payroll', 'benefits', 'import', 'profile'].includes(view)) {
                    btn.style.display = 'none';
                }
            });

            this.setupNavigation();
            await this.renderView('calculator'); // Los empleados solo ven la calculadora/portal
        } else {
            this.setupNavigation();
            await this.renderView('dashboard');
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => Auth.logout();
        }

        this.setupMobileMenu();
    },

    setupMobileMenu() {
        const toggle = document.getElementById('menu-toggle');
        const close = document.getElementById('menu-close');
        const sidebar = document.getElementById('sidebar');

        if (toggle && sidebar) {
            toggle.onclick = () => sidebar.classList.add('active');
        }
        if (close && sidebar) {
            close.onclick = () => sidebar.classList.remove('active');
        }
    },

    renderLogin() {
        const appElem = document.getElementById('app');
        const loginView = document.getElementById('login-view');
        if (appElem) appElem.style.display = 'none';
        if (loginView) loginView.style.display = 'flex';

        const form = document.getElementById('login-form');
        const error = document.getElementById('login-error');
        const btnAdmin = document.getElementById('btn-mode-admin');
        const btnEmp = document.getElementById('btn-mode-emp');
        const adminFields = document.getElementById('admin-fields');
        const empFields = document.getElementById('employee-fields');
        const loginTitle = document.querySelector('#login-view p');

        let loginMode = 'admin'; // 'admin' o 'employee'

        if (btnAdmin && btnEmp) {
            btnAdmin.onclick = () => {
                loginMode = 'admin';
                btnAdmin.style.background = 'var(--primary)';
                btnAdmin.style.color = 'white';
                btnEmp.style.background = 'transparent';
                btnEmp.style.color = 'var(--text-muted)';
                adminFields.style.display = 'block';
                empFields.style.display = 'none';
                if (loginTitle) loginTitle.innerText = 'Sistema de Control de Planillas';
            };

            btnEmp.onclick = () => {
                loginMode = 'employee';
                btnEmp.style.background = 'var(--primary)';
                btnEmp.style.color = 'white';
                btnAdmin.style.background = 'transparent';
                btnAdmin.style.color = 'var(--text-muted)';
                adminFields.style.display = 'none';
                empFields.style.display = 'block';
                if (loginTitle) loginTitle.innerText = 'Portal de Registro de Empleados';
                document.getElementById('employee-pin').focus();
            };
        }

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();

                if (loginMode === 'admin') {
                    const user = document.getElementById('username').value;
                    const pass = document.getElementById('password').value;
                    if (await Auth.login(user, pass)) {
                        location.reload();
                    } else {
                        if (error) {
                            error.innerText = 'Usuario o contraseña incorrectos.';
                            error.style.display = 'block';
                        }
                    }
                } else {
                    const pin = document.getElementById('employee-pin').value;
                    if (await Auth.employeeAuth(pin)) {
                        location.reload();
                    } else {
                        if (error) {
                            error.innerText = 'PIN incorrecto o empleado inactivo.';
                            error.style.display = 'block';
                        }
                    }
                }
            };
        }
    },

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.switchView(view);

                // Cerrar menú en móvil tras navegar
                const sidebar = document.getElementById('sidebar');
                if (window.innerWidth <= 1024 && sidebar) {
                    sidebar.classList.remove('active');
                }
            });
        });
    },

    async switchView(view, arg = null) {
        const navItem = document.querySelector(`[data-view="${view}"]`);
        if (navItem) {
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            navItem.classList.add('active');
        }

        const titles = {
            dashboard: 'Dashboard',
            employees: 'Gestión de Empleados',
            employeeDetail: 'Detalle de Empleado',
            calculator: 'Calculadora de Pago Semanal',
            payroll: 'Cálculo de Planillas',
            benefits: 'Prestaciones de Ley',
            import: 'Importar Datos Excel',
            profile: 'Configuración de Mi Perfil'
        };

        const viewTitle = document.getElementById('view-title');
        if (viewTitle) viewTitle.textContent = titles[view] || 'Planillas Tom Tom Wok';

        await this.renderView(view, arg);
    },

    async renderView(view, arg = null) {
        const container = document.getElementById('view-container');
        if (!container) return;

        container.innerHTML = `<div class="view-loading">Cargando vista...</div>`;
        const html = await Views[view](arg);
        container.innerHTML = `<div class="view-animate">${html}</div>`;

        if (Views[`init_${view}`]) {
            await Views[`init_${view}`](arg);
        }
    }
};

// --- Global Utilities ---
window.clearTable = async (target) => {
    const labels = {
        logs: 'todas las horas pendientes',
        payments: 'todo el historial de pagos',
        employees: 'todos los empleados',
        all: 'TODA LA INFORMACIÓN (Horas, Pagos y Empleados)'
    };

    if (!confirm(`⚠️ ALERTA: ¿Está seguro de que desea eliminar ${labels[target]}?\n\nEsta acción no se puede deshacer.`)) return;

    // Doble confirmación para reinicio total
    if (target === 'all' && !confirm('¿ESTÁ ABSOLUTAMENTE SEGURO? Se perderán todos los datos registrados.')) return;

    Storage.showLoader(true, 'Limpiando base de datos...');
    try {
        const response = await fetch(`/api/maintenance/clear-all?target=${target}`, { method: 'DELETE' });
        const result = await response.json();
        Storage.showLoader(false);

        if (result.success) {
            alert('Limpieza completada con éxito.');
            location.reload(); // Recargar para limpiar todo el estado
        } else {
            alert('Error: ' + result.error);
        }
    } catch (err) {
        Storage.showLoader(false);
        alert('Error al conectar con el servidor.');
    }
};

// --- UI Components & Views ---
const Views = {
    dashboard: async () => {
        const employees = await Storage.get('employees');
        const activeEmployees = employees.filter(e => e.status === 'Active');
        const rawLogs = await Storage.get('logs');

        // Deduplicate logs
        const uniqueLogKeys = new Set();
        const logs = rawLogs.filter(l => {
            const key = `${l.employee_id}|${l.date}|${l.hours}|${l.time_in || ''}|${l.time_out || ''}`;
            if (uniqueLogKeys.has(key)) return false;
            uniqueLogKeys.add(key);
            return true;
        });

        const now = new Date();
        const todayStr = Storage.getLocalDate();
        const currentMonth = todayStr.substring(0, 7);
        const monthLogs = logs.filter(l => l.date && l.date.substring(0, 7) === currentMonth);
        const monthHours = monthLogs.reduce((s, l) => s + parseFloat(l.hours || 0), 0);

        const monthAmount = monthLogs.reduce((s, l) => {
            const emp = employees.find(e => e.id == l.employee_id);
            const gross = parseFloat(l.hours || 0) * (emp ? parseFloat(emp.hourly_rate) : 0);
            const deduction = (emp && emp.apply_ccss) ? (gross * 0.1067) : 0;
            return s + (gross - deduction);
        }, 0);

        const getWeekRange = (date) => {
            const d = new Date(date);
            const day = d.getDay();
            const dayNum = day === 0 ? 7 : day;
            const diffToMonday = 1 - dayNum;
            const monday = new Date(d);
            monday.setDate(d.getDate() + diffToMonday);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            const format = (dt) => dt.toISOString().split('T')[0];
            return { start: format(monday), end: format(sunday) };
        };

        const weekRange = getWeekRange(now);
        const weekLogs = logs.filter(l => l.date >= weekRange.start && l.date <= weekRange.end);
        const weekHours = weekLogs.reduce((s, l) => s + parseFloat(l.hours || 0), 0);
        const weekAmount = weekLogs.reduce((s, l) => {
            const emp = employees.find(e => e.id == l.employee_id);
            const gross = parseFloat(l.hours || 0) * (emp ? parseFloat(emp.hourly_rate) : 0);
            const deduction = (emp && emp.apply_ccss) ? (gross * 0.1067) : 0;
            return s + (gross - deduction);
        }, 0);

        const lastWeekDate = new Date(now);
        lastWeekDate.setDate(now.getDate() - 7);
        const lastWeekRange = getWeekRange(lastWeekDate);
        const lastWeekLogs = logs.filter(l => l.date >= lastWeekRange.start && l.date <= lastWeekRange.end);
        const lastWeekHours = lastWeekLogs.reduce((s, l) => s + parseFloat(l.hours || 0), 0);
        const lastWeekAmount = lastWeekLogs.reduce((s, l) => {
            const emp = employees.find(e => e.id == l.employee_id);
            const gross = parseFloat(l.hours || 0) * (emp ? parseFloat(emp.hourly_rate) : 0);
            const deduction = (emp && emp.apply_ccss) ? (gross * 0.1067) : 0;
            return s + (gross - deduction);
        }, 0);

        return `
            <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr) !important;">
                <div class="stat-card">
                    <h3>Empleados Activos</h3>
                    <div class="value">${activeEmployees.length}</div>
                    <div class="trend up">👥 Personal Actual</div>
                </div>
                <div class="stat-card">
                    <h3>Semana Pasada</h3>
                    <div class="value">${lastWeekHours.toFixed(1)}h</div>
                    <div style="font-size: 1.2rem; margin-top: 0.5rem; color: var(--success)">₡${Math.round(lastWeekAmount).toLocaleString()}</div>
                    <div class="trend" style="font-size: 0.75rem">${lastWeekRange.start} al ${lastWeekRange.end}</div>
                </div>
                <div class="stat-card">
                    <h3>Semana Actual</h3>
                    <div class="value">${weekHours.toFixed(1)}h</div>
                    <div style="font-size: 1.2rem; margin-top: 0.5rem; color: var(--success)">₡${Math.round(weekAmount).toLocaleString()}</div>
                    <div class="trend" style="font-size: 0.75rem">${weekRange.start} al ${weekRange.end}</div>
                </div>
                <div class="stat-card">
                    <h3>Acumulado del Mes</h3>
                    <div class="value">${monthHours.toFixed(1)}h</div>
                    <div style="font-size: 1.2rem; margin-top: 0.5rem; color: var(--success)">₡${Math.round(monthAmount).toLocaleString()}</div>
                    <div class="trend">${now.toLocaleString('es-ES', { month: 'long' }).toUpperCase()}</div>
                </div>
            </div>

            <div style="margin-top: 2rem">
                <div class="card-container">
                    <h3>Historial de Salarios Pagados (Último Año)</h3>
                    <div style="height: 350px; margin-top: 2rem">
                        <canvas id="salaryChart"></canvas>
                    </div>
                </div>
            </div>
        `;
    },

    init_dashboard: async () => {
        const payments = await Storage.get('payments');
        const ctx = document.getElementById('salaryChart');
        if (!ctx) return;

        const months = [];
        const data = [];
        const now = new Date();

        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = d.toISOString().substring(0, 7);
            const monthLabel = d.toLocaleString('es-ES', { month: 'short' }).toUpperCase();

            const monthTotal = payments
                .filter(p => p.date && p.date.startsWith(monthStr))
                .reduce((s, p) => s + parseFloat(p.amount || 0), 0);

            months.push(monthLabel);
            data.push(monthTotal);
        }

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [{
                    label: 'Salarios Pagados (₡)',
                    data: data,
                    backgroundColor: 'rgba(99, 102, 241, 0.4)',
                    borderColor: '#6366f1',
                    borderWidth: 2,
                    borderRadius: 8,
                    hoverBackgroundColor: '#6366f1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return 'Total: ₡' + context.raw.toLocaleString();
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: {
                            color: '#94a3b8',
                            callback: function (value) {
                                return '₡' + value.toLocaleString();
                            }
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    },

    employees: async () => {
        const employees = await Storage.get('employees');
        const statusFilter = localStorage.getItem('gn_employee_status_filter') || 'Active';

        const filteredEmployees = employees.filter(emp => {
            if (statusFilter === 'All') return true;
            return emp.status === statusFilter;
        });

        return `
            <div class="card-container">
                <div class="table-header">
                    <div>
                        <h3 style="margin:0">Lista de Colaboradores</h3>
                        <p style="font-size: 0.8rem; color: var(--text-muted)">Gestión interna de personal</p>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center">
                        <select id="employee-status-filter" style="width: auto; padding: 6px 12px;">
                            <option value="Active" ${statusFilter === 'Active' ? 'selected' : ''}>Solo Activos</option>
                            <option value="Inactive" ${statusFilter === 'Inactive' ? 'selected' : ''}>Inactivos</option>
                            <option value="All" ${statusFilter === 'All' ? 'selected' : ''}>Todos</option>
                        </select>
                        <button class="btn" style="background: rgba(239,68,68,0.1); color: var(--danger)" id="deactivate-all-btn">🛑 Desactivar Todos</button>
                        <button class="btn btn-primary" id="add-employee-btn">+ Nuevo Empleado</button>
                    </div>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Cargo</th>
                                <th>Pago x Hora</th>
                                <th>Estado</th>
                                <th>Inicio / Fin</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredEmployees.map(emp => `
                                <tr>
                                    <td style="font-weight:600; cursor:pointer; color:white" onclick="App.switchView('employeeDetail', '${emp.id}')">${emp.name}</td>
                                    <td>${emp.position}</td>
                                    <td>₡${parseFloat(emp.hourly_rate).toLocaleString()}</td>
                                    <td>
                                        <span class="tag ${emp.status === 'Active' ? 'tag-active' : 'tag-inactive'}">
                                            ${emp.status === 'Active' ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style="font-size: 0.85rem">📅 ${emp.start_date ? emp.start_date.split('T')[0] : '—'}</div>
                                        ${emp.end_date ? `<div style="font-size: 0.85rem; color: var(--danger)">🚪 ${emp.end_date.split('T')[0]}</div>` : ''}
                                    </td>
                                    <td style="padding: 1.25rem 1rem;">
                                        <div style="display: flex; gap: 8px; align-items: center;">
                                            <button class="btn" style="padding: 4px 8px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2)" onclick="window.editEmployee('${emp.id}')" title="Editar">✏️</button>
                                            <button class="btn" style="padding: 4px 8px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2)" onclick="App.switchView('employeeDetail', '${emp.id}')" title="Ver Detalle">👁️</button>
                                            <button class="btn" style="padding: 4px 8px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2)" onclick="window.deleteEmployee('${emp.id}')" title="Eliminar">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                            ${filteredEmployees.length === 0 ? '<tr><td colspan="6" style="text-align:center">No hay empleados con este estado</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>

            <dialog id="employee-modal">
                <div class="modal-content" style="max-height: 85vh; overflow-y: auto;">
                    <button class="modal-close-btn" onclick="document.getElementById('employee-modal').close()">✕</button>
                    <h3 id="modal-title" style="margin-bottom: 1.5rem">Registrar Empleado</h3>
                    <form id="employee-form" style="display: flex; flex-direction: column; gap: 15px;">
                        <input type="hidden" name="id" id="edit-emp-id">
                        <div class="form-group">
                            <label>Nombre Completo</label>
                            <input type="text" name="name" placeholder="Ej: Juan Pérez" required>
                        </div>
                        <div class="form-group">
                            <label>Número de Cédula</label>
                            <input type="text" name="cedula" placeholder="Ej: 1-2345-6789">
                        </div>
                        <div class="form-group">
                            <label>Teléfono (WhatsApp)</label>
                            <input type="text" name="phone" placeholder="Ej: 50688888888">
                        </div>
                        <div class="form-group" style="background: rgba(99,102,241,0.05); padding: 1rem; border-radius: 8px; border: 1px solid rgba(99,102,241,0.3);">
                            <label style="color: var(--primary); font-weight: 600;">🔐 PIN de Acceso al Portal (4 dígitos)</label>
                            <input type="text" name="pin" placeholder="Ej: 1234" maxlength="4" pattern="[0-9]*" inputmode="numeric" style="margin-top: 0.5rem;">
                            <small style="color: var(--text-muted); font-size: 0.75rem; display: block; margin-top: 0.5rem;">Este PIN permite al empleado registrar sus horas en el portal de auto-servicio</small>
                        </div>
                        <div class="grid-2" style="gap: 1rem">
                            <div class="form-group">
                                <label>Cargo</label>
                                <input type="text" name="position" placeholder="Ej: Chef" required>
                            </div>
                            <div class="form-group">
                                <label>Pago por Hora (₡)</label>
                                <input type="number" name="hourlyRate" placeholder="3500" required>
                            </div>
                        </div>
                        <div class="grid-2" style="gap: 1rem">
                            <div class="form-group">
                                <label>Estado</label>
                                <select name="status">
                                    <option value="Active">Activo</option>
                                    <option value="Inactive">Inactivo</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Fecha Inicio</label>
                                <input type="date" name="startDate" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Fecha Terminación (Opcional)</label>
                            <input type="date" name="endDate">
                        </div>
                        <div class="form-group" style="display: flex; align-items: center; gap: 10px; background: rgba(99,102,241,0.05); padding: 10px; border-radius: 8px; border: 1px solid rgba(99,102,241,0.2);">
                            <input type="checkbox" name="applyCCSS" id="apply-ccss-check" style="width: 20px; height: 20px; cursor: pointer;">
                            <label for="apply-ccss-check" style="margin: 0; cursor: pointer; font-weight: 600;">Aplicar Rebajo CCSS (10.67%)</label>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="btn btn-primary" style="flex:1">Guardar</button>
                            <button type="button" class="btn btn-secondary" style="flex:1" onclick="document.getElementById('employee-modal').close()">Cancelar</button>
                        </div>
                    </form>
                </div>
            </dialog>
        `;
    },

    init_employees: async () => {
        const modal = document.getElementById('employee-modal');
        const btn = document.getElementById('add-employee-btn');
        const form = document.getElementById('employee-form');
        const statusFilter = document.getElementById('employee-status-filter');
        const modalTitle = document.getElementById('modal-title');
        const editIdInput = document.getElementById('edit-emp-id');

        if (statusFilter) {
            statusFilter.onchange = () => {
                localStorage.setItem('gn_employee_status_filter', statusFilter.value);
                App.renderView('employees');
            };
        }

        const deactivateBtn = document.getElementById('deactivate-all-btn');
        if (deactivateBtn) {
            deactivateBtn.onclick = async () => {
                if (!confirm('¿Está seguro de que desea poner a TODOS los empleados como Inactivos?')) return;
                const employees = await Storage.get('employees');
                const today = Storage.getLocalDate();
                for (const emp of employees) {
                    await Storage.update('employees', emp.id, {
                        ...emp,
                        hourlyRate: emp.hourly_rate, // Map back to API field names if necessary
                        startDate: emp.start_date,
                        applyCCSS: emp.apply_ccss,
                        status: 'Inactive',
                        endDate: emp.end_date || today
                    });
                }
                App.renderView('employees');
            };
        }

        btn.onclick = () => {
            form.reset();
            editIdInput.value = '';
            modalTitle.textContent = 'Registrar Empleado';
            modal.showModal();
        };

        window.editEmployee = async (id) => {
            const employees = await Storage.get('employees');
            const emp = employees.find(e => e.id == id);
            if (!emp) return;

            modalTitle.textContent = 'Editar Empleado';
            editIdInput.value = emp.id;
            form.name.value = emp.name;
            form.cedula.value = emp.cedula || '';
            form.phone.value = emp.phone || '';
            form.pin.value = emp.pin || '';
            form.position.value = emp.position;
            form.hourlyRate.value = emp.hourly_rate;
            form.status.value = emp.status;
            form.startDate.value = emp.start_date ? emp.start_date.split('T')[0] : '';
            form.endDate.value = emp.end_date ? emp.end_date.split('T')[0] : '';
            form.applyCCSS.checked = !!emp.apply_ccss;

            modal.showModal();
        };

        window.deleteEmployee = async (id) => {
            const employees = await Storage.get('employees');
            const emp = employees.find(e => e.id == id);
            if (!emp) return;

            const modalHtml = `
                <dialog id="delete-confirm-modal" class="modal">
                    <div class="modal-content" style="max-width: 400px; text-align: center;">
                        <button class="modal-close-btn" onclick="document.getElementById('delete-confirm-modal').close(); document.getElementById('delete-confirm-modal').remove();">✕</button>
                        <div style="font-size: 3rem; margin-bottom: 1rem">⚠️</div>
                        <h3 style="color: var(--danger); margin-bottom: 1rem">¿Eliminar Empleado?</h3>
                        <p style="color: var(--text-muted); margin-bottom: 2rem">Esta acción eliminará a <strong>${emp.name}</strong> y todos sus registros. No se puede deshacer.</p>
                        <div style="display: flex; gap: 10px;">
                            <button id="confirm-delete-btn" class="btn" style="background: var(--danger); flex: 1">Eliminar</button>
                            <button class="btn" style="flex: 1" onclick="document.getElementById('delete-confirm-modal').close(); document.getElementById('delete-confirm-modal').remove();">Cancelar</button>
                        </div>
                    </div>
                </dialog>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = document.getElementById('delete-confirm-modal');
            modal.showModal();

            document.getElementById('confirm-delete-btn').onclick = async () => {
                if (await Storage.delete('employees', id)) {
                    modal.close();
                    modal.remove();
                    App.renderView('employees');
                }
            };
        };

        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const id = editIdInput.value;
            const empData = {
                name: formData.get('name'),
                cedula: formData.get('cedula'),
                phone: formData.get('phone'),
                pin: formData.get('pin'),
                position: formData.get('position'),
                hourlyRate: parseFloat(formData.get('hourlyRate')),
                startDate: formData.get('startDate'),
                endDate: formData.get('endDate') || null,
                status: formData.get('status'),
                applyCCSS: form.applyCCSS.checked,
                salaryHistory: [] // To be handled by detail edit
            };

            if (id) {
                // Keep the old salary history if updating
                const employees = await Storage.get('employees');
                const oldEmp = employees.find(e => e.id == id);
                if (oldEmp) empData.salaryHistory = oldEmp.salary_history || [];
                await Storage.update('employees', id, empData);
            } else {
                await Storage.add('employees', empData);
            }

            modal.close();
            if (App.currentView === 'employeeDetail') {
                App.renderView('employeeDetail', id);
            } else {
                App.renderView('employees');
            }
        };
    },

    employeeDetail: async (id) => {
        const employees = await Storage.get('employees');
        const emp = employees.find(e => e.id == id);
        if (!emp) return 'Empleado no encontrado';

        const rawLogs = await Storage.get('logs');
        const logs = rawLogs.filter(l => l.employee_id == id);

        const payments = await Storage.get('payments');
        const empPayments = payments.filter(p => p.employee_id == id);

        const history = emp.salary_history || [{ date: emp.start_date ? emp.start_date.split('T')[0] : '', rate: emp.hourly_rate, reason: 'Salario Inicial' }];

        return `
            <div class="card-container">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem">
                    <div>
                        <h2 style="margin:0; color: var(--primary)">${emp.name}</h2>
                        <p style="color: var(--text-muted)">${emp.position} | ₡${parseFloat(emp.hourly_rate).toLocaleString()} por hora</p>
                    </div>
                    <div style="display: flex; gap: 10px">
                        <button class="btn" style="background: rgba(99,102,241,0.1)" onclick="App.switchView('employees')">⬅️ Volver</button>
                        <button class="btn btn-primary" onclick="window.editEmployee('${emp.id}')">✏️ Editar Perfil Completo</button>
                    </div>
                </div>

                <div class="stats-grid" style="margin-bottom: 2rem">
                    <div class="stat-card">
                        <h3>Total Horas</h3>
                        <div class="value">${logs.reduce((s, l) => s + parseFloat(l.hours || 0), 0).toFixed(1)}h</div>
                    </div>
                    <div class="stat-card" style="border-left: 4px solid var(--success)">
                        <h3>Total Pagado</h3>
                        <div class="value" style="color: var(--success)">₡${empPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0).toLocaleString()}</div>
                    </div>
                </div>

                <div class="grid-2">
                    <div class="card-container" style="background: rgba(255,255,255,0.02)">
                        <h3>Historial de Cambios Salariales</h3>
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Tarifa</th>
                                        <th>Motivo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${history.map(h => `
                                        <tr>
                                            <td>${h.date}</td>
                                            <td>₡${parseFloat(h.rate).toLocaleString()}</td>
                                            <td style="font-size: 0.85rem">${h.reason}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="card-container" style="background: rgba(255,255,255,0.02)">
                        <h3>Proyección de Rebajos (Base Actual)</h3>
                        <div style="padding: 1rem; background: var(--bg-body); border-radius: 8px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem">
                                <span>Aplicar CCSS:</span>
                                <b>${emp.apply_ccss ? 'SÍ (10.67%)' : 'NO'}</b>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem">
                                <span>Salario Bruto (Ej. 48h):</span>
                                <span>₡${(48 * emp.hourly_rate).toLocaleString()}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-weight: 600; color: var(--danger)">
                                <span>Deducción estimada:</span>
                                <span>₡${emp.apply_ccss ? (48 * emp.hourly_rate * 0.1067).toLocaleString() : '0'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card-container" style="margin-top: 2rem;">
                    <h3 style="margin-bottom: 1.5rem">Historial de Pagos Realizados</h3>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha de Pago</th>
                                    <th>Periodo</th>
                                    <th>Monto Pagado</th>
                                    <th>Método</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${empPayments.length > 0 ? empPayments.sort((a, b) => new Date(b.date) - new Date(a.date)).map(p => `
                                    <tr>
                                        <td style="color: white">${p.date ? p.date.split('T')[0] : '—'}</td>
                                        <td>${p.period || 'N/A'}</td>
                                        <td style="font-weight: 600; color: var(--success)">₡${parseFloat(p.amount).toLocaleString()}</td>
                                        <td>${p.method || 'Transferencia'}</td>
                                        <td><span class="tag tag-active">Pagado</span></td>
                                    </tr>
                                `).join('') : '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted)">No hay pagos registrados para este empleado.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Eliminado modal local para usar el global window.editEmployee -->
        `;
    },

    init_employeeDetail: async (id) => {
        // No necesitamos inicializar nada aquí ya que usamos window.editEmployee que es global
    },

    calculator: async () => {
        const employees = await Storage.get('employees');
        const user = Auth.getUser();
        const isAdmin = user && user.role === 'admin';
        const activeEmployees = employees.filter(e => e.status === 'Active');

        return `
            <div class="card-container">
                <div style="margin-bottom: 2rem">
                    <h3 style="color: var(--primary)">${isAdmin ? 'Calculadora de Pago por Periodo' : 'Portal de Registro de Horas'}</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem">
                        ${isAdmin ? 'Ingrese las horas diarias para calcular el pago total de la semana o mes.' : 'Bienvenido ' + user.name + '. Ingrese sus horas laboradas aquí.'}
                    </p>
                </div>

                <div class="form-group" style="max-width: 400px; margin-bottom: 2rem; ${isAdmin ? '' : 'display: none'}">
                    <label>Seleccionar Empleado</label>
                    <select id="calc-employee-id" required>
                        ${isAdmin ? '<option value="">Seleccione un empleado...</option>' : ''}
                        ${activeEmployees.map(e => `
                            <option value="${e.id}" ${(!isAdmin && e.id == user.id) ? 'selected' : ''}>
                                ${e.name} (₡${parseFloat(e.hourly_rate).toLocaleString()}/h)
                            </option>
                        `).join('')}
                    </select>
                </div>
                ${!isAdmin ? `<div style="margin-bottom: 2rem; padding: 1rem; background: rgba(99,102,241,0.1); border-radius: 12px; border-left: 4px solid var(--primary);">
                    <div style="font-weight: 600; font-size: 1.1rem; color: white">${user.name}</div>
                    <div style="color: var(--text-muted); font-size: 0.85rem">Registrando horas para el historial</div>
                </div>` : ''}

                <div class="table-container">
                    <table id="calc-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Entrada</th>
                                <th>Salida</th>
                                <th>Horas</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody id="calc-tbody">
                            <!-- Rows injected here -->
                        </tbody>
                    </table>
                </div>

                <div style="margin-top: 1.5rem; display: flex; gap: 10px;">
                    <button class="btn" style="background: rgba(255,255,255,0.05)" id="calc-add-row">+ Añadir Día</button>
                    <button class="btn btn-primary" id="calc-save-logs" disabled>💾 Guardar en Historial</button>
                </div>

                <div id="calc-summary" style="margin-top: 3rem; padding: 2rem; background: rgba(99, 102, 241, 0.05); border-radius: 20px; border: 1px solid var(--primary); display: none;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; text-align: center;">
                        <div>
                            <div style="color: var(--text-muted); font-size: 0.9rem">Total Horas</div>
                            <div class="value" id="calc-total-hours" style="font-size: 2.5rem; color: var(--primary)">0.00h</div>
                        </div>
                        <div>
                            <div style="color: var(--text-muted); font-size: 0.9rem">Monto Total</div>
                            <div class="value" id="calc-total-pay" style="font-size: 2.5rem; color: var(--success)">₡0</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    init_calculator: async () => {
        const tbody = document.getElementById('calc-tbody');
        const addRowBtn = document.getElementById('calc-add-row');
        const saveBtn = document.getElementById('calc-save-logs');
        const empSelect = document.getElementById('calc-employee-id');
        const summary = document.getElementById('calc-summary');

        let rowCount = 0;

        const createRow = () => {
            rowCount++;
            const lastRow = tbody.lastElementChild;
            let nextDateStr = Storage.getLocalDate();
            let nextIn = "08:00";
            let nextOut = "17:00";

            if (lastRow) {
                const lastDateVal = lastRow.querySelector('.calc-date').value;
                const lastInVal = lastRow.querySelector('.calc-in').value;
                const lastOutVal = lastRow.querySelector('.calc-out').value;

                if (lastDateVal) {
                    const [y, m, d] = lastDateVal.split('-').map(Number);
                    const dt = new Date(y, m - 1, d);
                    dt.setDate(dt.getDate() + 1);
                    nextDateStr = Storage.getLocalDate(dt);
                }
                nextIn = lastInVal;
                nextOut = lastOutVal;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="date" class="calc-date" value="${nextDateStr}"></td>
                <td><input type="time" class="calc-in" value="${nextIn}"></td>
                <td><input type="time" class="calc-out" value="${nextOut}"></td>
                <td class="calc-subtotal" style="font-weight: 600">0.00h</td>
                <td><button class="btn" style="padding: 6px; color: var(--danger)" onclick="this.closest('tr').remove(); window.updateCalcTotal();">✕</button></td>
            `;
            tbody.appendChild(tr);

            tr.querySelectorAll('input').forEach(input => {
                input.oninput = () => window.updateCalcTotal();
            });
            window.updateCalcTotal();
        };

        window.updateCalcTotal = async () => {
            const rows = tbody.querySelectorAll('tr');
            let totalH = 0;
            const empId = empSelect.value;
            const employees = await Storage.get('employees');
            const emp = employees.find(e => e.id == empId);
            const rate = emp ? parseFloat(emp.hourly_rate) : 0;

            rows.forEach(tr => {
                const tIn = tr.querySelector('.calc-in').value;
                const tOut = tr.querySelector('.calc-out').value;
                if (tIn && tOut) {
                    const start = new Date(`2000-01-01T${tIn}`);
                    const end = new Date(`2000-01-01T${tOut}`);
                    let diff = (end - start) / 1000 / 60 / 60;
                    if (diff < 0) diff += 24;
                    tr.querySelector('.calc-subtotal').textContent = diff.toFixed(2) + 'h';
                    totalH += diff;
                }
            });

            document.getElementById('calc-total-hours').textContent = totalH.toFixed(2) + 'h';
            document.getElementById('calc-total-pay').textContent = '₡' + Math.round(totalH * rate).toLocaleString();

            summary.style.display = totalH > 0 ? 'block' : 'none';
            saveBtn.disabled = !empId || totalH <= 0;
        };

        empSelect.onchange = () => window.updateCalcTotal();
        addRowBtn.onclick = () => createRow();

        window.clearCalculator = () => {
            tbody.innerHTML = '';
            createRow();
        };

        if (Auth.getUser().role === 'employee') {
            window.updateCalcTotal();
        }

        saveBtn.onclick = async () => {
            const empId = empSelect.value;
            if (!empId) return;

            const rows = tbody.querySelectorAll('tr');
            let successCount = 0;

            Storage.showLoader(true, 'Guardando registros...');

            for (const tr of rows) {
                const date = tr.querySelector('.calc-date').value;
                const tIn = tr.querySelector('.calc-in').value;
                const tOut = tr.querySelector('.calc-out').value;

                const start = new Date(`2000-01-01T${tIn}`);
                const end = new Date(`2000-01-01T${tOut}`);
                let diff = (end - start) / 1000 / 60 / 60;
                if (diff < 0) diff += 24;

                await Storage.add('logs', {
                    employeeId: parseInt(empId),
                    date: date,
                    timeIn: tIn,
                    timeOut: tOut,
                    hours: diff.toFixed(2),
                    isImported: false
                });
                successCount++;
            }

            Storage.showLoader(false);
            alert(`¡Éxito! Se guardaron ${successCount} registros correspondientes a su tiempo laborado.`);

            if (Auth.getUser().role === 'admin') {
                App.switchView('payroll');
            } else {
                window.clearCalculator();
            }
        };

        createRow();
    },

    payroll: async () => {
        const employees = await Storage.get('employees');
        const logs = await Storage.get('logs');
        const payments = await Storage.get('payments');

        // Filtrar logs no pagados y mapearlos con datos del empleado
        const pendingLogs = logs.filter(l => !l.is_paid).map(log => {
            const emp = employees.find(e => e.id == log.employee_id);
            if (!emp) return null;

            const hours = parseFloat(log.hours);
            const gross = hours * parseFloat(emp.hourly_rate);
            const deduction = emp.apply_ccss ? (gross * 0.1067) : 0;
            const net = gross - deduction;

            return {
                id: log.id,
                empId: emp.id,
                name: emp.name,
                date: log.date ? log.date.split('T')[0] : '—',
                hours: hours,
                gross: gross,
                deduction: deduction,
                net: net
            };
        }).filter(l => l !== null).sort((a, b) => new Date(b.date) - new Date(a.date));

        return `
            <div class="card-container">
                <div class="table-header">
                    <h3>Resumen de Pagos Pendientes</h3>
                    <div style="display: flex; gap: 10px">
                         <button class="btn btn-danger" onclick="window.clearAllLogs()">🗑️ Limpiar Todo</button>
                         <button class="btn btn-primary" id="process-payroll-btn">💳 Pagar Seleccionados</button>
                    </div>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 40px"><input type="checkbox" id="select-all-pending" checked></th>
                                <th>Fecha</th>
                                <th>Empleado</th>
                                <th>Horas</th>
                                <th>CCSS (Est.)</th>
                                <th>Monto Neto</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pendingLogs.map(pl => `
                                <tr>
                                    <td><input type="checkbox" class="pending-check" data-id="${pl.id}" data-empid="${pl.empId}" data-hours="${pl.hours}" data-net="${pl.net}" data-deduction="${pl.deduction}" data-date="${pl.date}" checked></td>
                                    <td style="font-size: 0.85rem">${pl.date}</td>
                                    <td style="font-weight: 600; color: white;">${pl.name}</td>
                                    <td>${pl.hours.toFixed(1)}h</td>
                                    <td style="color: var(--danger)">₡${Math.round(pl.deduction).toLocaleString()}</td>
                                    <td style="color: var(--success); font-weight: 600;">₡${Math.round(pl.net).toLocaleString()}</td>
                                    <td><button class="btn btn-danger" onclick="window.deleteLog(${pl.id})" style="padding: 4px 8px; font-size: 0.8rem">🗑️</button></td>
                                </tr>
                            `).join('')}
                            ${pendingLogs.length === 0 ? '<tr><td colspan="7" style="text-align:center">No hay horas pendientes de pago</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card-container" style="margin-top: 2rem">
                <div class="table-header">
                    <h3>Historial de Pagos</h3>
                    <div style="display: flex; gap: 10px">
                        <button class="btn btn-warning" onclick="window.exportPayments()">📥 Excel</button>
                        <button class="btn btn-danger" id="delete-selected-payments">🗑️ Eliminar</button>
                    </div>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 40px"><input type="checkbox" id="select-all-payments"></th>
                                <th>Fecha</th>
                                <th>Empleado</th>
                                <th>Horas</th>
                                <th>Total Pagado</th>
                                <th>Importado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${payments.sort((a, b) => new Date(b.date) - new Date(a.date)).map(p => {
            const emp = employees.find(e => e.id == p.employee_id);
            return `
                                    <tr>
                                        <td><input type="checkbox" class="payment-check" data-id="${p.id}"></td>
                                        <td>${p.date ? p.date.split('T')[0] : '—'}</td>
                                        <td style="font-weight: 600; color: white;">${emp ? emp.name : 'Desconocido'}</td>
                                        <td>${parseFloat(p.hours || 0).toFixed(1)}h</td>
                                        <td style="color: var(--success); font-weight: 700;">₡${Math.round(p.amount).toLocaleString()}</td>
                                        <td>${p.is_imported ? '✅' : '❌'}</td>
                                        <td style="display: flex; gap: 5px">
                                            <button class="btn btn-secondary" style="padding: 5px 10px" onclick="window.shareWhatsApp('${p.id}')">📲</button>
                                            <button class="btn btn-danger" style="padding: 5px 10px" onclick="window.deletePayment('${p.id}')">🗑️</button>
                                        </td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    init_payroll: async () => {
        const processBtn = document.getElementById('process-payroll-btn');
        const selectAllPending = document.getElementById('select-all-pending');
        const selectAllPayments = document.getElementById('select-all-payments');

        if (selectAllPending) {
            selectAllPending.onclick = () => {
                document.querySelectorAll('.pending-check').forEach(c => c.checked = selectAllPending.checked);
            };
        }

        if (selectAllPayments) {
            selectAllPayments.onclick = () => {
                document.querySelectorAll('.payment-check').forEach(c => c.checked = selectAllPayments.checked);
            };
        }

        processBtn.onclick = async () => {
            const selected = document.querySelectorAll('.pending-check:checked');
            if (selected.length === 0) return alert('Seleccione al menos un pago');

            if (!confirm(`¿Procesar ${selected.length} pagos individuales?`)) return;

            Storage.showLoader(true, 'Procesando pagos...');

            try {
                for (const check of selected) {
                    const logId = check.dataset.id;
                    const empId = check.dataset.empid;
                    const hours = parseFloat(check.dataset.hours);
                    const net = parseFloat(check.dataset.net);
                    const deduction = parseFloat(check.dataset.deduction);
                    const logDate = check.dataset.date;

                    // 1. Guardar el pago (uno por cada log seleccionado)
                    const payResult = await Storage.add('payments', {
                        employeeId: parseInt(empId),
                        date: logDate, // Usamos la fecha del log para el historial
                        amount: net,
                        hours: hours,
                        deductionCCSS: deduction,
                        netAmount: net,
                        isImported: false
                    });

                    // 2. Solo si el pago se guardó bien, borramos ese log específico
                    if (payResult && payResult.success) {
                        await Storage.delete('logs', logId); // Borramos solo este registro de horas
                    } else {
                        console.error("Fallo al guardar pago para logId:", logId, payResult.error);
                        throw new Error(`No se pudo procesar el pago de uno o más registros.`);
                    }
                }

                Storage.showLoader(false);
                alert('¡Pagos procesados exitosamente!');

                // Forzar recarga completa de la vista
                App.switchView('payroll');
            } catch (err) {
                Storage.showLoader(false);
                console.error("Error al procesar planilla:", err);
                alert("Hubo un error al procesar algunos pagos.");
            }
        };

        window.deleteLog = async (id) => {
            if (!confirm('¿Desea eliminar este registro de horas?')) return;
            await Storage.delete('logs', id);
            App.renderView('payroll');
        };

        window.clearEmpLogs = async (id) => {
            if (!confirm('¿Borrar todas las horas pendientes de este empleado?')) return;
            await Storage.deleteLogsByEmployee(id);
            App.renderView('payroll');
        };

        window.clearAllLogs = async () => {
            if (!confirm('Esta acción borrará TODAS las horas registradas de TODOS los empleados. ¿Proceder?')) return;
            const employees = await Storage.get('employees');
            for (const emp of employees) {
                await Storage.deleteLogsByEmployee(emp.id);
            }
            App.renderView('payroll');
        };

        window.deletePayment = async (id) => {
            if (!confirm('¿Eliminar este registro de pago?')) return;
            await Storage.delete('payments', id);
            App.renderView('payroll');
        };

        const deleteSelectedBtn = document.getElementById('delete-selected-payments');
        if (deleteSelectedBtn) {
            deleteSelectedBtn.onclick = async () => {
                const selected = document.querySelectorAll('.payment-check:checked');
                if (selected.length === 0) return;
                if (!confirm(`¿Eliminar ${selected.length} pagos seleccionados?`)) return;

                for (const check of selected) {
                    await Storage.delete('payments', check.dataset.id);
                }
                App.renderView('payroll');
            };
        }

        window.shareWhatsApp = async (id) => {
            const payments = await Storage.get('payments');
            const employees = await Storage.get('employees');
            const p = payments.find(p => p.id == id);
            const emp = employees.find(e => e.id == p.employee_id);

            if (!p || !emp) return;

            const text = `*COMPROBANTE DE PAGO - TOM TOM WOK*%0A%0A` +
                `*Empleado:* ${emp.name}%0A` +
                `*Fecha:* ${p.date.split('T')[0]}%0A` +
                `*Horas Laboradas:* ${parseFloat(p.hours).toFixed(1)}h%0A` +
                `*Monto Pagado:* ₡${Math.round(p.amount).toLocaleString()}%0A%0A` +
                `¡Gracias por tu esfuerzo! 🍜`;

            const phone = emp.phone ? emp.phone.replace(/\D/g, '') : '';
            window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
        };

        window.exportPayments = async () => {
            const payments = await Storage.get('payments');
            const employees = await Storage.get('employees');
            const data = payments.map(p => {
                const emp = employees.find(e => e.id == p.employee_id);
                return {
                    Fecha: p.date.split('T')[0],
                    Empleado: emp ? emp.name : '—',
                    Horas: p.hours,
                    Monto: p.amount,
                    CCSS: p.deduction_ccss,
                    Importado: p.is_imported ? 'Sí' : 'No'
                };
            });

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Pagos");
            XLSX.writeFile(wb, `Pagos_TTW_${Storage.getLocalDate()}.xlsx`);
        };
    },

    benefits: async () => {
        const employees = await Storage.get('employees');
        return `
            <div class="grid-2">
                <div class="card-container">
                    <h3>Calculadora de Prestaciones (CR)</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem">Basado en legislación costarricense (Cálculo aproximado).</p>
                    <div class="form-group">
                        <label>Seleccionar Empleado</label>
                        <select id="benefit-emp-select">
                            <option value="">Seleccione...</option>
                            ${employees.filter(e => e.status === 'Active').map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
                        </select>
                    </div>
                    <div id="benefit-results" style="margin-top: 1.5rem">
                         <div style="text-align: center; color: var(--text-muted)">Seleccione un empleado para ver la proyección anual</div>
                    </div>
                </div>

                <div class="card-container" style="background: linear-gradient(135deg, var(--bg-card) 0%, #2d3748 100%); border: 1px solid var(--primary);">
                    <h3 style="color: var(--primary)">Información Legal</h3>
                    <ul style="margin: 1rem 0; color: var(--text-muted); line-height: 1.6; list-style-position: inside;">
                        <li><strong>Aguinaldo:</strong> Un mes de salario promedio (1/12 de lo ganado en el año).</li>
                        <li><strong>Vacaciones:</strong> 2 semanas por cada 50 trabajadas.</li>
                        <li><strong>Cesantía:</strong> Indemnización en caso de despido sin causa.</li>
                    </ul>
                    <div style="padding: 1rem; background: rgba(99, 102, 241, 0.1); border-radius: 12px; border-left: 4px solid var(--primary)">
                        <small>Estos cálculos son ilustrativos y se basan en el pago por hora actual multiplicado por una jornada estándar.</small>
                    </div>
                </div>
            </div>
        `;
    },

    init_benefits: async () => {
        const select = document.getElementById('benefit-emp-select');
        const results = document.getElementById('benefit-results');

        if (select) {
            select.onchange = async () => {
                const empId = select.value;
                if (!empId) return;

                const employees = await Storage.get('employees');
                const emp = employees.find(e => e.id == empId);
                const rate = parseFloat(emp.hourly_rate);
                const monthlySalary = rate * 8 * 26; // Est mntly (26 days)

                const aguinaldo = monthlySalary;
                const vacaciones = (monthlySalary / 30) * 14;
                const cesantia = monthlySalary * 0.5; // Simplificado

                results.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <div class="stat-card" style="background: rgba(255,255,255,0.02)">
                            <h3 style="margin:0">Proyección Aguinaldo</h3>
                            <div class="value" style="color: var(--success); font-size: 1.5rem">₡${Math.round(aguinaldo).toLocaleString()}</div>
                        </div>
                        <div class="stat-card" style="background: rgba(255,255,255,0.02)">
                            <h3 style="margin:0">Proyección Vacaciones</h3>
                            <div class="value" style="color: var(--warning); font-size: 1.5rem">₡${Math.round(vacaciones).toLocaleString()}</div>
                        </div>
                        <div class="stat-card" style="background: rgba(255,255,255,0.02)">
                            <h3 style="margin:0">Proyección Cesantía</h3>
                            <div class="value" style="color: var(--accent); font-size: 1.5rem">₡${Math.round(cesantia).toLocaleString()}</div>
                        </div>
                    </div>
                `;
            };
        }
    },

    import: async () => {
        return `
            <div class="card-container">
                <div style="margin-bottom: 2rem">
                    <h3>Importar Liquidación desde Excel</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem">Seleccione o arrastre el archivo de liquidación (Ini, Fin, Empleado, Horas...)</p>
                </div>
                
                <div id="drop-zone" class="import-zone" style="border: 2px dashed var(--primary); background: rgba(99,102,241,0.02); height: 250px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; border-radius: 20px;">
                    <div style="font-size: 3.5rem; margin-bottom: 1rem">📊</div>
                    <h4 id="drop-zone-text">Arrastra tu archivo aquí</h4>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem">o haz clic para buscar (.xlsx, .xls, .csv)</p>
                    <input type="file" id="excel-input" accept=".xlsx, .xls, .csv" style="position: absolute; width: 100%; height: 100%; opacity: 0; cursor: pointer;">
                </div>

                <div id="import-preview-container" style="margin-top: 3rem; display: none">
                    <div class="table-header">
                        <h3>Vista Previa de Importación</h3>
                        <div style="display: flex; gap: 10px">
                            <button class="btn btn-secondary" onclick="App.renderView('import')">Cancelar</button>
                            <button class="btn btn-primary" id="execute-import-btn">✅ Confirmar e Importar</button>
                        </div>
                    </div>
                    <div class="table-container">
                        <table id="preview-table">
                            <thead>
                                <tr>
                                    <th>Ini</th>
                                    <th>Fin</th>
                                    <th>Empleado</th>
                                    <th>Horas</th>
                                    <th>Salario Total</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    init_import: () => {
        const dropZone = document.getElementById('drop-zone');
        const input = document.getElementById('excel-input');
        const preview = document.getElementById('import-preview-container');
        let importedData = [];

        if (dropZone) dropZone.onclick = (e) => {
            if (e.target !== input) input.click();
        };

        const excelDateToJSDate = (serial) => {
            if (!serial) return null;

            // Si ya es un formato YYYY-MM-DD aproximado
            if (typeof serial === 'string' && /^\d{4}-\d{2}-\d{2}/.test(serial)) {
                return serial.split('T')[0];
            }

            // Si es un número (formato serial de Excel)
            if (!isNaN(serial) && typeof serial !== 'string') {
                const utc_days = Math.floor(serial - 25569);
                const utc_value = utc_days * 86400;
                const date_info = new Date(utc_value * 1000);
                return date_info.toISOString().split('T')[0];
            }

            // Si es un string tipo DD/MM/YYYY o DD-MM-YYYY
            if (typeof serial === 'string') {
                const parts = serial.split(/[/-]/);
                if (parts.length === 3) {
                    // Detectar si es DD/MM/YYYY o YYYY/MM/DD
                    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }

            // Intento final con el constructor de Date
            try {
                const d = new Date(serial);
                if (!isNaN(d.getTime())) {
                    return d.toISOString().split('T')[0];
                }
            } catch (e) { }

            return serial; // Devolver original si nada funciona
        };

        if (dropZone) {
            dropZone.ondragover = (e) => {
                e.preventDefault();
                dropZone.style.borderColor = 'var(--success)';
            };
            dropZone.ondragleave = () => {
                dropZone.style.borderColor = 'var(--primary)';
            };
            dropZone.ondrop = (e) => {
                e.preventDefault();
                dropZone.style.borderColor = 'var(--primary)';
                if (e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        try {
                            const data = new Uint8Array(ev.target.result);
                            const workbook = XLSX.read(data, { type: 'array' });
                            const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
                            const rows = sheetData.slice(1).filter(r => r && Array.isArray(r) && r.length > 0);
                            if (rows.length === 0) alert("No se encontraron filas de datos en el archivo.");
                            processImportableData(rows);
                        } catch (err) {
                            console.error(err);
                            alert("Error al procesar el archivo: " + err.message);
                        }
                    };
                    reader.readAsArrayBuffer(file);
                }
            };
        }

        if (input) input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = new Uint8Array(ev.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
                    const rows = sheetData.slice(1).filter(r => r && Array.isArray(r) && r.length > 0);
                    if (rows.length === 0) alert("No se encontraron filas de datos en el archivo.");
                    processImportableData(rows);
                } catch (err) {
                    console.error(err);
                    alert("Error al procesar el archivo: " + err.message);
                }
            };
            reader.readAsArrayBuffer(file);
        };

        const processImportableData = async (rows) => {
            const employees = await Storage.get('employees');
            const tbody = document.querySelector('#preview-table tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            importedData = [];

            console.log("Procesando", rows.length, "filas. Empleados actuales:", employees.length);

            for (const row of rows) {
                // Columnas: A(0)=Ini, B(1)=Fin, C(2)=Empleado, D(3)=Horas, ..., O(14)=Total
                const name = row[2] ? String(row[2]).trim() : null;
                if (!name || name === "Empleado") continue; // Saltar si no hay nombre o es encabezado repetido

                const hours = parseFloat(row[3]) || 0;
                const amount = parseFloat(row[14]) || 0;
                const dateIni = excelDateToJSDate(row[0]);
                const dateFin = excelDateToJSDate(row[1]);

                // Búsqueda más flexible del empleado
                const emp = employees.find(e =>
                    e.name.trim().toLowerCase() === name.toLowerCase() ||
                    e.name.trim().toLowerCase().includes(name.toLowerCase())
                );

                const statusText = emp ? '✅ Vinculado' : '⚠️ Autocrear';

                importedData.push({
                    name: name,
                    hours: hours,
                    amount: amount,
                    date: dateFin || Storage.getLocalDate(),
                    employee_id: emp ? emp.id : null,
                    rate: emp ? parseFloat(emp.hourly_rate) : (hours > 0 ? (amount / hours) : 3500)
                });

                tbody.innerHTML += `
                    <tr>
                        <td>${dateIni || '-'}</td>
                        <td>${dateFin || '-'}</td>
                        <td style="font-weight:600">${name}</td>
                        <td>${hours.toFixed(1)}h</td>
                        <td>₡${Math.round(amount).toLocaleString()}</td>
                        <td style="color: ${emp ? 'var(--success)' : 'var(--warning)'}">${statusText}</td>
                    </tr>
                `;
            }

            if (importedData.length > 0) {
                preview.style.display = 'block';
                dropZone.style.display = 'none';
            } else {
                alert("No se encontraron registros válidos. Verifique que el nombre esté en la columna C y que el archivo no esté protegido.");
            }
        };

        const executeBtn = document.getElementById('execute-import-btn');
        if (executeBtn) {
            executeBtn.onclick = async () => {
                if (!confirm(`Se importarán ${importedData.length} registros. ¿Continuar?`)) return;

                Storage.showLoader(true, 'Preparando lista de empleados...', 0);

                try {
                    // Obtener lista fresca de empleados
                    let employees = await Storage.get('employees');
                    let successCount = 0;
                    let errorCount = 0;

                    for (let i = 0; i < importedData.length; i++) {
                        const item = importedData[i];
                        const progress = Math.round(((i + 1) / importedData.length) * 100);
                        Storage.showLoader(true, `Procesando (${i + 1}/${importedData.length}): ${item.name}`, progress);

                        try {
                            const trimmedName = item.name.trim();
                            // IMPORTANTE: Buscar de nuevo por nombre para evitar duplicar si ya lo creamos
                            // en una iteración anterior de este mismo bucle.
                            let emp = employees.find(e =>
                                e.name.trim().toLowerCase() === trimmedName.toLowerCase()
                            );

                            let empId = emp ? emp.id : null;

                            // Si no existe, lo creamos
                            if (!empId) {
                                const newEmpResult = await Storage.add('employees', {
                                    name: trimmedName,
                                    position: 'Importado',
                                    hourlyRate: item.rate || 3500,
                                    startDate: item.date,
                                    status: 'Active',
                                    applyCCSS: false,
                                    salaryHistory: []
                                });

                                if (newEmpResult.success && newEmpResult.id) {
                                    empId = newEmpResult.id;
                                    // Lo añadimos a nuestra lista local para no volver a crearlo si aparece más abajo
                                    employees.push({
                                        id: empId,
                                        name: trimmedName,
                                        hourly_rate: item.rate || 3500
                                    });
                                } else {
                                    console.error("No se pudo crear empleado:", trimmedName);
                                    errorCount++;
                                    continue;
                                }
                            }

                            // Guardar el log de horas vinculándolo al ID encontrado/creado
                            const logResult = await Storage.add('logs', {
                                employeeId: parseInt(empId),
                                date: item.date,
                                hours: item.hours,
                                notes: 'Importado de Excel',
                                isImported: true
                            });

                            if (logResult.success) {
                                successCount++;
                            } else {
                                errorCount++;
                            }
                        } catch (err) {
                            console.error("Fallo registro individual:", err);
                            errorCount++;
                        }
                    }

                    Storage.showLoader(false);
                    alert(`Importación finalizada.\n✅ Éxito: ${successCount}\n❌ Error/Omitido: ${errorCount}`);
                    App.switchView('payroll');

                } catch (err) {
                    Storage.showLoader(false);
                    console.error("Error crítico en importación:", err);
                    alert("Error crítico durante la importación.");
                }
            };
        }
    },

    profile: async () => {
        const users = await Storage.get('users');
        return `
            <div class="card-container">
                <div class="table-header">
                    <h3>Gestión de Usuarios Admins</h3>
                    <button class="btn btn-primary" onclick="window.openUserModal()">+ Nuevo Admin</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Usuario</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(u => `
                                <tr>
                                    <td>${u.name}</td>
                                    <td>${u.username}</td>
                                    <td>
                                        <button class="btn btn-secondary" style="padding: 4px 8px;" onclick="window.openUserModal('${u.id}')">✏️</button>
                                        <button class="btn btn-danger" style="padding: 4px 8px;" onclick="window.deleteUser('${u.id}')">🗑️</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            <div class="card-container" style="margin-top: 2rem; border: 1px solid var(--danger); background: rgba(239, 68, 68, 0.02);">
                <div style="margin-bottom: 1.5rem">
                    <h3 style="color: var(--danger)">🛠️ Zona de Mantenimiento</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem">Use estas opciones para corregir errores de importación o reiniciar el sistema. <strong>Cuidado: Esta acción es irreversible.</strong></p>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <button class="btn btn-danger" onclick="window.clearTable('logs')">🗑️ Borrar Horas Pendientes</button>
                    <button class="btn btn-danger" onclick="window.clearTable('payments')">🗑️ Borrar Historial Pagos</button>
                    <button class="btn btn-danger" onclick="window.clearTable('employees')">🗑️ Borrar Todos los Empleados</button>
                    <button class="btn" style="background: var(--danger); color: white; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);" onclick="window.clearTable('all')">🔥 REINICIO TOTAL</button>
                </div>
            </div>

            <dialog id="user-modal">
                <div class="modal-content">
                    <button class="modal-close-btn" onclick="document.getElementById('user-modal').close()">✕</button>
                    <h3 id="user-modal-title">Registrar Usuario</h3>
                    <form id="user-form" style="display: flex; flex-direction: column; gap: 15px; margin-top: 1rem">
                        <input type="hidden" name="id" id="user-id-input">
                        <div class="form-group">
                            <label>Nombre Real</label>
                            <input type="text" name="name" required>
                        </div>
                        <div class="form-group">
                            <label>Nombre de Usuario</label>
                            <input type="text" name="username" required>
                        </div>
                        <div class="form-group">
                            <label>Contraseña (Opcional si edita)</label>
                            <div class="password-wrapper">
                                <input type="password" name="password" id="admin-password-input">
                                <button type="button" class="password-toggle" onclick="window.togglePassword('admin-password-input')">👁️</button>
                            </div>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="btn btn-primary" style="flex:1">Guardar</button>
                            <button type="button" class="btn btn-secondary" style="flex:1" onclick="document.getElementById('user-modal').close()">Cerrar</button>
                        </div>
                    </form>
                </div>
            </dialog>
        `;
    },

    init_profile: async () => {
        const modal = document.getElementById('user-modal');
        const form = document.getElementById('user-form');

        window.openUserModal = async (id = null) => {
            form.reset();
            const idInput = document.getElementById('user-id-input');
            const title = document.getElementById('user-modal-title');
            if (idInput) idInput.value = id || '';
            if (title) title.textContent = id ? 'Editar Usuario' : 'Nuevo Usuario';

            if (id) {
                const users = await Storage.get('users');
                const u = users.find(x => x.id == id);
                if (u) {
                    form.name.value = u.name;
                    form.username.value = u.username;
                }
            }
            if (modal) modal.showModal();
        };

        window.deleteUser = async (id) => {
            const currentUser = Auth.getUser();
            if (currentUser && id == currentUser.id) return alert('No puede eliminarse a sí mismo');
            if (!confirm('¿Eliminar este usuario administrador?')) return;
            await Storage.delete('users', id);
            App.renderView('profile');
        };

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const id = document.getElementById('user-id-input').value;
                const data = {
                    name: form.name.value,
                    username: form.username.value
                };
                if (form.password.value) data.password = form.password.value;

                if (id) {
                    await Storage.update('users', id, data);
                } else {
                    await Storage.add('users', data);
                }
                modal.close();
                App.renderView('profile');
            };
        }
    }
};

// --- Boostrap ---
document.addEventListener('DOMContentLoaded', () => App.init());
