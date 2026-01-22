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
                fetch('/api/payments').then(r => r.json()),
            ]);

            this.data.employees = results[0];
            this.data.logs = results[1];
            this.data.payments = results[2];

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

            this.data.payments.forEach(p => {
                p.employeeId = String(p.employee_id);
                p.date = p.date.substring(0, 10);
                p.amount = parseFloat(p.amount);
            });

            console.log('Datos sincronizados con éxito');
        } catch (err) {
            console.error('Error al sincronizar datos:', err);
        }
    }
};