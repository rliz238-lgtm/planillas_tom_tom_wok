renderLogin() {
    // Reemplaza el contenido de renderLogin con esto:
    document.body.innerHTML = `
        <div class="login-screen" id="login-view">
            <div class="login-card">
                <img src="img/logo_tom_tom_wok_white.png" alt="Tom Tom Wok Logo" style="width: 200px; margin-bottom: 2rem;">
                <h1>Tom Tom Wok</h1>
                <p style="color: var(--text-muted); margin-bottom: 1rem;">Sistema de Control de Planillas</p>
                
                <div id="login-error" class="login-error" style="display:none">
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
            </div>
        </div>
    `;

    const form = document.getElementById('login-form');
    const error = document.getElementById('login-error');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value;
        const pass = document.getElementById('password').value;

        // Llama a la capa de autenticación que conecta con PostgreSQL
        if (await Auth.login(user, pass)) {
            location.reload(); // Recarga para entrar al Dashboard
        } else {
            error.style.display = 'block';
            form.reset();
        }
    };
}