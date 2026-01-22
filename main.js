/**
 * Planillas Tom Tom Wok - Core Logic
 */

// --- Data Persistence Layer ---
const Storage = {
    SCHEMA: {
        employees: 'gn_employees',
        logs: 'gn_logs',
        payments: 'gn_payments',
        settings: 'gn_settings',
        users: 'gn_users'
    },

    getLocalDate(d = new Date()) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    get(key) {
        const data = localStorage.getItem(this.SCHEMA[key]);
        return data ? JSON.parse(data) : [];
    },

    save(key, data) {
        localStorage.setItem(this.SCHEMA[key], JSON.stringify(data));
    },

    add(key, item) {
        const data = this.get(key);
        // Generar un ID más robusto para evitar colisiones en ciclos rápidos
        item.id = item.id || Date.now().toString() + Math.random().toString(36).substring(2, 9);
        data.push(item);
        this.save(key, data);
        return item;
    },

    update(key, id, updates) {
        const data = this.get(key);
        const index = data.findIndex(i => i.id === id);
        if (index !== -1) {
            data[index] = { ...data[index], ...updates };
            this.save(key, data);
        }
    },

    delete(key, id) {
        const data = this.get(key);
        const filtered = data.filter(i => i.id !== id);
        this.save(key, filtered);
    }
};

// --- Authentication Layer ---
const Auth = {
    SCHEMA: 'gn_session',

    init() {
        // Create default admin if no users exist
        const users = Storage.get('users');
        if (users.length === 0) {
            Storage.add('users', {
                username: 'admin',
                password: 'password123',
                name: 'Administrador Principal'
            });
        }
    },

    login(username, password) {
        const users = Storage.get('users');
        const user = users.find(u => u.username === username && u.password === password);
        if (user) {
            localStorage.setItem(this.SCHEMA, JSON.stringify({
                id: user.id,
                username: user.username,
                name: user.name,
                loginTime: Date.now()
            }));
            return true;
        }
        return false;
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

    init() {
        Auth.init();
        if (!Auth.isAuthenticated()) {
            this.renderLogin();
            return;
        }
        this.setupNavigation();
        this.seedInitialData();
        this.renderView('dashboard');

        // Setup logout button if it exists
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => Auth.logout();
        }
    },

    renderLogin() {
        document.body.innerHTML = `
            <div class="login-screen">
                <div class="login-card">
                    <img src="img/logo_tom_tom_wok_white.png" alt="Tom Tom Wok Logo" style="width: 200px; margin-bottom: 2rem;">
                    <p style="color: var(--text-muted); margin-bottom: 1rem;">Sistema de Control de Planillas</p>
                    
                    <div id="login-error" class="login-error">
                        Usuario o contraseña incorrectos.
                    </div>

                    <form class="login-form" id="login-form">
                        <div class="login-input-group">
                            <label>Usuario</label>
                            <input type="text" id="username" placeholder="admin" required autofocus>
                        </div>
                        <div class="login-input-group">
                            <label>Contraseña</label>
                            <input type="password" id="password" placeholder="••••••••" required>
                        </div>
                        <button type="submit" class="login-btn">Entrar al Sistema</button>
                    </form>
                    
                    <p style="margin-top: 2rem; font-size: 0.8rem; color: var(--text-muted)">
                        © 2026 Tom Tom Wok
                    </p>
                </div>
            </div>
        `;

        const form = document.getElementById('login-form');
        const error = document.getElementById('login-error');

        form.onsubmit = (e) => {
            e.preventDefault();
            const user = document.getElementById('username').value;
            const pass = document.getElementById('password').value;

            if (Auth.login(user, pass)) {
                location.reload();
            } else {
                error.style.display = 'block';
                form.reset();
                document.getElementById('username').focus();
            }
        };
    },

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.switchView(view);
            });
        });
    },

    switchView(view, arg = null) {
        // Handle active class
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

        document.getElementById('view-title').textContent = titles[view] || 'Planillas Tom Tom Wok';
        this.renderView(view, arg);
    },

    renderView(view, arg = null) {
        const container = document.getElementById('view-container');
        container.innerHTML = `<div class="view-animate">${Views[view](arg)}</div>`;

        // Post-render lifecycle
        if (Views[`init_${view}`]) {
            Views[`init_${view}`](arg);
        }
    },

    seedInitialData() {
        // --- Sanitización de datos (Corrección de IDs duplicados) ---
        const employees = Storage.get('employees');
        const ids = new Set();
        let hasDuplicates = false;

        employees.forEach(emp => {
            if (!emp.id || ids.has(emp.id)) {
                emp.id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
                hasDuplicates = true;
            }
            ids.add(emp.id);
        });

        if (hasDuplicates) {
            Storage.save('employees', employees);
            console.log('IDs de empleados sanitizados.');
        }

        if (employees.length === 0) {
            const initialEmployees = [
                { id: '1', name: 'Juan Pérez', position: 'Chef', hourlyRate: 3500, status: 'Active', startDate: '2024-01-15' },
                { id: '2', name: 'María Rodríguez', position: 'Mesera', hourlyRate: 2200, status: 'Active', startDate: '2024-03-10' },
                { id: '3', name: 'Carlos Gomez', position: 'Ayudante', hourlyRate: 1800, status: 'Active', startDate: '2024-05-20' }
            ];
            Storage.save('employees', initialEmployees);
        }
    }
};

