/**
 * Planillas Tom Tom Wok - Core Logic
 */

// --- Data Persistence Layer (API version) ---
const Storage = {
    data: {
        employees: [],
        logs: [],
        payments: [],
        settings: [],
        users: []
    },

    async init() {
        try {
            console.log('🔄 Sincronizando datos...');
            const results = await Promise.all([
                fetch('/api/employees').then(r => r.json()),
                fetch('/api/logs').then(r => r.json()),
                fetch('/api/users').then(r => r.json()),
            ]);

            this.data.employees = results[0];
            this.data.logs = results[1];
            this.data.users = results[2];

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

            console.log('✅ Datos sincronizados con éxito');
        } catch (err) {
            console.error('❌ Error al sincronizar datos:', err);
        }
    }
};

// --- View Controller ---
const App = {
    currentUser: null,
    currentView: 'dashboard',

    init() {
        this.bindEvents();
        this.checkSession();
    },

    bindEvents() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.onsubmit = async (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                await this.login(username, password);
            };
        }

        // Sidebar navigation
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.onclick = () => {
                this.switchView(btn.dataset.view);
            };
        });

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => this.logout();
        }
    },

    async login(username, password) {
        const errorEl = document.getElementById('login-error');
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const user = await response.json();
                this.currentUser = user;
                localStorage.setItem('ttw_user', JSON.stringify(user));
                errorEl.style.display = 'none';
                this.showApp();
            } else {
                errorEl.style.display = 'block';
            }
        } catch (err) {
            console.error('Error in login:', err);
            errorEl.style.display = 'block';
            errorEl.textContent = 'Error de conexión con el servidor';
        }
    },

    checkSession() {
        const savedUser = localStorage.getItem('ttw_user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.showApp();
        } else {
            this.showLogin();
        }
    },

    logout() {
        this.currentUser = null;
        localStorage.removeItem('ttw_user');
        this.showLogin();
    },

    showLogin() {
        document.getElementById('login-view').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
    },

    async showApp() {
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('app').style.display = 'flex';

        const displayEl = document.querySelector('.username-display');
        if (displayEl) displayEl.textContent = this.currentUser.name || this.currentUser.username;

        await Storage.init();
        this.switchView(this.currentView);
    },

    switchView(viewId) {
        this.currentView = viewId;

        // Update sidebar
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewId);
        });

        // Update Title
        const titles = {
            dashboard: '📊 Dashboard',
            employees: '👥 Empleados',
            calculator: '🧮 Calculadora',
            payroll: '💰 Planillas',
            import: '📥 Importar Excel',
            users: '⚙️ Gestión de Usuarios'
        };
        document.getElementById('view-title').textContent = titles[viewId] || 'Dashboard';

        // Render View
        this.renderView(viewId);
    },

    renderView(viewId) {
        const container = document.getElementById('view-container');
        container.innerHTML = '';
        const section = document.createElement('div');
        section.className = 'view-animate';

        switch (viewId) {
            case 'dashboard':
                section.innerHTML = this.renderDashboard();
                break;
            case 'employees':
                section.innerHTML = this.renderEmployees();
                this.initEmployeeTable();
                break;
            case 'users':
                section.innerHTML = this.renderUsers();
                this.initUserForm();
                break;
            default:
                section.innerHTML = `
                    <div class="card" style="background: var(--bg-card); padding: 2rem; border-radius: 20px; border: 1px solid var(--border);">
                        <h3>Módulo: ${viewId}</h3>
                        <p>Este módulo se activará próximamente con la integración de PostgreSQL.</p>
                    </div>
                `;
        }
        container.appendChild(section);
    },

    renderDashboard() {
        const totalEmployees = Storage.data.employees.length;
        const activeEmployees = Storage.data.employees.filter(e => e.status === 'Active').length;
        const totalHours = Storage.data.logs.reduce((sum, log) => sum + log.hours, 0);

        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Total Empleados</h3>
                    <div class="value">${totalEmployees}</div>
                    <div class="trend up">Activos: ${activeEmployees}</div>
                </div>
                <div class="stat-card">
                    <h3>Horas Registradas</h3>
                    <div class="value">${totalHours.toFixed(1)}h</h3>
                    <div class="trend">Total acumulado</div>
                </div>
                <div class="stat-card">
                    <h3>Siguiente Pago</h3>
                    <div class="value">-- / --</div>
                    <div class="trend">Próximo viernes</div>
                </div>
            </div>
            
            <div class="card-container" style="margin-top: 2rem;">
                <div class="table-header">
                    <h3>Últimos Registros</h3>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Empleado</th>
                                <th>Horas</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Storage.data.logs.slice(-5).reverse().map(log => {
            const emp = Storage.data.employees.find(e => String(e.id) === log.employeeId);
            return `
                                    <tr>
                                        <td>${log.date}</td>
                                        <td>${emp ? emp.name : 'Desconocido'}</td>
                                        <td>${log.hours}h</td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    renderEmployees() {
        return `
            <div class="card-container">
                <div class="table-header">
                    <h3>Lista de Colaboradores</h3>
                    <button class="btn btn-primary" onclick="alert('Funcionalidad de agregar empleado próximamente')">+ Nuevo Empleado</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Puesto</th>
                                <th>Pago Hora</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Storage.data.employees.map(emp => `
                                <tr>
                                    <td style="font-weight: 500;">${emp.name}</td>
                                    <td>${emp.position}</td>
                                    <td>₡${emp.hourlyRate}</td>
                                    <td><span class="tag ${emp.status === 'Active' ? 'tag-active' : 'tag-inactive'}">${emp.status}</span></td>
                                    <td><button class="btn" style="padding: 5px; background: transparent;"><img src="https://api.iconify.design/lucide:edit-3.svg?color=%2394a3b8" width="18"></button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    renderUsers() {
        return `
            <div class="grid-2">
                <div class="card-container">
                    <h3>Cambiar mi Contraseña</h3>
                    <form id="change-pass-form" style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
                        <div class="form-group">
                            <label>Nueva Contraseña</label>
                            <input type="password" id="new-password" placeholder="••••••••" required>
                        </div>
                        <div class="form-group">
                            <label>Confirmar Contraseña</label>
                            <input type="password" id="confirm-password" placeholder="••••••••" required>
                        </div>
                        <button type="submit" class="btn btn-primary">Actualizar Clave</button>
                        <p id="pass-msg" style="display: none; font-size: 0.9rem; margin-top: 0.5rem;"></p>
                    </form>
                </div>
                
                <div class="card-container">
                    <h3>Crear Nuevo Usuario</h3>
                    <form id="new-user-form" style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
                        <div class="form-group">
                            <label>Nombre Completo</label>
                            <input type="text" id="nu-name" placeholder="Ej: Juan Pérez" required>
                        </div>
                        <div class="form-group">
                            <label>Usuario (Username)</label>
                            <input type="text" id="nu-username" placeholder="juan123" required>
                        </div>
                        <div class="form-group">
                            <label>Contraseña</label>
                            <input type="password" id="nu-password" placeholder="••••••••" required>
                        </div>
                        <button type="submit" class="btn btn-primary" style="background: var(--accent);">Crear Acceso</button>
                        <p id="user-msg" style="display: none; font-size: 0.9rem; margin-top: 0.5rem;"></p>
                    </form>
                </div>
            </div>
            
            <div class="card-container" style="margin-top: 2rem;">
                <h3>Usuarios del Sistema</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Username</th>
                                <th>Fecha Creación</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Storage.data.users.map(u => `
                                <tr>
                                    <td>${u.name || '---'}</td>
                                    <td style="font-weight: 600; color: var(--primary);">${u.username}</td>
                                    <td>${new Date(u.created_at).toLocaleDateString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    initUserForm() {
        const passForm = document.getElementById('change-pass-form');
        const userForm = document.getElementById('new-user-form');

        if (passForm) {
            passForm.onsubmit = async (e) => {
                e.preventDefault();
                const newPass = document.getElementById('new-password').value;
                const confirmPass = document.getElementById('confirm-password').value;
                const msg = document.getElementById('pass-msg');

                if (newPass !== confirmPass) {
                    msg.textContent = '❌ Las contraseñas no coinciden';
                    msg.style.color = 'var(--danger)';
                    msg.style.display = 'block';
                    return;
                }

                try {
                    const res = await fetch('/api/users/change-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: this.currentUser.id, newPassword: newPass })
                    });
                    if (res.ok) {
                        msg.textContent = '✅ Contraseña actualizada correctamente';
                        msg.style.color = 'var(--success)';
                        msg.style.display = 'block';
                        passForm.reset();
                    }
                } catch (err) {
                    console.error(err);
                }
            };
        }

        if (userForm) {
            userForm.onsubmit = async (e) => {
                e.preventDefault();
                const data = {
                    name: document.getElementById('nu-name').value,
                    username: document.getElementById('nu-username').value,
                    password: document.getElementById('nu-password').value
                };
                const msg = document.getElementById('user-msg');

                try {
                    const res = await fetch('/api/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    if (res.ok) {
                        msg.textContent = '✅ Usuario creado con éxito';
                        msg.style.color = 'var(--success)';
                        msg.style.display = 'block';
                        userForm.reset();
                        await Storage.init();
                        this.renderView('users');
                    }
                } catch (err) {
                    console.error(err);
                }
            };
        }
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});