<?php
require_once __DIR__ . '/../common/config.php';

if (isset($_GET['logout']) && $_GET['logout'] === '1') {
    unset($_SESSION['admin_id'], $_SESSION['admin_username']);
    header('Location: login.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['ajax_action'] ?? '') === 'admin_login') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($username === '' || $password === '') {
        jsonResponse(false, 'Username and password are required.');
    }

    $stmt = $conn->prepare('SELECT id, username, password FROM admin WHERE username = ? LIMIT 1');
    $stmt->bind_param('s', $username);
    $stmt->execute();
    $admin = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$admin || !password_verify($password, $admin['password'])) {
        jsonResponse(false, 'Invalid admin credentials.');
    }

    $_SESSION['admin_id'] = (int)$admin['id'];
    $_SESSION['admin_username'] = $admin['username'];
    jsonResponse(true, 'Welcome back, ' . $admin['username'], ['redirect' => 'index.php']);
}

if (isAdminLoggedIn()) {
    header('Location: index.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Admin Login — Quick Kart</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
        @keyframes qkDotBounce {
            0%, 80%, 100% { transform: scale(0.45); opacity: 0.35; }
            40% { transform: scale(1); opacity: 1; }
        }
        .qk-dot-1 { animation: qkDotBounce 1.1s infinite ease-in-out both; animation-delay: -0.32s; }
        .qk-dot-2 { animation: qkDotBounce 1.1s infinite ease-in-out both; animation-delay: -0.16s; }
        .qk-dot-3 { animation: qkDotBounce 1.1s infinite ease-in-out both; }
    </style>
</head>
<body class="bg-slate-900 text-slate-900 min-h-screen flex items-center justify-center p-4 select-none overflow-hidden">

<div class="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-7">
    <div class="text-center mb-6">
        <div class="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center mx-auto shadow-md shadow-orange-600/20">
            <i class="fa-solid fa-shield-halved text-xl"></i>
        </div>
        <h1 class="mt-3 text-xl font-extrabold text-slate-900">Quick Kart Admin</h1>
        <p class="mt-1 text-xs text-slate-500">Default credentials: Seraj / seraj123</p>
    </div>

    <div id="adminErrBox" class="hidden mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span id="adminErrText"></span>
    </div>

    <form id="adminLoginForm" class="space-y-4">
        <input type="hidden" name="ajax_action" value="admin_login">
        <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5">Username</label>
            <input type="text" name="username" required placeholder="Seraj"
                class="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
        </div>
        <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <input type="password" name="password" required placeholder="••••••••"
                class="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
        </div>
        <button type="submit" class="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-orange-600 transition flex items-center justify-center gap-2">
            <span>Sign In</span>
            <i class="fa-solid fa-arrow-right text-xs"></i>
        </button>
    </form>

    <div class="mt-5 text-center">
        <a href="../index.php" class="text-xs font-semibold text-slate-500 hover:text-slate-900">
            <i class="fa-solid fa-arrow-left mr-1"></i> Back to Storefront
        </a>
    </div>
</div>

<!-- Square Dotted Loader -->
<div id="qkLoaderModal" class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/50 backdrop-blur-xs">
    <div class="w-28 h-28 rounded-2xl bg-white shadow-2xl flex flex-col items-center justify-center gap-3">
        <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-orange-600 qk-dot-1"></span>
            <span class="w-2.5 h-2.5 rounded-full bg-orange-600 qk-dot-2"></span>
            <span class="w-2.5 h-2.5 rounded-full bg-orange-600 qk-dot-3"></span>
        </div>
        <span class="text-[11px] font-semibold text-slate-600">Signing in...</span>
    </div>
</div>

<script>
document.addEventListener('contextmenu', e => e.preventDefault());
document.getElementById('adminLoginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const loader = document.getElementById('qkLoaderModal');
    const errBox = document.getElementById('adminErrBox');
    errBox.classList.add('hidden');
    loader.classList.remove('hidden');
    loader.classList.add('flex');

    try {
        const res = await fetch('login.php', { method: 'POST', body: new FormData(this) });
        const data = await res.json();
        loader.classList.add('hidden');
        loader.classList.remove('flex');
        if (data.success) {
            window.location.href = data.redirect || 'index.php';
        } else {
            document.getElementById('adminErrText').textContent = data.message;
            errBox.classList.remove('hidden');
        }
    } catch {
        loader.classList.add('hidden');
        loader.classList.remove('flex');
        document.getElementById('adminErrText').textContent = 'Connection failed.';
        errBox.classList.remove('hidden');
    }
});
</script>
</body>
</html>
