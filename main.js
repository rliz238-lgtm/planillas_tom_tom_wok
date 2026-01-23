/**
 * Planillas Tom Tom Wok - Core Logic (API Version)
 * Restauración Completa desde Backup con Soporte PostgreSQL
 */

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

    async get(key) {
        try {
            const response = await fetch(`/api/${this.SCHEMA[key]}`);
            if (!response.ok) throw new Error('Error al obtener datos');
            return await response.json();
        } catch (err) {
            console.error(err);
            return [];
        }
    },

    async add(key, item) {
        try {
            const response = await fetch(`/api/${this.SCHEMA[key]}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (!response.ok) throw new Error('Error al agregar dato');
            return await response.json();
        } catch (err) {
            console.error(err);
            return null;
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

        const appElem = document.getElementById('app');
        const loginView = document.getElementById('login-view');
        if (appElem) appElem.style.display = 'flex';
        if (loginView) loginView.style.display = 'none';

        const userNameDisplay = document.querySelector('.username');
        if (userNameDisplay) userNameDisplay.textContent = Auth.getUser().name;

        this.setupNavigation();
        await this.renderView('dashboard');

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => Auth.logout();
        }
    },

    renderLogin() {
        const appElem = document.getElementById('app');
        const loginView = document.getElementById('login-view');
        if (appElem) appElem.style.display = 'none';
        if (loginView) loginView.style.display = 'flex';

        const form = document.getElementById('login-form');
        const error = document.getElementById('login-error');

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const user = document.getElementById('username').value;
                const pass = document.getElementById('password').value;

                if (await Auth.login(user, pass)) {
                    location.reload();
                } else {
                    if (error) error.style.display = 'block';
                    form.reset();
                    document.getElementById('username').focus();
                }
            };
        }
    },

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.switchView(view);
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
                                    <td style="font-weight:600; cursor:pointer; color:var(--primary)" onclick="App.switchView('employeeDetail', '${emp.id}')">${emp.name}</td>
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
                                    <td style="display: flex; gap: 8px;">
                                        <button class="btn" style="padding: 4px 8px; background: rgba(99,102,241,0.1)" onclick="window.editEmployee('${emp.id}')">✏️</button>
                                        <button class="btn" style="padding: 4px 8px; background: rgba(99,102,241,0.1)" onclick="App.switchView('employeeDetail', '${emp.id}')">👁️</button>
                                        <button class="btn" style="padding: 4px 8px; background: rgba(239,68,68,0.1)" onclick="window.deleteEmployee('${emp.id}')">🗑️</button>
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
                            <button type="button" class="btn" style="flex:1; background: rgba(255,255,255,0.1)" onclick="document.getElementById('employee-modal').close()">Cancelar</button>
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
            if (!confirm('¿Realmente desea eliminar este empleado?')) return;
            if (await Storage.delete('employees', id)) {
                App.renderView('employees');
            }
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
            App.renderView('employees');
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
                        <button class="btn btn-primary" id="edit-detail-btn">✏️ Editar Perfil</button>
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
            </div>

            <dialog id="edit-detail-modal">
                <div class="modal-content">
                    <h3>Actualizar Datos de ${emp.name}</h3>
                    <form id="edit-detail-form" style="display: flex; flex-direction: column; gap: 15px; margin-top: 1rem">
                        <div class="form-group">
                            <label>Nuevo Pago por Hora (₡)</label>
                            <input type="number" name="newRate" value="${emp.hourly_rate}" required>
                        </div>
                        <div class="form-group">
                            <label>Motivo del Cambio</label>
                            <input type="text" name="reason" placeholder="Ej: Ajuste anual, Ascenso...">
                        </div>
                        <div class="form-group" style="display: flex; align-items: center; gap: 10px; margin-top: 10px">
                            <input type="checkbox" name="applyCCSS" id="check-ccss-detail" ${emp.apply_ccss ? 'checked' : ''} style="width: 20px; height: 20px">
                            <label for="check-ccss-detail" style="margin:0">Aplicar Rebajo CCSS</label>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="btn btn-primary" style="flex:1">Actualizar</button>
                            <button type="button" class="btn" style="flex:1" onclick="document.getElementById('edit-detail-modal').close()">Cerrar</button>
                        </div>
                    </form>
                </div>
            </dialog>
        `;
    },

    init_employeeDetail: async (id) => {
        const modal = document.getElementById('edit-detail-modal');
        const btn = document.getElementById('edit-detail-btn');
        const form = document.getElementById('edit-detail-form');

        if (btn) btn.onclick = () => modal.showModal();

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const employees = await Storage.get('employees');
                const emp = employees.find(e => e.id == id);
                const newRate = parseFloat(form.newRate.value);
                const reason = form.reason.value || 'Actualización de perfil';
                const applyCCSS = form.applyCCSS.checked;

                const history = emp.salary_history || [];
                // If rate changed, add to history
                if (newRate !== parseFloat(emp.hourly_rate)) {
                    history.push({
                        date: Storage.getLocalDate(),
                        rate: newRate,
                        reason: reason
                    });
                }

                await Storage.update('employees', id, {
                    ...emp,
                    hourlyRate: newRate,
                    applyCCSS: applyCCSS,
                    salaryHistory: history,
                    startDate: emp.start_date, // Keep originals
                    endDate: emp.end_date,
                    status: emp.status
                });

                modal.close();
                App.renderView('employeeDetail', id);
            };
        }
    },

    calculator: async () => {
        const employees = await Storage.get('employees');
        const activeEmployees = employees.filter(e => e.status === 'Active');

        return `
            <div class="card-container">
                <div class="table-header">
                    <h3>Registrar Horas de la Semana</h3>
                    <div style="display: flex; gap: 10px">
                        <button class="btn" onclick="window.clearCalculator()">Limpiar</button>
                        <button class="btn btn-primary" id="process-all-logs-btn">🚀 Procesar Todo</button>
                    </div>
                </div>
                <p style="color: var(--text-muted); margin-bottom: 1rem">Ingrese las horas diarias para cada colaborador. Use el formato decimal (ej: 8.5)</p>
                
                <div class="table-container">
                    <table id="calculator-table">
                        <thead>
                            <tr>
                                <th>Colaborador</th>
                                <th>Lun</th>
                                <th>Mar</th>
                                <th>Mié</th>
                                <th>Jue</th>
                                <th>Vie</th>
                                <th>Sáb</th>
                                <th>Dom</th>
                                <th>Total</th>
                                <th>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${activeEmployees.map(emp => `
                                <tr data-emp-id="${emp.id}" data-rate="${emp.hourly_rate}" data-ccss="${emp.apply_ccss ? '1' : '0'}">
                                    <td style="font-weight: 600">${emp.name}</td>
                                    <td><input type="number" step="0.5" class="hour-input" data-day="0" placeholder="0"></td>
                                    <td><input type="number" step="0.5" class="hour-input" data-day="1" placeholder="0"></td>
                                    <td><input type="number" step="0.5" class="hour-input" data-day="2" placeholder="0"></td>
                                    <td><input type="number" step="0.5" class="hour-input" data-day="3" placeholder="0"></td>
                                    <td><input type="number" step="0.5" class="hour-input" data-day="4" placeholder="0"></td>
                                    <td><input type="number" step="0.5" class="hour-input" data-day="5" placeholder="0"></td>
                                    <td><input type="number" step="0.5" class="hour-input" data-day="6" placeholder="0"></td>
                                    <td class="row-total">0.0</td>
                                    <td class="row-amount">₡0</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    init_calculator: async () => {
        const table = document.getElementById('calculator-table');
        const processBtn = document.getElementById('process-all-logs-btn');

        const calculateRow = (row) => {
            const inputs = row.querySelectorAll('.hour-input');
            const totalCell = row.querySelector('.row-total');
            const amountCell = row.querySelector('.row-amount');
            const rate = parseFloat(row.dataset.rate);
            const applyCCSS = row.dataset.ccss === '1';

            let totalHours = 0;
            inputs.forEach(input => totalHours += parseFloat(input.value || 0));

            const gross = totalHours * rate;
            const deduction = applyCCSS ? (gross * 0.1067) : 0;
            const net = gross - deduction;

            totalCell.textContent = totalHours.toFixed(1);
            amountCell.textContent = '₡' + Math.round(net).toLocaleString();
        };

        table.querySelectorAll('.hour-input').forEach(input => {
            input.oninput = () => calculateRow(input.closest('tr'));
        });

        processBtn.onclick = async () => {
            if (!confirm('¿Desea guardar todos los registros de horas ingresados?')) return;

            const rows = table.querySelectorAll('tbody tr');
            const today = new Date();
            const getDayDate = (offset) => {
                const d = new Date(today);
                const currentDay = d.getDay(); // 0(Dom) - 6(Sab)
                const diff = (offset + 1) - (currentDay === 0 ? 7 : currentDay);
                d.setDate(d.getDate() + diff);
                return Storage.getLocalDate(d);
            };

            let count = 0;
            for (const row of rows) {
                const empId = row.dataset.empId;
                const inputs = row.querySelectorAll('.hour-input');

                for (let i = 0; i < 7; i++) {
                    const val = parseFloat(inputs[i].value || 0);
                    if (val > 0) {
                        await Storage.add('logs', {
                            employeeId: parseInt(empId),
                            date: getDayDate(i),
                            hours: val,
                            notes: 'Ingreso manual calculadora'
                        });
                        count++;
                    }
                }
            }

            alert(`Se guardaron ${count} registros exitosamente.`);
            App.switchView('payroll');
        };

        window.clearCalculator = () => {
            table.querySelectorAll('input').forEach(i => i.value = '');
            table.querySelectorAll('.row-total').forEach(t => t.textContent = '0.0');
            table.querySelectorAll('.row-amount').forEach(a => a.textContent = '₡0');
        };
    },

    payroll: async () => {
        const employees = await Storage.get('employees');
        const logs = await Storage.get('logs');
        const payments = await Storage.get('payments');

        const pendingSummary = [];
        employees.filter(e => e.status === 'Active').forEach(emp => {
            const empLogs = logs.filter(l => l.employee_id == emp.id && !l.is_paid);
            if (empLogs.length > 0) {
                const totalHours = empLogs.reduce((s, l) => s + parseFloat(l.hours), 0);
                const gross = totalHours * parseFloat(emp.hourly_rate);
                const deduction = emp.apply_ccss ? (gross * 0.1067) : 0;
                const net = gross - deduction;

                pendingSummary.push({
                    id: emp.id,
                    name: emp.name,
                    hours: totalHours,
                    net: net,
                    deduction: deduction,
                    logCount: empLogs.length
                });
            }
        });

        return `
            <div class="card-container">
                <div class="table-header">
                    <h3>Resumen de Pagos Pendientes</h3>
                    <div style="display: flex; gap: 10px">
                         <button class="btn" style="background: rgba(239,68,68,0.1); color: var(--danger)" onclick="window.clearAllLogs()">🗑️ Limpiar Todo</button>
                         <button class="btn btn-primary" id="process-payroll-btn">💳 Pagar Seleccionados</button>
                    </div>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 40px"><input type="checkbox" id="select-all-pending" checked></th>
                                <th>Empleado</th>
                                <th>Horas Acum.</th>
                                <th>CCSS (Est.)</th>
                                <th>Monto Neto</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pendingSummary.map(ps => `
                                <tr>
                                    <td><input type="checkbox" class="pending-check" data-id="${ps.id}" data-hours="${ps.hours}" data-net="${ps.net}" data-deduction="${ps.deduction}" checked></td>
                                    <td style="font-weight: 600">${ps.name}</td>
                                    <td>${ps.hours.toFixed(1)}h</td>
                                    <td style="color: var(--danger)">₡${Math.round(ps.deduction).toLocaleString()}</td>
                                    <td style="color: var(--success); font-weight: 600;">₡${Math.round(ps.net).toLocaleString()}</td>
                                    <td><button class="btn" onclick="window.clearEmpLogs(${ps.id})" style="padding: 4px 8px; font-size: 0.8rem">Reasentir Horas</button></td>
                                </tr>
                            `).join('')}
                            ${pendingSummary.length === 0 ? '<tr><td colspan="6" style="text-align:center">No hay horas pendientes de pago</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card-container" style="margin-top: 2rem">
                <div class="table-header">
                    <h3>Historial de Pagos</h3>
                    <div style="display: flex; gap: 10px">
                        <button class="btn" style="background: rgba(16,185,129,0.1); color: var(--success)" onclick="window.exportPayments()">📥 Excel</button>
                        <button class="btn" style="background: rgba(239,68,68,0.1); color: var(--danger)" id="delete-selected-payments">🗑️ Eliminar</button>
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
                                        <td style="font-weight: 600">${emp ? emp.name : 'Desconocido'}</td>
                                        <td>${parseFloat(p.hours || 0).toFixed(1)}h</td>
                                        <td style="color: var(--success); font-weight: 700;">₡${Math.round(p.amount).toLocaleString()}</td>
                                        <td>${p.is_imported ? '✅' : '❌'}</td>
                                        <td style="display: flex; gap: 5px">
                                            <button class="btn" style="padding: 5px 10px" onclick="window.shareWhatsApp('${p.id}')">📲</button>
                                            <button class="btn" style="padding: 5px 10px; background: rgba(239,68,68,0.1)" onclick="window.deletePayment('${p.id}')">🗑️</button>
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

            if (!confirm(`¿Procesar ${selected.length} pagos?`)) return;

            for (const check of selected) {
                const empId = check.dataset.id;
                const hours = parseFloat(check.dataset.hours);
                const net = parseFloat(check.dataset.net);
                const deduction = parseFloat(check.dataset.deduction);

                await Storage.add('payments', {
                    employeeId: parseInt(empId),
                    date: Storage.getLocalDate(),
                    amount: net,
                    hours: hours,
                    deductionCCSS: deduction,
                    netAmount: net,
                    isImported: false
                });

                await Storage.deleteLogsByEmployee(empId);
            }

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

    benefits: async () => `<div class="card-container"><h3>Prestaciones de Ley</h3><p>Cálculos de Aguinaldo y Cesantía próximamente.</p></div>`,

    import: async () => {
        return `
            <div class="card-container">
                <div class="table-header">
                    <h3>Importar Liquidación desde Excel</h3>
                    <div style="font-size: 0.8rem; color: var(--text-muted)">Compatible con formato de reloj marcador (.xlsx)</div>
                </div>
                
                <div id="drop-zone" class="import-zone" style="border: 2px dashed var(--primary); padding: 3rem; text-align: center; border-radius: 12px; cursor: pointer; background: rgba(99,102,241,0.02)">
                    <div style="font-size: 3rem; margin-bottom: 1rem">📊</div>
                    <p>Arrastre su archivo Excel aquí o haga clic para seleccionar</p>
                    <input type="file" id="excel-input" accept=".xlsx, .xls" style="display: none">
                </div>

                <div id="import-preview-container" style="margin-top: 2rem; display: none">
                    <div class="table-header">
                        <h4>Vista Previa de Importación</h4>
                        <button class="btn btn-primary" id="execute-import-btn">Confirmar e Importar</button>
                    </div>
                    <div class="table-container">
                        <table id="preview-table">
                            <thead>
                                <tr>
                                    <th>Empleado</th>
                                    <th>Horas</th>
                                    <th>Subtotal</th>
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

        if (dropZone) dropZone.onclick = () => input.click();
        if (dropZone) dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--success)'; };
        if (dropZone) dropZone.ondragleave = () => dropZone.style.borderColor = 'var(--primary)';
        if (dropZone) dropZone.ondrop = (e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            handleFile(file);
        };

        if (input) input.onchange = (e) => handleFile(e.target.files[0]);

        const handleFile = (file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(firstSheet);
                processImportableData(json);
            };
            reader.readAsArrayBuffer(file);
        };

        const processImportableData = async (json) => {
            const employees = await Storage.get('employees');
            const tbody = document.querySelector('#preview-table tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            importedData = [];

            json.forEach(row => {
                const name = row['Nombre'] || row['Empleado'] || row['Nombre Empleado'];
                const hours = row['Horas'] || row['Total Horas'] || row['Horas Trabajadas'];

                if (name && hours) {
                    const emp = employees.find(e => e.name.toLowerCase().includes(name.toString().toLowerCase()));
                    const status = emp ? '✅ Vinculado' : '⚠️ No encontrado';
                    const amount = emp ? (parseFloat(hours) * parseFloat(emp.hourly_rate)) : 0;

                    importedData.push({
                        name: name,
                        hours: parseFloat(hours),
                        employee_id: emp ? emp.id : null,
                        amount: amount,
                        ccss: emp ? emp.apply_ccss : false
                    });

                    tbody.innerHTML += `
                        <tr>
                            <td>${name}</td>
                            <td>${hours}h</td>
                            <td>₡${Math.round(amount).toLocaleString()}</td>
                            <td style="color: ${emp ? 'var(--success)' : 'var(--danger)'}">${status}</td>
                        </tr>
                    `;
                }
            });

            preview.style.display = 'block';
            dropZone.style.display = 'none';
        };

        const executeBtn = document.getElementById('execute-import-btn');
        if (executeBtn) {
            executeBtn.onclick = async () => {
                const valid = importedData.filter(d => d.employee_id);
                if (valid.length === 0) return alert('No hay datos válidos para importar');

                if (!confirm(`Se importarán ${valid.length} registros de pago directamente al historial. ¿Continuar?`)) return;

                for (const item of valid) {
                    const gross = item.amount;
                    const deduction = item.ccss ? (gross * 0.1067) : 0;
                    const net = gross - deduction;

                    await Storage.add('payments', {
                        employeeId: item.employee_id,
                        date: Storage.getLocalDate(),
                        amount: net,
                        hours: item.hours,
                        deductionCCSS: deduction,
                        netAmount: net,
                        isImported: true
                    });
                }

                alert('Importación completada con éxito');
                App.switchView('payroll');
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
                                        <button class="btn" style="padding: 4px 8px; background: rgba(99,102,241,0.1)" onclick="window.openUserModal('${u.id}')">✏️</button>
                                        <button class="btn" style="padding: 4px 8px; background: rgba(239,68,68,0.1)" onclick="window.deleteUser('${u.id}')">🗑️</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <dialog id="user-modal">
                <div class="modal-content">
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
                            <input type="password" name="password">
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="btn btn-primary" style="flex:1">Guardar</button>
                            <button type="button" class="btn" style="flex:1" onclick="document.getElementById('user-modal').close()">Cerrar</button>
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
