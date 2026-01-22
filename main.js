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
            const results = await Promise.all([
                fetch('/api/employees').then(r => r.json()),
                fetch('/api/logs').then(r => r.json()),
                // fetch('/api/payments').then(r => r.json()), // Deshabilitado si no hay ruta
            ]);

            this.data.employees = results[0];
            this.data.logs = results[1];
            // this.data.payments = results[2];

            this.data.employees.forEach(e => {
                e.hourlyRate = parseFloat(e.hourly_rate);
                e.startDate = e.start_date ? e.start_date.substring(0, 10) : '';
                e.endDate = e.end_date ? e.end_date.substring(0, 10) : '';
                e.applyCCSS = e.apply_ccss;
            });

            this.data.logs.forEach(l => {
                l.employeeId = String(l.employee_id);
                l.date = l.date.substring(0, 10);
            });

            /*
            this.data.payments.forEach(p => {
                p.employeeId = String(p.employee_id);
                p.date = p.date.substring(0, 10);
                p.amount = parseFloat(p.amount);
            });
            */

            console.log('Datos sincronizados con éxito');
        } catch (err) {
            console.error('Error al sincronizar datos:', err);
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
            import: '📥 Importar Excel'
        };
        document.getElementById('view-title').textContent = titles[viewId] || 'Dashboard';

        // Render View
        const container = document.getElementById('view-container');
        container.innerHTML = `<div class="loading-state">Cargando vista ${viewId}...</div>`;

        // Aquí iría la lógica de renderizado de cada vista
        // Por ahora dejamos el placeholder
        container.innerHTML = `
            <div class="card">
                <h3>Vista: ${titles[viewId] || viewId}</h3>
                <p>Esta sección está lista para mostrar tus datos de PostgreSQL.</p>
            </div>
        `;
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});