// --- UI Components & Views ---
const Views = {
    dashboard: () => {
        const employees = Storage.get('employees');
        const activeEmployees = employees.filter(e => e.status === 'Active');

        // Deduplicate logs for calculation (based on employee, date, hours, and times)
        const rawLogs = Storage.get('logs');
        const uniqueLogKeys = new Set();
        const logs = rawLogs.filter(l => {
            const key = `${l.employeeId}|${l.date}|${l.hours}|${l.timeIn || ''}|${l.timeOut || ''}`;
            if (uniqueLogKeys.has(key)) return false;
            uniqueLogKeys.add(key);
            return true;
        });

        const now = new Date();

        const todayStr = Storage.getLocalDate();
        const currentMonth = todayStr.substring(0, 7);
        const monthLogs = logs.filter(l => l.date && l.date.startsWith(currentMonth));
        const monthHours = monthLogs.reduce((s, l) => s + parseFloat(l.hours || 0), 0);
        const monthAmount = monthLogs.reduce((s, l) => {
            const emp = employees.find(e => e.id === l.employeeId);
            const gross = parseFloat(l.hours || 0) * (emp ? emp.hourlyRate : 0);
            const deduction = (emp && emp.applyCCSS) ? (gross * 0.1067) : 0;
            return s + (gross - deduction);
        }, 0);

        // Semana Actual (Lunes a Domingo)
        const getWeekRange = (date) => {
            const d = new Date(date);
            const day = d.getDay(); // 0(Dom) a 6(Sab)

            // Ajustar para que Lunes sea el primer día (1) y Domingo el último (7)
            const dayNum = day === 0 ? 7 : day;
            const diffToMonday = 1 - dayNum;

            const monday = new Date(d);
            monday.setDate(d.getDate() + diffToMonday);

            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);

            const format = (dt) => {
                const y = dt.getFullYear();
                const m = String(dt.getMonth() + 1).padStart(2, '0');
                const dayStr = String(dt.getDate()).padStart(2, '0');
                return `${y}-${m}-${dayStr}`;
            };

            return { start: format(monday), end: format(sunday) };
        };

        const weekRange = getWeekRange(now);
        const weekLogs = logs.filter(l => l.date >= weekRange.start && l.date <= weekRange.end);
        const weekHours = weekLogs.reduce((s, l) => s + parseFloat(l.hours || 0), 0);
        const weekAmount = weekLogs.reduce((s, l) => {
            const emp = employees.find(e => e.id === l.employeeId);
            const gross = parseFloat(l.hours || 0) * (emp ? emp.hourlyRate : 0);
            const deduction = (emp && emp.applyCCSS) ? (gross * 0.1067) : 0;
            return s + (gross - deduction);
        }, 0);

        // Semana Anterior (Lunes a Domingo)
        const lastWeekDate = new Date(now);
        lastWeekDate.setDate(now.getDate() - 7);
        const lastWeekRange = getWeekRange(lastWeekDate);
        const lastWeekLogs = logs.filter(l => l.date >= lastWeekRange.start && l.date <= lastWeekRange.end);
        const lastWeekHours = lastWeekLogs.reduce((s, l) => s + parseFloat(l.hours || 0), 0);
        const lastWeekAmount = lastWeekLogs.reduce((s, l) => {
            const emp = employees.find(e => e.id === l.employeeId);
            const gross = parseFloat(l.hours || 0) * (emp ? emp.hourlyRate : 0);
            const deduction = (emp && emp.applyCCSS) ? (gross * 0.1067) : 0;
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

    init_dashboard: () => {
        const payments = Storage.get('payments');
        const ctx = document.getElementById('salaryChart');
        if (!ctx) return;

        // Group payments by month for the last 12 months
        const months = [];
        const data = [];
        const now = new Date();

        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = d.toISOString().substring(0, 7);
            const monthLabel = d.toLocaleString('es-ES', { month: 'short' }).toUpperCase();

            const monthTotal = payments
                .filter(p => p.date.startsWith(monthStr))
                .reduce((s, p) => s + p.amount, 0);

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

    employees: () => {
        const employees = Storage.get('employees');
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
                                    <td>₡${emp.hourlyRate}</td>
                                    <td>
                                        <span class="tag ${emp.status === 'Active' ? 'tag-active' : 'tag-inactive'}">
                                            ${emp.status === 'Active' ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style="font-size: 0.85rem">📅 ${emp.startDate}</div>
                                        ${emp.endDate ? `<div style="font-size: 0.85rem; color: var(--danger)">🚪 ${emp.endDate}</div>` : ''}
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

            <dialog id="employee-modal" class="card-container" style="margin: auto; border: 1px solid var(--primary); padding: 2rem; width: 450px; max-height: 90vh; overflow-y: auto; background: var(--bg-card); color: white;">
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
            </dialog>
        `;
    },

    init_employees: () => {
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
            deactivateBtn.onclick = () => {
                if (!confirm('¿Está seguro de que desea poner a TODOS los empleados como Inactivos?')) return;

                const employees = Storage.get('employees');
                const today = Storage.getLocalDate();

                employees.forEach(emp => {
                    emp.status = 'Inactive';
                    if (!emp.endDate) emp.endDate = today;
                });

                Storage.save('employees', employees);
                App.renderView('employees');
                alert('Todos los empleados han sido marcados como Inactivos.');
            };
        }

        btn.onclick = () => {
            form.reset();
            editIdInput.value = '';
            modalTitle.textContent = 'Registrar Empleado';
            modal.showModal();
        };

        window.editEmployee = (id) => {
            const emp = Storage.get('employees').find(e => e.id === id);
            if (!emp) return;

            modalTitle.textContent = 'Editar Empleado';
            editIdInput.value = emp.id;
            form.name.value = emp.name;
            form.cedula.value = emp.cedula || '';
            form.phone.value = emp.phone || '';
            form.pin.value = emp.pin || '';
            form.position.value = emp.position;
            form.hourlyRate.value = emp.hourlyRate;
            form.status.value = emp.status;
            form.startDate.value = emp.startDate;
            form.endDate.value = emp.endDate || '';
            form.applyCCSS.checked = !!emp.applyCCSS;

            modal.showModal();
        };

        form.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const id = formData.get('id');
            const empData = {
                name: formData.get('name'),
                cedula: formData.get('cedula') || '',
                phone: formData.get('phone'),
                pin: formData.get('pin') || '',
                position: formData.get('position'),
                hourlyRate: parseFloat(formData.get('hourlyRate')),
                startDate: formData.get('startDate'),
                endDate: formData.get('endDate') || null,
                status: formData.get('status'),
                applyCCSS: form.applyCCSS.checked
            };

            if (id) {
                Storage.update('employees', id, empData);
            } else {
                Storage.add('employees', empData);
            }

            modal.close();
            App.renderView('employees');
        };
    },

    employeeDetail: (id) => {
        const emp = Storage.get('employees').find(e => e.id === id);
        if (!emp) return `<p>Empleado no encontrado</p>`;

        const logs = Storage.get('logs').filter(l => l.employeeId === id);

        // Default filter & sort
        const now = new Date();
        const startOfMonth = Storage.getLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
        const endOfMonth = Storage.getLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

        const startDate = localStorage.getItem('gn_detail_start') || startOfMonth;
        const endDate = localStorage.getItem('gn_detail_end') || endOfMonth;
        const sortOrder = localStorage.getItem('gn_detail_sort') || 'desc';

        const filteredLogs = logs.filter(l => l.date >= startDate && l.date <= endDate);
        filteredLogs.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

        const totalHours = filteredLogs.reduce((s, l) => s + parseFloat(l.hours), 0);
        const totalEarned = totalHours * emp.hourlyRate;

        // Calculate averages based on period duration
        const dateS = new Date(startDate);
        const dateE = new Date(endDate);
        const diffDays = Math.max(1, Math.ceil((dateE - dateS) / (1000 * 60 * 60 * 24)) + 1);

        const avgDaily = totalEarned / diffDays;
        const avgWeekly = avgDaily * 7;
        const avgMonthly = avgDaily * 30.44;

        const history = emp.salaryHistory || [{ date: emp.startDate, rate: emp.hourlyRate, reason: 'Salario Inicial' }];

        const hasCCSS = !!emp.applyCCSS;
        const estDeduction = hasCCSS ? Math.round(totalEarned * 0.1067) : 0;
        const estEmployer = hasCCSS ? Math.round(totalEarned * 0.2667) : 0;
        const estNet = totalEarned - estDeduction;

        return `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <button class="btn" style="background: var(--primary); color: white;" onclick="App.switchView('employees')">← Volver</button>
                    <h3 style="margin:0">${emp.name} <span style="font-weight:400; color:var(--text-muted)">| ${emp.position}</span></h3>
                </div>
                <button class="btn btn-primary" id="edit-emp-detail-btn">✏️ Editar Perfil</button>
            </div>

            <div class="grid-2" style="margin-bottom: 2rem;">
                <div class="card-container">
                    <h3>Información del Colaborador</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-top: 1rem;">
                        <div>
                            <p style="color: var(--text-muted); font-size: 0.8rem; margin:0">Estado</p>
                            <span class="tag ${emp.status === 'Active' ? 'tag-active' : 'tag-inactive'}">${emp.status === 'Active' ? 'Activo' : 'Inactivo'}</span>
                        </div>
                        <div>
                            <p style="color: var(--text-muted); font-size: 0.8rem; margin:0">CCSS (10.67%)</p>
                            <span class="tag ${emp.applyCCSS ? 'tag-active' : 'tag-inactive'}">${emp.applyCCSS ? 'Habilitado' : 'Deshabilitado'}</span>
                        </div>
                        <div>
                            <p style="color: var(--text-muted); font-size: 0.8rem; margin:0">Fecha Inicio</p>
                            <p style="margin:0">${emp.startDate}</p>
                        </div>
                        <div>
                            <p style="color: var(--text-muted); font-size: 0.8rem; margin:0">Pago x Hora</p>
                            <p style="margin:0; font-weight: 600; color: var(--success)">₡${emp.hourlyRate}</p>
                        </div>
                    </div>
                </div>

                <div class="card-container">
                    <h3>Historial de Salarios</h3>
                    <div class="table-container" style="max-height: 150px; overflow-y: auto;">
                        <table style="font-size: 0.85rem">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Monto</th>
                                    <th>Motivo</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${history.slice().reverse().map(h => `
                                    <tr>
                                        <td>${h.date}</td>
                                        <td style="font-weight: 600">₡${h.rate}</td>
                                        <td>${h.reason || 'Cambio manual'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="stats-grid" style="grid-template-columns: repeat(${hasCCSS ? 4 : 3}, 1fr) !important;">
                <div class="stat-card">
                    <h3>Horas Totales</h3>
                    <div class="value">${totalHours.toFixed(2)}h</div>
                    <div class="trend">${diffDays} días en rango</div>
                </div>
                <div class="stat-card">
                    <h3>Salario Bruto</h3>
                    <div class="value" style="color:var(--primary)">₡${totalEarned.toLocaleString()}</div>
                    <div class="trend">Monto antes de rebajos</div>
                </div>
                ${hasCCSS ? `
                    <div class="stat-card">
                        <h3>Rebajo CCSS</h3>
                        <div class="value" style="color:var(--danger)">-₡${estDeduction.toLocaleString()}</div>
                        <div class="trend">Carga Obrera (10.67%)</div>
                    </div>
                    <div class="stat-card">
                        <h3>Salario Neto</h3>
                        <div class="value" style="color:var(--success)">₡${estNet.toLocaleString()}</div>
                        <div class="trend">Monto a recibir</div>
                    </div>
                ` : `
                    <div class="stat-card">
                        <h3>Monto Neto</h3>
                        <div class="value" style="color:var(--success)">₡${totalEarned.toLocaleString()}</div>
                        <div class="trend">Sin rebajos aplicados</div>
                    </div>
                `}
            </div>

            ${hasCCSS ? `
            <div class="card-container" style="margin: 1.5rem 0; padding: 1rem; border-left: 5px solid var(--accent); background: rgba(99,102,241,0.05)">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin:0; color: var(--accent)">Carga Social Patronal Proyectada</h4>
                        <p style="margin:0; font-size: 0.8rem; color: var(--text-muted)">Gasto adicional para la empresa (26.67%)</p>
                    </div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: var(--text-white)">₡${estEmployer.toLocaleString()}</div>
                </div>
            </div>
            ` : ''}

            <div class="stats-grid" style="margin-top: -1.5rem">
                <div class="stat-card" style="border-left: 4px solid var(--primary)">
                    <h3>Promedio Diario</h3>
                    <div class="value" style="font-size: 1.4rem">₡${Math.round(avgDaily).toLocaleString()}</div>
                    <div class="trend">Ingreso por día</div>
                </div>
                <div class="stat-card" style="border-left: 4px solid var(--accent)">
                    <h3>Promedio Semanal</h3>
                    <div class="value" style="font-size: 1.4rem">₡${Math.round(avgWeekly).toLocaleString()}</div>
                    <div class="trend">Ingreso por 7 días</div>
                </div>
                <div class="stat-card" style="border-left: 4px solid var(--success)">
                    <h3>Promedio Mensual</h3>
                    <div class="value" style="font-size: 1.4rem">₡${Math.round(avgMonthly).toLocaleString()}</div>
                    <div class="trend">Ingreso proyectado</div>
                </div>
            </div>

            <div class="card-container">
                <div class="table-header">
                    <div>
                        <h3>Detalle Diario</h3>
                        <p style="font-size: 0.8rem; color: var(--text-muted)">Historial de horas trabajadas</p>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <select id="detail-sort" style="width: auto; padding: 6px 12px;">
                            <option value="desc" ${sortOrder === 'desc' ? 'selected' : ''}>Más recientes</option>
                            <option value="asc" ${sortOrder === 'asc' ? 'selected' : ''}>Más antiguos</option>
                        </select>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <input type="date" id="detail-start-filter" value="${startDate}" style="width: auto; padding: 6px 12px;">
                            <span style="color: var(--text-muted)">a</span>
                            <input type="date" id="detail-end-filter" value="${endDate}" style="width: auto; padding: 6px 12px;">
                        </div>
                    </div>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Entrada</th>
                                <th>Salida</th>
                                <th>Horas</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredLogs.map(log => `
                                <tr>
                                    <td>${log.date}</td>
                                    <td>${log.timeIn || '08:00'}</td>
                                    <td>${log.timeOut || '17:00'}</td>
                                    <td style="font-weight:600">${log.hours}h</td>
                                    <td><span class="tag tag-active">${log.isImported ? 'Importado' : 'Registrado'}</span></td>
                                </tr>
                            `).join('')}
                            ${filteredLogs.length === 0 ? '<tr><td colspan="5" style="text-align:center">No hay registros para este periodo</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Edit Modal Specific to Detail View -->
            <dialog id="detail-edit-modal" class="card-container" style="margin: auto; border: 1px solid var(--primary); padding: 2rem; width: 450px; max-height: 90vh; overflow-y: auto; background: var(--bg-card); color: white;">
                <h3 style="margin-bottom: 1.5rem">Editar Colaborador</h3>
                <form id="detail-edit-form">
                    <div class="form-group">
                        <label>Nombre Completo</label>
                        <input type="text" name="name" value="${emp.name}" required>
                    </div>
                    <div class="form-group">
                        <label>Número de Cédula</label>
                        <input type="text" name="cedula" value="${emp.cedula || ''}" placeholder="Ej: 1-2345-6789">
                    </div>
                    <div class="form-group">
                        <label>Teléfono (WhatsApp)</label>
                        <input type="text" name="phone" value="${emp.phone || ''}" placeholder="Ej: 50688888888">
                    </div>
                    <div class="form-group" style="background: rgba(99,102,241,0.05); padding: 1rem; border-radius: 8px; border: 1px solid rgba(99,102,241,0.3);">
                        <label style="color: var(--primary); font-weight: 600;">🔐 PIN de Acceso al Portal (4 dígitos)</label>
                        <input type="text" name="pin" value="${emp.pin || ''}" placeholder="Ej: 1234" maxlength="4" pattern="[0-9]*" inputmode="numeric" style="margin-top: 0.5rem;">
                        <small style="color: var(--text-muted); font-size: 0.75rem; display: block; margin-top: 0.5rem;">Este PIN permite al empleado registrar sus horas en el portal de auto-servicio</small>
                    </div>
                    <div class="grid-2" style="gap: 1rem">
                        <div class="form-group">
                            <label>Cargo</label>
                            <input type="text" name="position" value="${emp.position}" required>
                        </div>
                        <div class="form-group">
                            <label>Pago por Hora (₡)</label>
                            <input type="number" name="hourlyRate" value="${emp.hourlyRate}" required>
                        </div>
                    </div>
                    <div class="grid-2" style="gap: 1rem">
                        <div class="form-group">
                            <label>Estado</label>
                            <select name="status">
                                <option value="Active" ${emp.status === 'Active' ? 'selected' : ''}>Activo</option>
                                <option value="Inactive" ${emp.status === 'Inactive' ? 'selected' : ''}>Inactivo</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Fecha Inicio</label>
                            <input type="date" name="startDate" value="${emp.startDate}" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Fecha Terminación (Opcional)</label>
                        <input type="date" name="endDate" value="${emp.endDate || ''}">
                    </div>
                    <div class="form-group" style="display: flex; align-items: center; gap: 10px; background: rgba(99,102,241,0.05); padding: 10px; border-radius: 8px; border: 1px solid rgba(99,102,241,0.2);">
                        <input type="checkbox" name="applyCCSS" id="detail-apply-ccss-check" ${emp.applyCCSS ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
                        <label for="detail-apply-ccss-check" style="margin: 0; cursor: pointer; font-weight: 600;">Aplicar Rebajo CCSS (10.67%)</label>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button type="submit" class="btn btn-primary" style="flex:1">Actualizar</button>
                        <button type="button" class="btn" style="flex:1; background: rgba(255,255,255,0.1)" onclick="document.getElementById('detail-edit-modal').close()">Cancelar</button>
                    </div>
                </form>
            </dialog>
        `;
    },

    init_employeeDetail: (id) => {
        const startFilter = document.getElementById('detail-start-filter');
        const endFilter = document.getElementById('detail-end-filter');
        const sort = document.getElementById('detail-sort');
        const editBtn = document.getElementById('edit-emp-detail-btn');
        const editModal = document.getElementById('detail-edit-modal');
        const editForm = document.getElementById('detail-edit-form');

        // Global Storage object (assuming it's defined elsewhere, adding getLocalDate to it)
        window.Storage = window.Storage || {};
        window.Storage.getLocalDate = (d = new Date()) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        window.Storage.get = window.Storage.get || ((key) => JSON.parse(localStorage.getItem(`gn_${key}`)) || []);


        if (startFilter) {
            startFilter.onchange = () => {
                localStorage.setItem('gn_detail_start', startFilter.value);
                App.renderView('employeeDetail', id);
            };
        }
        if (endFilter) {
            endFilter.onchange = () => {
                localStorage.setItem('gn_detail_end', endFilter.value);
                App.renderView('employeeDetail', id);
            };
        }
        if (sort) {
            sort.onchange = () => {
                localStorage.setItem('gn_detail_sort', sort.value);
                App.renderView('employeeDetail', id);
            };
        }

        if (editBtn) {
            editBtn.onclick = () => editModal.showModal();
        }

        if (editForm) {
            editForm.onsubmit = (e) => {
                e.preventDefault();
                const formData = new FormData(editForm);
                const emp = Storage.get('employees').find(e => e.id === id);
                if (!emp) return;

                const newRate = parseFloat(formData.get('hourlyRate'));
                const history = emp.salaryHistory || [{ date: emp.startDate, rate: emp.hourlyRate, reason: 'Salario Inicial' }];

                // Check if salary changed
                if (newRate !== emp.hourlyRate) {
                    history.push({
                        date: Storage.getLocalDate(),
                        rate: newRate,
                        reason: 'Aumento/Ajuste salarial'
                    });
                }

                const updatedData = {
                    name: formData.get('name'),
                    cedula: formData.get('cedula') || '',
                    phone: formData.get('phone'),
                    pin: formData.get('pin') || '',
                    position: formData.get('position'),
                    hourlyRate: newRate,
                    status: formData.get('status'),
                    startDate: formData.get('startDate'),
                    endDate: formData.get('endDate') || null,
                    salaryHistory: history,
                    applyCCSS: formData.get('applyCCSS') === 'on' || editForm.applyCCSS.checked
                };

                Storage.update('employees', id, updatedData);
                editModal.close();
                App.renderView('employeeDetail', id);
            };
        }
    },

    calculator: () => {
        const employees = Storage.get('employees').filter(e => e.status === 'Active');
        return `
            <div class="card-container">
                <div style="margin-bottom: 2rem">
                    <h3>Calculadora de Pago por Periodo</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem">Ingrese las horas diarias para calcular el pago total de la semana o mes.</p>
                </div>

                <div class="form-group" style="max-width: 400px; margin-bottom: 2rem;">
                    <label>Seleccionar Empleado</label>
                    <select id="calc-employee-id" required>
                        <option value="">Seleccione un empleado...</option>
                        ${employees.map(e => `<option value="${e.id}">${e.name} (₡${e.hourlyRate}/h)</option>`).join('')}
                    </select>
                </div>

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

    init_calculator: () => {
        const tbody = document.getElementById('calc-tbody');
        const addRowBtn = document.getElementById('calc-add-row');
        const saveBtn = document.getElementById('calc-save-logs');
        const empSelect = document.getElementById('calc-employee-id');
        const summary = document.getElementById('calc-summary');

        let rowCount = 0;

        const createRow = () => {
            rowCount++;

            // Capturar datos de la última fila si existe
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
            tr.id = `row-${rowCount}`;
            tr.innerHTML = `
                <td><input type="date" class="calc-date" value="${nextDateStr}"></td>
                <td><input type="time" class="calc-in" value="${nextIn}"></td>
                <td><input type="time" class="calc-out" value="${nextOut}"></td>
                <td class="calc-subtotal" style="font-weight: 600">0.00h</td>
                <td><button class="btn" style="padding: 6px; color: var(--danger)" onclick="this.closest('tr').remove(); window.updateCalcTotal();">✕</button></td>
            `;
            tbody.appendChild(tr);

            tr.querySelectorAll('input').forEach(input => {
                input.onchange = window.updateCalcTotal;
            });
            window.updateCalcTotal();
        };

        window.updateCalcTotal = () => {
            const rows = tbody.querySelectorAll('tr');
            let totalH = 0;
            const empId = empSelect.value;
            const emp = Storage.get('employees').find(e => e.id === empId);
            const rate = emp ? emp.hourlyRate : 0;

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

        empSelect.onchange = window.updateCalcTotal;
        addRowBtn.onclick = createRow;

        // Initialize with one row
        createRow();

        saveBtn.onclick = () => {
            const empId = empSelect.value;
            if (!empId) return;

            const rows = tbody.querySelectorAll('tr');
            let successCount = 0;

            rows.forEach(tr => {
                const date = tr.querySelector('.calc-date').value;
                const tIn = tr.querySelector('.calc-in').value;
                const tOut = tr.querySelector('.calc-out').value;

                const start = new Date(`2000-01-01T${tIn}`);
                const end = new Date(`2000-01-01T${tOut}`);
                let diff = (end - start) / 1000 / 60 / 60;
                if (diff < 0) diff += 24;

                Storage.add('logs', {
                    employeeId: empId,
                    date: date,
                    timeIn: tIn,
                    timeOut: tOut,
                    hours: diff.toFixed(2),
                    isImported: false
                });
                successCount++;
            });

            alert(`¡Éxito! Se guardaron ${successCount} registros en el historial.`);
            App.switchView('payroll');
        };
    },

    import: () => {
        return `
            <div class="card-container">
                <div style="margin-bottom: 2rem">
                    <h3>Importar Liquidación desde Excel</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem">El sistema leerá los datos siguiendo el orden de columnas indicado (Fecha Inicio, Fin, Empleado, Horas, etc.)</p>
                </div>

                <div class="import-zone" id="drop-zone">
                    <div style="font-size: 3rem; margin-bottom: 1rem">📄</div>
                    <h4>Arrastra tu archivo aquí</h4>
                    <p style="color: var(--text-muted); margin-top: 0.5rem">o haz clic para seleccionar (XLSX, XLS, CSV)</p>
                    <input type="file" id="file-input" hidden accept=".xlsx, .xls, .csv">
                </div>

                <div id="import-preview-container" style="display: none; margin-top: 3rem">
                    <div class="table-header">
                        <h3>Vista Previa de Importación</h3>
                        <button class="btn btn-primary" id="process-import-btn" onclick="window.executeImportAction()">✅ Confirmar e Importar</button>
                    </div>
                    <div id="import-status-msg" style="margin: 1rem 0; padding: 1rem; border-radius: 8px; display: none;"></div>
                    <div class="table-container preview-table">
                        <table id="preview-table">
                            <!-- Preview injected here -->
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    init_import: () => {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const previewContainer = document.getElementById('import-preview-container');
        const previewTable = document.getElementById('preview-table');
        const processBtn = document.getElementById('process-import-btn');
        let importedData = [];

        dropZone.onclick = () => fileInput.click();

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) handleFile(file);
        };

        window.excelDateToJSDate = (serial) => {
            if (!serial || isNaN(serial)) return serial;
            const utc_days = Math.floor(serial - 25569);
            const utc_value = utc_days * 86400;
            const date_info = new Date(utc_value * 1000);
            return date_info.toISOString().split('T')[0];
        };

        const handleFile = (file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: false });
                const firstSheet = workbook.SheetNames[0];
                const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1 });

                // Filter out empty rows and skip header
                // Filter out empty rows and skip header
                importedData = sheetData.slice(1).filter(row => row && row.length > 0);
                window.importDataBuffer = importedData;
                renderPreview(importedData);
            };
            reader.readAsArrayBuffer(file);
        };

        const renderPreview = (data) => {
            previewContainer.style.display = 'block';
            previewTable.innerHTML = `
                <thead>
                    <tr>
                        <th>Ini</th>
                        <th>Fin</th>
                        <th>Empleado</th>
                        <th>Horas</th>
                        <th>Normal</th>
                        <th>Extra</th>
                        <th>Salario Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(row => {
                const dateIni = window.excelDateToJSDate(row[0]);
                const dateFin = window.excelDateToJSDate(row[1]);
                return `
                            <tr>
                                <td>${dateIni || '-'}</td>
                                <td>${dateFin || '-'}</td>
                                <td style="font-weight:600">${String(row[2] || '-')}</td>
                                <td>${row[3] || '0'}h</td>
                                <td>${row[7] || '0'}h</td>
                                <td>${row[8] || '0'}h</td>
                                <td style="color: var(--success)">₡${(row[14] || 0).toLocaleString()}</td>
                            </tr>
                        `;
            }).join('')}
                </tbody>
            `;
        };

        window.executeImportAction = function () {
            const dataToImport = window.importDataBuffer || [];
            console.log('Iniciando importación desde función global...', dataToImport.length);

            if (dataToImport.length === 0) {
                alert('No hay datos en la vista previa para importar.');
                return;
            }

            if (!confirm(`¿Confirmar la importación de ${dataToImport.length} registros?`)) return;

            const status = document.getElementById('import-status-msg');
            if (status) {
                status.style.display = 'block';
                status.style.background = 'rgba(99,102,241,0.1)';
                status.textContent = 'Procesando registros... por favor espere.';
            }

            try {
                const employees = Storage.get('employees');
                dataToImport.forEach((row, index) => {
                    const empName = row[2];
                    if (!empName) return;

                    const dateIni = window.excelDateToJSDate(row[0]);
                    const dateFin = window.excelDateToJSDate(row[1]);

                    let emp = employees.find(e => e.name && e.name.toLowerCase() === String(empName).toLowerCase());
                    if (!emp) {
                        const totalSal = parseFloat(row[14]) || 0;
                        const totalHrs = parseFloat(row[3]) || 1;
                        const rate = Math.round(totalSal / totalHrs) || 3500;

                        emp = Storage.add('employees', {
                            name: String(empName),
                            position: 'Importado',
                            hourlyRate: isNaN(rate) ? 3500 : rate,
                            startDate: dateIni || Storage.getLocalDate(),
                            status: 'Active'
                        });
                        employees.push(emp);
                    }

                    Storage.add('logs', {
                        employeeId: emp.id,
                        date: dateFin || Storage.getLocalDate(),
                        hours: parseFloat(row[3]) || 0,
                        isImported: true
                    });

                    Storage.add('payments', {
                        employeeId: emp.id,
                        hours: parseFloat(row[3]) || 0,
                        amount: parseFloat(row[14]) || 0,
                        date: dateFin || Storage.getLocalDate(),
                        isImported: true
                    });
                });

                alert('Importación completada con éxito.');
                App.switchView('payroll');
            } catch (err) {
                console.error(err);
                alert('Ocurrió un error. Revise la consola.');
            }
        };
    },

    profile: () => {
        const currentUser = Auth.getUser();
        const allUsers = Storage.get('users');

        return `
            <div style="max-width: 800px; margin: 0 auto;">
                <!-- Card: Gestión de Usuarios -->
                <div class="card-container">
                    <div class="table-header" style="margin-bottom: 2rem">
                        <div>
                            <h3 style="margin: 0">Gestión de Usuarios Admins</h3>
                            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px">Haz clic en cualquier usuario para modificar sus datos o cambiar su contraseña.</p>
                        </div>
                        <button class="btn btn-primary" onclick="window.openUserModal()">+ Nuevo Usuario</button>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nombre Completo</th>
                                    <th>Usuario</th>
                                    <th style="text-align: right">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allUsers.map(u => `
                                    <tr style="cursor: pointer" onclick="window.openUserModal('${u.id}')">
                                        <td>
                                            <div style="font-weight: 600">${u.name}</div>
                                            ${u.id === currentUser.id ? '<span style="color:var(--primary); font-size:0.7rem; font-weight:700">● TÚ (SESIÓN ACTUAL)</span>' : ''}
                                        </td>
                                        <td style="color: var(--text-muted)">${u.username}</td>
                                        <td style="text-align: right; display: flex; gap: 8px; justify-content: flex-end;" onclick="event.stopPropagation()">
                                            <button class="btn" style="padding: 6px 10px; background: rgba(99, 102, 241, 0.1); color: var(--primary)" 
                                                onclick="window.openUserModal('${u.id}')" title="Editar Usuario">
                                                ✏️ Editar
                                            </button>
                                            ${u.id !== currentUser.id ? `
                                                <button class="btn" style="padding: 6px 10px; background: rgba(239, 68, 68, 0.1); color: var(--danger)" 
                                                    onclick="window.deleteUser('${u.id}')" title="Eliminar Usuario">
                                                    🗑️
                                                </button>
                                            ` : ''}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Modal Usuario (Crear/Editar) -->
            <dialog id="user-modal" class="modal">
                <div class="modal-content" style="width: 450px">
                    <div style="text-align: center; margin-bottom: 2rem">
                        <div id="user-modal-icon" style="font-size: 3rem; margin-bottom: 1rem">👤</div>
                        <h3 id="user-modal-title" style="margin: 0">Registrar Usuario</h3>
                        <p id="user-modal-desc" style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px"></p>
                    </div>
                    
                    <form id="user-form" class="login-form">
                        <input type="hidden" id="user-id-field">
                        <div class="login-input-group">
                            <label>Nombre Completo</label>
                            <input type="text" id="user-name-field" required placeholder="Ej: Administrador 2">
                        </div>
                        <div class="login-input-group">
                            <label>Nombre de Usuario</label>
                            <input type="text" id="user-username-field" required placeholder="ej: admin2">
                        </div>
                        <div class="login-input-group">
                            <label id="user-pass-label">Contraseña</label>
                            <input type="password" id="user-pass-field" placeholder="••••••••">
                            <p id="user-pass-hint" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; display: none;">Deja en blanco para no cambiar la clave.</p>
                        </div>
                        
                        <div style="margin-top: 2.5rem; display: flex; gap: 1rem;">
                            <button type="button" class="btn" style="flex: 1; padding: 12px" onclick="this.closest('dialog').close()">Cancelar</button>
                            <button type="submit" id="user-submit-btn" class="btn btn-primary" style="flex: 1; padding: 12px">Crear Usuario</button>
                        </div>
                    </form>
                </div>
            </dialog>
        `;
    },

    payroll: () => {
        const employees = Storage.get('employees');
        const logs = Storage.get('logs');
        const payments = Storage.get('payments');

        return `
            <div class="card-container" style="margin-bottom: 2rem">
                <h3>Resumen de Pagos Pendientes</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Empleado</th>
                                <th>Horas Acumuladas</th>
                                <th>Salario Bruto</th>
                                <th>Est. CCSS (10.67%)</th>
                                <th>Est. Neto</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${employees.filter(e => e.status === 'Active').map(emp => {
            const empLogs = logs.filter(l => l.employeeId === emp.id);
            const totalHours = empLogs.reduce((s, l) => s + parseFloat(l.hours), 0);
            const paidHours = payments.filter(p => p.employeeId === emp.id).reduce((s, p) => s + p.hours, 0);
            const pendingHours = Math.max(0, totalHours - paidHours);
            const pendingAmount = pendingHours * emp.hourlyRate;
            const estCCSS = emp.applyCCSS ? Math.round(pendingAmount * 0.1067) : 0;
            const estNet = pendingAmount - estCCSS;

            if (pendingHours <= 0) return ''; // Omitir si no hay pendientes

            return `
                                    <tr>
                                        <td>${emp.name}</td>
                                        <td>${pendingHours.toFixed(2)}h</td>
                                        <td style="font-weight: 600">₡${pendingAmount.toLocaleString()}</td>
                                        <td style="color: var(--danger)">${estCCSS > 0 ? `₡${estCCSS.toLocaleString()}` : '—'}</td>
                                        <td style="color: var(--success); font-weight: 600">₡${estNet.toLocaleString()}</td>
                                        <td style="display: flex; gap: 8px;">
                                            <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem" 
                                                onclick="window.processPayment('${emp.id}', ${pendingHours}, ${pendingAmount})">
                                                Pagar
                                            </button>
                                            <button class="btn" style="padding: 6px 12px; font-size: 0.8rem; background: rgba(99, 102, 241, 0.1); color: var(--primary)" 
                                                title="Ver detalle de horas"
                                                onclick="window.viewPendingDetail('${emp.id}')">
                                                👁️
                                            </button>
                                            <button class="btn" style="padding: 6px 12px; font-size: 0.8rem; background: rgba(239, 68, 68, 0.1); color: var(--danger)" 
                                                title="Eliminar horas pendientes"
                                                onclick="window.clearPendingLogs('${emp.id}')">
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card-container">
                <div class="table-header">
                    <h3>Historial de Pagos</h3>
                    <button class="btn" style="background: rgba(239, 68, 68, 0.1); color: var(--danger); display: none;" id="btn-delete-multiple-payments">
                        🗑️ Eliminar Seleccionados (<span id="selected-count">0</span>)
                    </button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 40px"><input type="checkbox" id="check-all-payments"></th>
                                <th>Fecha</th>
                                <th>Empleado</th>
                                <th>Horas</th>
                                <th>Bruto</th>
                                <th>CCSS (10.67%)</th>
                                <th>Neto</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${payments.length ? payments.slice().reverse().map(p => {
            const emp = employees.find(e => e.id === p.employeeId);
            const ccss = p.deductionCCSS || 0;
            const net = p.netAmount || p.amount;
            return `
                                    <tr>
                                        <td><input type="checkbox" class="payment-check" data-id="${p.id}"></td>
                                        <td>${p.date}</td>
                                        <td>${emp ? emp.name : 'Unknown'}</td>
                                        <td>${p.hours}h</td>
                                        <td>₡${p.amount.toLocaleString()}</td>
                                        <td style="color: var(--danger)">${ccss > 0 ? `₡${ccss.toLocaleString()}` : '—'}</td>
                                        <td style="font-weight: 600; color: var(--success)">₡${net.toLocaleString()}</td>
                                        <td style="display: flex; gap: 8px; align-items: center;">
                                            <span class="tag tag-active">Pagado</span>
                                            <button class="btn" style="padding: 4px 8px; background: rgba(99, 102, 241, 0.1); color: var(--primary); font-size: 0.8rem;" 
                                                title="Ver Detalle"
                                                onclick="window.viewPaymentDetail('${p.id}')">
                                                👁️ Detalle
                                            </button>
                                            <button class="btn" style="padding: 4px 8px; background: rgba(37, 211, 102, 0.1); color: #25D366; font-size: 0.8rem;" 
                                                title="Enviar por WhatsApp"
                                                onclick="window.sharePaymentWhatsApp('${p.id}')">
                                                WA
                                            </button>
                                        </td>
                                    </tr>
                                `;
        }).join('') : '<tr><td colspan="8" style="text-align:center">No hay pagos registrados</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <dialog id="payment-detail-modal" class="card-container" style="margin: auto; border: 1px solid var(--primary); padding: 2rem; width: 600px; background: var(--bg-card); color: white;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 id="payment-modal-title">Detalle de Pago</h3>
                    <button class="btn" onclick="document.getElementById('payment-detail-modal').close()">✕</button>
                </div>
                <div id="payment-modal-content">
                    <!-- Breakdown injected here -->
                </div>
            </dialog>
        `;
    },

    init_profile: () => {
        const currentUser = Auth.getUser();

        // --- Gestión de otros usuarios ---
        window.openUserModal = (id = null) => {
            const modal = document.getElementById('user-modal');
            const title = document.getElementById('user-modal-title');
            const btn = document.getElementById('user-submit-btn');
            const hint = document.getElementById('user-pass-hint');
            const passField = document.getElementById('user-pass-field');
            const idField = document.getElementById('user-id-field');
            const nameField = document.getElementById('user-name-field');
            const userField = document.getElementById('user-username-field');

            document.getElementById('user-form').reset();
            idField.value = id || '';

            if (id) {
                const user = Storage.get('users').find(u => u.id === id);
                title.textContent = 'Editar Usuario';
                btn.textContent = 'Guardar Cambios';
                hint.style.display = 'block';
                passField.required = false;
                nameField.value = user.name;
                userField.value = user.username;
            } else {
                title.textContent = 'Registrar Nuevo Usuario';
                btn.textContent = 'Crear Usuario';
                hint.style.display = 'none';
                passField.required = true;
            }

            modal.showModal();
        };

        const userForm = document.getElementById('user-form');
        if (userForm) {
            userForm.onsubmit = (e) => {
                e.preventDefault();
                const id = document.getElementById('user-id-field').value;
                const name = document.getElementById('user-name-field').value;
                const username = document.getElementById('user-username-field').value;
                const password = document.getElementById('user-pass-field').value;

                const users = Storage.get('users');

                // Check if username is taken by ANOTHER user
                if (users.some(u => u.username === username && u.id !== id)) {
                    alert('Este nombre de usuario ya está en uso por otro administrador.');
                    return;
                }

                if (id) {
                    const updates = { name, username };
                    if (password) updates.password = password;
                    Storage.update('users', id, updates);
                    alert('Usuario actualizado correctamente.');
                } else {
                    Storage.add('users', { name, username, password });
                    alert('Usuario creado con éxito.');
                }

                document.getElementById('user-modal').close();
                App.renderView('profile');
            };
        }

        window.deleteUser = (id) => {
            if (id === currentUser.id) return alert('No puedes eliminarte a ti mismo.');
            if (!confirm('¿Seguro que deseas eliminar este usuario admin? No podrá volver a entrar.')) return;

            Storage.delete('users', id);
            App.renderView('profile');
        };
    },

    init_payroll: () => {
        const checkAll = document.getElementById('check-all-payments');
        const rowChecks = document.querySelectorAll('.payment-check');
        const deleteBtn = document.getElementById('btn-delete-multiple-payments');
        const countSpan = document.getElementById('selected-count');

        const updateUI = () => {
            const selected = document.querySelectorAll('.payment-check:checked');
            countSpan.textContent = selected.length;
            deleteBtn.style.display = selected.length > 0 ? 'inline-flex' : 'none';
        };

        if (checkAll) {
            checkAll.onchange = () => {
                rowChecks.forEach(cb => cb.checked = checkAll.checked);
                updateUI();
            };
        }

        rowChecks.forEach(cb => {
            cb.onchange = updateUI;
        });

        if (deleteBtn) {
            deleteBtn.onclick = () => {
                const selected = Array.from(document.querySelectorAll('.payment-check:checked')).map(cb => cb.dataset.id);
                if (selected.length === 0) return;

                if (!confirm(`¿Está seguro de que desea eliminar ${selected.length} registros de pago? Esta acción no se puede deshacer.`)) return;

                const payments = Storage.get('payments');
                const filtered = payments.filter(p => !selected.includes(p.id));
                Storage.save('payments', filtered);

                App.renderView('payroll');
                alert('Registros eliminados correctamente.');
            };
        }

        window.viewPendingDetail = (empId) => {
            const logs = Storage.get('logs');
            const payments = Storage.get('payments');
            const employees = Storage.get('employees');

            const emp = employees.find(e => e.id === empId);
            if (!emp) return;

            const empLogs = logs.filter(l => l.employeeId === empId);
            const paidHours = payments.filter(p => p.employeeId === empId).reduce((s, p) => s + parseFloat(p.hours || 0), 0);

            // Sort logs by date (oldest first)
            const sortedLogs = empLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

            let accumulated = 0;
            const pendingLogs = [];

            for (const log of sortedLogs) {
                const logHours = parseFloat(log.hours || 0);
                if (accumulated + logHours > paidHours) {
                    const unpaidHours = Math.min(logHours, (accumulated + logHours) - paidHours);
                    pendingLogs.push({
                        ...log,
                        displayHours: unpaidHours.toFixed(2),
                        isPartial: unpaidHours < logHours
                    });
                }
                accumulated += logHours;
            }

            const modal = document.getElementById('payment-detail-modal');
            const content = document.getElementById('payment-modal-content');
            const title = document.getElementById('payment-modal-title');

            if (!modal || !content || !title) return;

            title.textContent = `Detalle de Horas Pendientes: ${emp.name}`;

            content.innerHTML = `
                <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
                    <p style="margin:5px 0"><strong>Total Horas por Pagar:</strong> ${pendingLogs.reduce((s, l) => s + parseFloat(l.displayHours || 0), 0).toFixed(2)}h</p>
                    <p style="margin:5px 0"><strong>Monto Total Pendiente:</strong> ₡${Math.round(pendingLogs.reduce((s, l) => s + (parseFloat(l.displayHours) * emp.hourlyRate), 0)).toLocaleString()}</p>
                    <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 5px;">Esta lista muestra las jornadas o fracciones de jornada que aún no se han incluido en un pago procesado.</p>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Entrada/Salida</th>
                                <th>Horas</th>
                                <th>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pendingLogs.map(l => {
                const subtotal = Math.round(parseFloat(l.displayHours) * emp.hourlyRate);
                return `
                                <tr>
                                    <td>${l.date}</td>
                                    <td style="font-size: 0.8rem">${l.timeIn || '—'} - ${l.timeOut || '—'}</td>
                                    <td style="font-weight: 600">${l.displayHours}h ${l.isPartial ? '<span style="font-size:0.75rem; color:var(--accent)">*</span>' : ''}</td>
                                    <td style="color: var(--success)">₡${subtotal.toLocaleString()}</td>
                                </tr>
                            `;
            }).join('')}
                        </tbody>
                    </table>
                </div>
                <div style="margin-top: 1.5rem; text-align: right;">
                    <button class="btn btn-primary" onclick="document.getElementById('payment-detail-modal').close()">Entendido</button>
                </div>
            `;

            modal.showModal();
        };

        window.clearPendingLogs = (empId) => {
            const logs = Storage.get('logs');
            const payments = Storage.get('payments');
            const employees = Storage.get('employees');

            const emp = employees.find(e => e.id === empId);
            if (!emp) return;

            // Calculate total hours logged and total hours paid
            const empLogs = logs.filter(l => l.employeeId === empId);
            const totalHours = empLogs.reduce((s, l) => s + parseFloat(l.hours || 0), 0);
            const paidHours = payments.filter(p => p.employeeId === empId).reduce((s, p) => s + parseFloat(p.hours || 0), 0);
            const pendingHours = Math.max(0, totalHours - paidHours);

            if (pendingHours <= 0) {
                alert('Este empleado no tiene horas pendientes por pagar.');
                return;
            }

            if (!confirm(`¿Está seguro de que desea eliminar ${pendingHours.toFixed(2)} horas pendientes de ${emp.name}?\n\nEsta acción eliminará los registros de horas que aún no han sido pagados y no se puede deshacer.`)) {
                return;
            }

            // Sort logs by date (oldest first) to preserve the most recent ones
            const sortedLogs = empLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

            // Keep only the logs that have been paid
            let accumulated = 0;
            const logsToKeep = [];

            for (const log of sortedLogs) {
                const logHours = parseFloat(log.hours || 0);
                if (accumulated + logHours <= paidHours) {
                    logsToKeep.push(log);
                    accumulated += logHours;
                } else if (accumulated < paidHours) {
                    // Partial log - this shouldn't happen in normal flow, but handle it
                    const remaining = paidHours - accumulated;
                    if (remaining > 0) {
                        logsToKeep.push({ ...log, hours: remaining.toFixed(2) });
                    }
                    break;
                }
            }

            // Remove all logs for this employee and add back only the paid ones
            const otherLogs = logs.filter(l => l.employeeId !== empId);
            const newLogs = [...otherLogs, ...logsToKeep];

            Storage.save('logs', newLogs);
            App.renderView('payroll');
            alert(`Se eliminaron ${pendingHours.toFixed(2)} horas pendientes de ${emp.name}.`);
        };

        window.viewPaymentDetail = (id) => {
            const payments = Storage.get('payments');
            const p = payments.find(pay => pay.id === id);
            if (!p) return;

            const employees = Storage.get('employees');
            const emp = employees.find(e => e.id === p.employeeId);
            const modal = document.getElementById('payment-detail-modal');
            const content = document.getElementById('payment-modal-content');

            content.innerHTML = `
                <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
                    <p style="margin:5px 0"><strong>Colaborador:</strong> ${emp ? emp.name : 'N/A'}</p>
                    <p style="margin:5px 0"><strong>Fecha de Pago:</strong> ${p.date}</p>
                    <p style="margin:5px 0"><strong>Total Horas:</strong> ${p.hours}h</p>
                    <p style="margin:5px 0"><strong>Monto Total:</strong> <span style="color:var(--success); font-weight:600">₡${p.amount.toLocaleString()}</span></p>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Horas</th>
                                <th>Tarifa</th>
                                <th>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(p.breakdown && p.breakdown.length > 0) ? p.breakdown.map(item => `
                                <tr>
                                    <td>${item.date}</td>
                                    <td>${item.hours}h</td>
                                    <td>₡${(item.rate || p.hourlyRate || 0).toLocaleString()}</td>
                                    <td style="color:var(--success)">₡${(item.amount || (parseFloat(item.hours) * (item.rate || p.hourlyRate || 0))).toLocaleString()}</td>
                                </tr>
                            `).join('') : '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted)">No hay desglose detallado disponible para este registro antiguo.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            `;
            modal.showModal();
        };

        window.sharePaymentWhatsApp = (id) => {
            const payments = Storage.get('payments');
            const p = payments.find(pay => pay.id === id);
            if (!p) return;

            const employees = Storage.get('employees');
            const emp = employees.find(e => e.id === p.employeeId);
            const name = emp ? emp.name : 'Colaborador';

            let detailMsg = '';
            if (p.breakdown && p.breakdown.length > 0) {
                detailMsg = `%0A*Detalle de Horas:*%0A`;
                p.breakdown.forEach(item => {
                    detailMsg += `• ${item.date}: ${item.hours}h%0A`;
                });
            }

            const ccssMsg = p.deductionCCSS > 0 ?
                `*Salario Bruto:* ₡${p.amount.toLocaleString()}%0A` +
                `*Rebajo CCSS (10.67%):* -₡${p.deductionCCSS.toLocaleString()}%0A` +
                `*Salario Neto:* ₡${(p.netAmount || p.amount).toLocaleString()}%0A` :
                `*Monto Total:* ₡${p.amount.toLocaleString()}%0A`;

            const message = `*RESUMEN DE PAGO - GastroNomina*%0A%0A` +
                `*Empleado:* ${name}%0A` +
                `*Fecha de Pago:* ${p.date}%0A` +
                `*Total Horas:* ${p.hours}h%0A` +
                detailMsg +
                `%0A${ccssMsg}%0A` +
                `_Gracias por tu excelente trabajo._`;

            const phone = emp && emp.phone ? emp.phone.replace(/\D/g, '') : '';
            const baseUrl = phone ? `https://wa.me/${phone}` : `https://wa.me/`;

            window.open(`${baseUrl}?text=${message}`, '_blank');
        };

        window.viewPaymentDetail = (id) => {
            const payments = Storage.get('payments');
            const p = payments.find(pay => pay.id === id);
            if (!p) return;

            const employees = Storage.get('employees');
            const emp = employees.find(e => e.id === p.employeeId);
            const modal = document.getElementById('payment-detail-modal');
            const content = document.getElementById('payment-modal-content');

            const hasCCSS = p.deductionCCSS > 0;

            content.innerHTML = `
                <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <p style="margin:2px 0"><strong>Colaborador:</strong> ${emp ? emp.name : 'N/A'}</p>
                        <p style="margin:2px 0"><strong>Fecha de Pago:</strong> ${p.date}</p>
                        <p style="margin:2px 0"><strong>Total Horas:</strong> ${p.hours}h</p>
                        <p style="margin:2px 0"><strong>Salario Bruto:</strong> ₡${p.amount.toLocaleString()}</p>
                        ${hasCCSS ? `
                            <p style="margin:2px 0; color: var(--danger)"><strong>Rebajo CCSS (10.67%):</strong> -₡${p.deductionCCSS.toLocaleString()}</p>
                            <p style="margin:2px 0; color: var(--success)"><strong>Salario Neto:</strong> ₡${p.netAmount.toLocaleString()}</p>
                            <p style="margin:2px 0; color: var(--accent); grid-column: span 2"><strong>Carga Patronal (26.67%):</strong> ₡${p.employerCCSS.toLocaleString()}</p>
                        ` : ''}
                    </div>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Horas</th>
                                <th>Tarifa</th>
                                <th>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(p.breakdown && p.breakdown.length > 0) ? p.breakdown.map(item => `
                                <tr>
                                    <td>${item.date}</td>
                                    <td>${item.hours}h</td>
                                    <td>₡${(item.rate || p.hourlyRate || 0).toLocaleString()}</td>
                                    <td style="color:var(--success)">₡${(item.amount || (parseFloat(item.hours) * (item.rate || p.hourlyRate || 0))).toLocaleString()}</td>
                                </tr>
                            `).join('') : '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted)">No hay desglose detallado disponible para este registro antiguo.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            `;
            modal.showModal();
        };
    },

    benefits: () => {
        const employees = Storage.get('employees');
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

                <div class="card-container" style="background: linear-gradient(135deg, var(--bg-card) 0%, #2d3748 100%);">
                    <h3 style="color: var(--primary)">Información Legal</h3>
                    <ul style="margin: 1rem 0; color: var(--text-muted); line-height: 1.6;">
                        <li><strong>Aguinaldo:</strong> Un mes de salario promedio (1/12 de lo ganado en el año).</li>
                        <li><strong>Vacaciones:</strong> 2 semanas por cada 50 trabajadas.</li>
                        <li><strong>Cesantía:</strong> Indemnización en caso de despido sin causa.</li>
                    </ul>
                    <div style="padding: 1rem; background: rgba(99, 102, 241, 0.1); border-radius: 12px; border-left: 4px solid var(--primary)">
                        <small>Estos cálculos son ilustrativos y deben ser validados con un contador.</small>
                    </div>
                </div>
            </div>
        `;
    },

    init_benefits: () => {
        const select = document.getElementById('benefit-emp-select');
        const results = document.getElementById('benefit-results');

        select.onchange = () => {
            const empId = select.value;
            if (!empId) return;

            const emp = Storage.get('employees').find(e => e.id === empId);
            const monthlySalary = emp.hourlyRate * 8 * 22; // Est mntly

            const aguinaldo = monthlySalary; // Proyección de un mes
            const vacaciones = (monthlySalary / 30) * 14;
            const cesantia = monthlySalary * 0.5; // Simplificado

            results.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div class="stat-card" style="background: rgba(255,255,255,0.02)">
                        <h3 style="margin:0">Proyección Aguinaldo</h3>
                        <div class="value" style="color: var(--success); font-size: 1.5rem">₡${aguinaldo.toLocaleString()}</div>
                    </div>
                    <div class="stat-card" style="background: rgba(255,255,255,0.02)">
                        <h3 style="margin:0">Proyección Vacaciones</h3>
                        <div class="value" style="color: var(--warning); font-size: 1.5rem">₡${vacaciones.toLocaleString()}</div>
                    </div>
                    <div class="stat-card" style="background: rgba(255,255,255,0.02)">
                        <h3 style="margin:0">Proyección Cesantía</h3>
                        <div class="value" style="color: var(--accent); font-size: 1.5rem">₡${cesantia.toLocaleString()}</div>
                    </div>
                </div>
            `;
        };
    }
};

// --- Global Actions ---
window.deleteEmployee = (id) => {
    const emp = Storage.get('employees').find(e => e.id === id);
    if (!emp) return;

    // We'll inject a temporary modal for confirmation to avoid browser blocks
    const modalHtml = `
        <dialog id="delete-confirm-modal" class="card-container" style="margin: auto; border: 1px solid var(--danger); padding: 2rem; width: 400px; background: var(--bg-card); color: white;">
            <h3 style="margin-bottom: 1rem; color: var(--danger)">¿Eliminar Empleado?</h3>
            <p style="margin-bottom: 2rem; color: var(--text-muted)">Esta acción eliminará a <strong>${emp.name}</strong> y no se puede deshacer.</p>
            <div style="display: flex; gap: 10px;">
                <button id="confirm-delete-btn" class="btn" style="background: var(--danger); color: white; flex:1">Eliminar</button>
                <button id="cancel-delete-btn" class="btn" style="background: rgba(255,255,255,0.1); flex:1">Cancelar</button>
            </div>
        </dialog>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('delete-confirm-modal');
    modal.showModal();

    document.getElementById('confirm-delete-btn').onclick = () => {
        Storage.delete('employees', id);
        modal.close();
        modal.remove();
        App.switchView('employees');
    };

    document.getElementById('cancel-delete-btn').onclick = () => {
        modal.close();
        modal.remove();
    };
};

window.processPayment = (empId, hours, amount) => {
    if (hours <= 0) {
        alert('No hay horas pendientes para pagar.');
        return;
    }

    if (confirm(`¿Proceder con el pago de ₡${amount.toLocaleString()} por ${hours} horas?`)) {
        // Obtener desglose de horas para el comprobante
        const logs = Storage.get('logs').filter(l => l.employeeId === empId);
        const payments = Storage.get('payments').filter(p => p.employeeId === empId);
        const totalPaidHoursBefore = payments.reduce((s, p) => s + p.hours, 0);

        // Ordenar logs por fecha para identificar cuáles se están pagando
        logs.sort((a, b) => new Date(a.date) - new Date(b.date));

        const emp = Storage.get('employees').find(e => e.id === empId);
        const rate = emp ? emp.hourlyRate : 0;
        const applyCCSS = emp ? !!emp.applyCCSS : false;

        let deductionCCSS = 0;
        let employerCCSS = 0;
        let netAmount = amount;

        if (applyCCSS) {
            deductionCCSS = Math.round(amount * 0.1067);
            employerCCSS = Math.round(amount * 0.2667);
            netAmount = amount - deductionCCSS;
        }

        let accumulated = 0;
        const paidLogsBreakdown = [];

        logs.forEach(log => {
            const logHrs = parseFloat(log.hours);
            accumulated += logHrs;

            // Si este log está (al menos parcialmente) después de lo ya pagado
            if (accumulated > totalPaidHoursBefore) {
                const overlap = Math.min(logHrs, accumulated - totalPaidHoursBefore);
                paidLogsBreakdown.push({
                    date: log.date,
                    hours: overlap.toFixed(2),
                    rate: rate,
                    amount: overlap * rate
                });
            }
        });

        const np = Storage.add('payments', {
            employeeId: empId,
            hours: hours,
            amount: amount, // Bruto
            netAmount: netAmount,
            deductionCCSS: deductionCCSS,
            employerCCSS: employerCCSS,
            hourlyRate: rate,
            date: Storage.getLocalDate(),
            breakdown: paidLogsBreakdown
        });

        App.renderView('payroll');

        // Automatización: Abrir WhatsApp con el comprobante recién creado
        if (np && np.id) {
            window.sharePaymentWhatsApp(np.id);
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => App.init());
