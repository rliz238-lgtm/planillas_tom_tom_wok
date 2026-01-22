/**
 * Planillas Tom Tom Wok - Core Logic (API Version)
 */

// --- Data Persistence Layer ---
const Storage = {
    data: {
        employees: [],
        logs: [],
        payments: [],
        users: []
    },

    getLocalDate(d = new Date()) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    async init() {
        try {
            console.log('🔄 Sincronizando datos...');
            const results = await Promise.all([
                fetch('/api/employees').then(r => r.json()),
                fetch('/api/logs').then(r => r.json()),
                fetch('/api/users').then(r => r.json()),
                fetch('/api/payments').then(r => r.json()),
            ]);

            this.data.employees = results[0];
            this.data.logs = results[1];
            this.data.users = results[2];
            this.data.payments = results[3];

            // Normalización de datos para compatibilidad con lógica de backup
            this.data.employees.forEach(e => {
                e.hourlyRate = parseFloat(e.hourly_rate);
                e.startDate = e.start_date ? e.start_date.substring(0, 10) : '';
                e.endDate = e.end_date ? e.end_date.substring(0, 10) : '';
                e.applyCCSS = e.apply_ccss;
            });

            this.data.logs.forEach(l => {
                l.employeeId = String(l.employee_id);
                l.date = l.date.substring(0, 10);
                l.hours = parseFloat(l.hours);
            });

            this.data.payments.forEach(p => {
                p.employeeId = String(p.employee_id);
                p.date = p.date.substring(0, 10);
                p.amount = parseFloat(p.amount);
                p.hours = parseFloat(p.hours || 0);
            });

            console.log('✅ Datos sincronizados con éxito');
        } catch (err) {
            console.error('❌ Error al sincronizar datos:', err);
        }
    },

    get(key) {
        return this.data[key] || [];
    },

    async add(key, item) {
        const endpoints = {
            employees: '/api/employees',
            logs: '/api/logs',
            payments: '/api/payments',
            users: '/api/users'
        };

        try {
            const response = await fetch(endpoints[key], {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            const newItem = await response.json();
            await this.init(); // Resync
            return newItem;
        } catch (err) {
            console.error(`Error adding to ${key}:`, err);
        }
    },

    async update(key, id, updates) {
        if (key !== 'employees') {
            console.warn('Update only implemented for employees currently');
            return;
        }

        try {
            await fetch(`/api/employees/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            await this.init(); // Resync
        } catch (err) {
            console.error(`Error updating ${key}:`, err);
        }
    },

    async delete(key, id) {
        if (key !== 'employees') {
            console.warn('Delete only implemented for employees currently');
            return;
        }

        try {
            await fetch(`/api/employees/${id}`, {
                method: 'DELETE'
            });
            await this.init(); // Resync
        } catch (err) {
            console.error(`Error deleting ${key}:`, err);
        }
    }
};

// --- Authentication Layer ---
const Auth = {
    SCHEMA: 'ttw_user',

    login(username, password) {
        // Handled via fetch in App.renderLogin
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
        await Storage.init();
        this.setupNavigation();
        this.renderView('dashboard');

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => Auth.logout();
        }

        const displayEl = document.querySelector('.username-display');
        if (displayEl) {
            const user = Auth.getUser();
            displayEl.textContent = user.name || user.username;
        }
    },

    renderLogin() {
        document.getElementById('login-view').style.display = 'flex';
        document.getElementById('app').style.display = 'none';

        const form = document.getElementById('login-form');
        const error = document.getElementById('login-error');

        form.onsubmit = async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                if (response.ok) {
                    const user = await response.json();
                    localStorage.setItem(Auth.SCHEMA, JSON.stringify(user));
                    location.reload();
                } else {
                    error.style.display = 'block';
                    form.reset();
                    document.getElementById('username').focus();
                }
            } catch (err) {
                console.error('Error in login:', err);
                error.style.display = 'block';
                error.textContent = 'Error de conexión';
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
        const navItem = document.querySelector(`[data-view="${view}"]`);
        if (navItem) {
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            navItem.classList.add('active');
        }

        const titles = {
            dashboard: '📊 Dashboard',
            employees: '👥 Empleados',
            employeeDetail: '🔍 Detalle',
            calculator: '🧮 Calculadora',
            payroll: '💰 Planillas',
            benefits: '⚖️ Prestaciones',
            import: '📥 Importar',
            profile: '⚙️ Mi Perfil'
        };

        document.getElementById('view-title').textContent = titles[view] || 'Tom Tom Wok';
        this.renderView(view, arg);
    },

    renderView(view, arg = null) {
        const container = document.getElementById('view-container');
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('app').style.display = 'flex';

        container.innerHTML = `<div class="view-animate">${Views[view](arg)}</div>`;

        if (Views[`init_${view}`]) {
            Views[`init_${view}`](arg);
        }
    }
};

// --- UI Components & Views ---
const Views = {
    dashboard: () => {
        const employees = Storage.get('employees');
        const activeEmployees = employees.filter(e => e.status === 'Active');
        const logs = Storage.get('logs');

        const now = new Date();
        const todayStr = Storage.getLocalDate();
        const currentMonth = todayStr.substring(0, 7);
        const monthLogs = logs.filter(l => l.date && l.date.startsWith(currentMonth));
        const monthHours = monthLogs.reduce((s, l) => s + l.hours, 0);

        // Semana Actual (Lunes a Domingo)
        const getWeekRange = (date) => {
            const d = new Date(date);
            const day = d.getDay();
            const dayNum = day === 0 ? 7 : day;
            const diffToMonday = 1 - dayNum;
            const monday = new Date(d);
            monday.setDate(d.getDate() + diffToMonday);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            const format = (dt) => Storage.getLocalDate(dt);
            return { start: format(monday), end: format(sunday) };
        };

        const weekRange = getWeekRange(now);
        const weekLogs = logs.filter(l => l.date >= weekRange.start && l.date <= weekRange.end);
        const weekHours = weekLogs.reduce((s, l) => s + l.hours, 0);

        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Empleados Activos</h3>
                    <div class="value">${activeEmployees.length}</div>
                    <div class="trend up">👥 Personal Actual</div>
                </div>
                <div class="stat-card">
                    <h3>Semana Actual</h3>
                    <div class="value">${weekHours.toFixed(1)}h</div>
                    <div class="trend" style="font-size: 0.75rem">${weekRange.start} al ${weekRange.end}</div>
                </div>
                <div class="stat-card">
                    <h3>Mes Actual</h3>
                    <div class="value">${monthHours.toFixed(1)}h</div>
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

        if (window.Chart) {
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
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
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
                                <th>Inicio</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredEmployees.map(emp => `
                                <tr>
                                    <td style="font-weight:600; cursor:pointer; color:var(--primary)" onclick="App.switchView('employeeDetail', '${emp.id}')">${emp.name}</td>
                                    <td>${emp.position}</td>
                                    <td>₡${emp.hourlyRate}</td>
                                    <td><span class="tag ${emp.status === 'Active' ? 'tag-active' : 'tag-inactive'}">${emp.status}</span></td>
                                    <td>${emp.startDate}</td>
                                    <td style="display: flex; gap: 8px;">
                                        <button class="btn" style="padding: 4px 8px; background: rgba(99,102,241,0.1)" onclick="window.editEmployee('${emp.id}')">✏️</button>
                                        <button class="btn" style="padding: 4px 8px; background: rgba(239,68,68,0.1)" onclick="window.deleteEmployee('${emp.id}')">🗑️</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <dialog id="employee-modal" class="card-container" style="margin: auto; border: 1px solid var(--primary); padding: 2rem; width: 450px; background: var(--bg-card); color: white;">
                <h3 id="modal-title">Registrar Empleado</h3>
                <form id="employee-form" style="display: flex; flex-direction: column; gap: 15px; margin-top: 1rem;">
                    <input type="hidden" name="id" id="edit-emp-id">
                    <div class="form-group">
                        <label>Nombre Completo</label>
                        <input type="text" name="name" required>
                    </div>
                    <div class="form-group">
                        <label>PIN (4 dígitos)</label>
                        <input type="text" name="pin" maxlength="4">
                    </div>
                    <div class="grid-2" style="gap: 1rem">
                        <div class="form-group">
                            <label>Cargo</label>
                            <input type="text" name="position" required>
                        </div>
                        <div class="form-group">
                            <label>Pago x Hora</label>
                            <input type="number" name="hourlyRate" required>
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
                    <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" name="applyCCSS" id="apply-ccss">
                        <label for="apply-ccss">Aplicar CCSS (10.67%)</label>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button type="submit" class="btn btn-primary" style="flex:1">Guardar</button>
                        <button type="button" class="btn" onclick="document.getElementById('employee-modal').close()" style="flex:1">Cancelar</button>
                    </div>
                </form>
            </dialog>
        `;
    },

    init_employees: () => {
        const modal = document.getElementById('employee-modal');
        const btn = document.getElementById('add-employee-btn');
        const form = document.getElementById('employee-form');
        const filter = document.getElementById('employee-status-filter');

        if (filter) {
            filter.onchange = () => {
                localStorage.setItem('gn_employee_status_filter', filter.value);
                App.renderView('employees');
            };
        }

        btn.onclick = () => {
            form.reset();
            document.getElementById('edit-emp-id').value = '';
            document.getElementById('modal-title').textContent = 'Registrar Empleado';
            modal.showModal();
        };

        window.editEmployee = (id) => {
            const emp = Storage.get('employees').find(e => e.id == id);
            if (!emp) return;
            document.getElementById('modal-title').textContent = 'Editar Empleado';
            document.getElementById('edit-emp-id').value = emp.id;
            form.name.value = emp.name;
            form.pin.value = emp.pin || '';
            form.position.value = emp.position;
            form.hourlyRate.value = emp.hourlyRate;
            form.status.value = emp.status;
            form.startDate.value = emp.startDate;
            form.applyCCSS.checked = !!emp.applyCCSS;
            modal.showModal();
        };

        form.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-emp-id').value;
            const data = {
                name: form.name.value,
                pin: form.pin.value,
                position: form.position.value,
                hourlyRate: parseFloat(form.hourlyRate.value),
                status: form.status.value,
                startDate: form.startDate.value,
                applyCCSS: form.applyCCSS.checked
            };

            if (id) {
                await Storage.update('employees', id, data);
            } else {
                await Storage.add('employees', data);
            }
            modal.close();
            App.renderView('employees');
        };
    },

    employeeDetail: (id) => {
        const emp = Storage.get('employees').find(e => String(e.id) === String(id));
        if (!emp) return `<p>Empleado no encontrado</p>`;

        const logs = Storage.get('logs').filter(l => String(l.employeeId) === String(id));
        const totalHours = logs.reduce((s, l) => s + l.hours, 0);

        return `
            <div style="margin-bottom: 2rem;">
                <button class="btn" onclick="App.switchView('employees')">← Volver</button>
            </div>
            <div class="grid-2">
                <div class="card-container">
                    <h3>Perfil: ${emp.name}</h3>
                    <p><strong>Cargo:</strong> ${emp.position}</p>
                    <p><strong>Pago x Hora:</strong> ₡${emp.hourlyRate}</p>
                    <p><strong>Estado:</strong> ${emp.status}</p>
                    <p><strong>Inicio:</strong> ${emp.startDate}</p>
                </div>
                <div class="stat-card">
                    <h3>Horas Totales (Histórico)</h3>
                    <div class="value">${totalHours.toFixed(2)}h</div>
                </div>
            </div>
            <div class="card-container" style="margin-top: 2rem">
                <h3>Últimos Registros de Horas</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Entrada</th>
                                <th>Salida</th>
                                <th>Horas</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${logs.slice(-10).reverse().map(l => `
                                <tr>
                                    <td>${l.date}</td>
                                    <td>${l.time_in || '--:--'}</td>
                                    <td>${l.time_out || '--:--'}</td>
                                    <td>${l.hours}h</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    calculator: () => {
        const employees = Storage.get('employees').filter(e => e.status === 'Active');
        return `
            <div class="card-container">
                <h3>Calculadora de Pago</h3>
                <div class="form-group" style="max-width: 400px; margin: 1rem 0;">
                    <label>Empleado</label>
                    <select id="calc-employee-id">
                        <option value="">Seleccione...</option>
                        ${employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
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
                        <tbody id="calc-tbody"></tbody>
                    </table>
                </div>
                <div style="margin-top: 1rem; display: flex; gap: 10px;">
                    <button class="btn" id="calc-add-row">+ Añadir Día</button>
                    <button class="btn btn-primary" id="calc-save-logs" disabled>💾 Guardar Horas</button>
                </div>
                <div id="calc-summary" style="margin-top: 2rem; display: none; padding: 1rem; border: 1px solid var(--primary); border-radius: 10px;">
                    <p>Total Horas: <span id="calc-total-hours">0h</span></p>
                    <p>Monto: <span id="calc-total-pay">₡0</span></p>
                </div>
            </div>
        `;
    },

    init_calculator: () => {
        const tbody = document.getElementById('calc-tbody');
        const empSelect = document.getElementById('calc-employee-id');
        const saveBtn = document.getElementById('calc-save-logs');

        const updateTotals = () => {
            const rows = tbody.querySelectorAll('tr');
            let totalH = 0;
            const emp = Storage.get('employees').find(e => e.id == empSelect.value);

            rows.forEach(tr => {
                const clockIn = tr.querySelector('.in').value;
                const clockOut = tr.querySelector('.out').value;
                if (clockIn && clockOut) {
                    const diff = (new Date(`2000-01-01T${clockOut}`) - new Date(`2000-01-01T${clockIn}`)) / 36e5;
                    const hours = diff < 0 ? diff + 24 : diff;
                    tr.querySelector('.sub').textContent = hours.toFixed(2) + 'h';
                    totalH += hours;
                }
            });
            document.getElementById('calc-total-hours').textContent = totalH.toFixed(2) + 'h';
            document.getElementById('calc-total-pay').textContent = '₡' + Math.round(totalH * (emp ? emp.hourlyRate : 0)).toLocaleString();
            document.getElementById('calc-summary').style.display = totalH > 0 ? 'block' : 'none';
            saveBtn.disabled = !emp || totalH <= 0;
        };

        const createRow = () => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="date" class="date" value="${Storage.getLocalDate()}"></td>
                <td><input type="time" class="in" value="08:00"></td>
                <td><input type="time" class="out" value="17:00"></td>
                <td class="sub">0h</td>
                <td><button class="btn" onclick="this.closest('tr').remove(); updateTotals();">✕</button></td>
            `;
            tbody.appendChild(tr);
            tr.querySelectorAll('input').forEach(i => i.onchange = updateTotals);
            updateTotals();
        };

        document.getElementById('calc-add-row').onclick = createRow;
        empSelect.onchange = updateTotals;
        window.updateTotals = updateTotals;

        saveBtn.onclick = async () => {
            const rows = tbody.querySelectorAll('tr');
            for (const tr of rows) {
                const h = parseFloat(tr.querySelector('.sub').textContent);
                if (h > 0) {
                    await Storage.add('logs', {
                        employeeId: empSelect.value,
                        date: tr.querySelector('.date').value,
                        timeIn: tr.querySelector('.in').value,
                        timeOut: tr.querySelector('.out').value,
                        hours: h
                    });
                }
            }
            alert('Horas guardadas');
            App.switchView('payroll');
        };
    },

    payroll: () => {
        const employees = Storage.get('employees');
        const logs = Storage.get('logs');
        const payments = Storage.get('payments');

        return `
            <div class="card-container">
                <h3>Cálculo de Planilla Pendiente</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Empleado</th>
                                <th>Horas Pendientes</th>
                                <th>Monto Bruto</th>
                                <th>Neto (Est.)</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${employees.filter(e => e.status === 'Active').map(emp => {
            const totalHrs = logs.filter(l => String(l.employeeId) === String(emp.id)).reduce((s, l) => s + l.hours, 0);
            const paidHrs = payments.filter(p => String(p.employeeId) === String(emp.id)).reduce((s, p) => s + p.hours, 0);
            const pending = Math.max(0, totalHrs - paidHrs);
            if (pending <= 0) return '';
            const gross = pending * emp.hourlyRate;
            const net = emp.applyCCSS ? gross * 0.8933 : gross;
            return `
                                    <tr>
                                        <td>${emp.name}</td>
                                        <td>${pending.toFixed(2)}h</td>
                                        <td>₡${Math.round(gross).toLocaleString()}</td>
                                        <td style="color:var(--success)">₡${Math.round(net).toLocaleString()}</td>
                                        <td><button class="btn btn-primary" onclick="window.processPayment('${emp.id}', ${pending}, ${gross})">Pagar</button></td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="card-container" style="margin-top: 2rem">
                <h3>Historial de Pagos</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Empleado</th>
                                <th>Horas</th>
                                <th>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${payments.slice().reverse().map(p => {
            const emp = employees.find(e => String(e.id) === String(p.employeeId));
            return `
                                    <tr>
                                        <td>${p.date}</td>
                                        <td>${emp ? emp.name : 'Unknown'}</td>
                                        <td>${p.hours}h</td>
                                        <td>₡${p.amount.toLocaleString()}</td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    benefits: () => {
        return `<div class="card-container"><h3>Prestaciones Legales</h3><p>Módulo próximamente habilitado con cálculos de Aguinaldo y Vacaciones.</p></div>`;
    },

    import: () => {
        return `<div class="card-container"><h3>Importar desde Excel</h3><p>Use este módulo para cargar liquidaciones masivas.</p></div>`;
    },

    profile: () => {
        const users = Storage.get('users');
        return `
            <div class="card-container">
                <h3>Gestión de Usuarios</h3>
                <div class="table-container">
                    <table>
                        <thead><tr><th>Nombre</th><th>Usuario</th></tr></thead>
                        <tbody>
                            ${users.map(u => `<tr><td>${u.name}</td><td>${u.username}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
};

window.processPayment = async (empId, hours, amount) => {
    if (confirm(`¿Confirmar pago de ₡${Math.round(amount).toLocaleString()}?`)) {
        await Storage.add('payments', {
            employeeId: empId,
            hours: hours,
            amount: amount,
            date: Storage.getLocalDate()
        });
        App.switchView('payroll');
    }
};

window.deleteEmployee = async (id) => {
    if (confirm('¿Seguro que desea eliminar este empleado?')) {
        await Storage.delete('employees', id);
        App.switchView('employees');
    }
};

// --- Start ---
document.addEventListener('DOMContentLoaded', () => App.init());