<?php
require_once __DIR__ . '/common/config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['ajax_action'])) {
    $action = $_POST['ajax_action'];

    if ($action === 'login') {
        $email = trim($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
            jsonResponse(false, 'Please enter a valid email and password.');
        }

        $stmt = $conn->prepare('SELECT id, name, password, status FROM users WHERE email = ? LIMIT 1');
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $res = $stmt->get_result();
        $user = $res ? $res->fetch_assoc() : null;
        $stmt->close();

        if (!$user || !password_verify($password, $user['password'])) {
            jsonResponse(false, 'Invalid email or password.');
        }
        if ($user['status'] === 'blocked') {
            jsonResponse(false, 'Your account has been suspended. Please contact support.');
        }

        $_SESSION['user_id'] = (int)$user['id'];
        $_SESSION['user_name'] = $user['name'];
        jsonResponse(true, 'Login successful.', ['redirect' => 'index.php']);
    }

    if ($action === 'signup') {
        $name = trim($_POST['name'] ?? '');
        $phone = trim($_POST['phone'] ?? '');
        $email = trim($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';

        if (mb_strlen($name) < 2) {
            jsonResponse(false, 'Please enter your full name.');
        }
        if (!preg_match('/^[0-9+\-\s]{7,18}$/', $phone)) {
            jsonResponse(false, 'Please enter a valid phone number.');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(false, 'Please enter a valid email address.');
        }
        if (strlen($password) < 6) {
            jsonResponse(false, 'Password must be at least 6 characters.');
        }

        $chk = $conn->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $chk->bind_param('s', $email);
        $chk->execute();
        $exists = $chk->get_result()->num_rows > 0;
        $chk->close();

        if ($exists) {
            jsonResponse(false, 'An account with this email already exists.');
        }

        $hashed = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $conn->prepare('INSERT INTO users (name, phone, email, password) VALUES (?, ?, ?, ?)');
        $stmt->bind_param('ssss', $name, $phone, $email, $hashed);
        if ($stmt->execute()) {
            $_SESSION['user_id'] = (int)$stmt->insert_id;
            $_SESSION['user_name'] = $name;
            $stmt->close();
            jsonResponse(true, 'Account created successfully.', ['redirect' => 'index.php']);
        }
        $stmt->close();
        jsonResponse(false, 'Could not create account. Please try again.');
    }

    jsonResponse(false, 'Unsupported request.');
}

if (isUserLoggedIn()) {
    header('Location: index.php');
    exit;
}

$pageTitle = 'Sign In';
$showSearch = false;
require_once __DIR__ . '/common/header.php';
require_once __DIR__ . '/common/sidebar.php';
?>

<main class="max-w-md mx-auto px-4 py-8">
    <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-6 pt-7 pb-5 text-center border-b border-slate-100">
            <div class="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center mx-auto shadow-md shadow-orange-600/20">
                <i class="fa-solid fa-bolt text-xl"></i>
            </div>
            <h1 class="mt-3 text-xl font-extrabold text-slate-900">Welcome to Quick Kart</h1>
            <p class="mt-1 text-xs text-slate-500">Fast doorstep delivery across India with Cash on Delivery</p>

            <!-- Two Tabs: Login & Sign Up -->
            <div class="mt-5 grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
                <button type="button" id="tabLogin" onclick="switchAuthTab('login')"
                    class="py-2 text-xs font-bold rounded-lg bg-white text-slate-900 shadow-xs transition">
                    Login
                </button>
                <button type="button" id="tabSignup" onclick="switchAuthTab('signup')"
                    class="py-2 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition">
                    Sign Up
                </button>
            </div>
        </div>

        <div class="p-6">
            <div id="authErrorBox" class="hidden mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <i class="fa-solid fa-circle-exclamation shrink-0"></i>
                <span id="authErrorText"></span>
            </div>

            <!-- Login Form -->
            <form id="loginForm" class="space-y-4">
                <input type="hidden" name="ajax_action" value="login">
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
                    <div class="relative">
                        <i class="fa-solid fa-envelope text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2"></i>
                        <input type="email" name="email" required placeholder="you@example.com"
                            class="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                    <div class="relative">
                        <i class="fa-solid fa-lock text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2"></i>
                        <input type="password" name="password" required placeholder="Enter your password"
                            class="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
                    </div>
                </div>
                <button type="submit"
                    class="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 active:scale-[0.99] transition flex items-center justify-center gap-2">
                    <span>Sign In</span>
                    <i class="fa-solid fa-arrow-right text-xs"></i>
                </button>
            </form>

            <!-- Sign Up Form -->
            <form id="signupForm" class="hidden space-y-4">
                <input type="hidden" name="ajax_action" value="signup">
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                    <div class="relative">
                        <i class="fa-solid fa-user text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2"></i>
                        <input type="text" name="name" required placeholder="Aarav Sharma"
                            class="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number</label>
                    <div class="relative">
                        <i class="fa-solid fa-phone text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2"></i>
                        <input type="tel" name="phone" required placeholder="9876543210"
                            class="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
                    <div class="relative">
                        <i class="fa-solid fa-envelope text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2"></i>
                        <input type="email" name="email" required placeholder="you@example.com"
                            class="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                    <div class="relative">
                        <i class="fa-solid fa-lock text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2"></i>
                        <input type="password" name="password" required minlength="6" placeholder="Minimum 6 characters"
                            class="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
                    </div>
                </div>
                <button type="submit"
                    class="w-full h-11 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 active:scale-[0.99] transition flex items-center justify-center gap-2">
                    <span>Create Account</span>
                    <i class="fa-solid fa-user-plus text-xs"></i>
                </button>
            </form>
        </div>
    </div>
</main>

<script>
function switchAuthTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    document.getElementById('authErrorBox').classList.add('hidden');

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        tabLogin.className = 'py-2 text-xs font-bold rounded-lg bg-white text-slate-900 shadow-xs transition';
        tabSignup.className = 'py-2 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition';
    } else {
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        tabSignup.className = 'py-2 text-xs font-bold rounded-lg bg-white text-slate-900 shadow-xs transition';
        tabLogin.className = 'py-2 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition';
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const errorBox = document.getElementById('authErrorBox');
    const errorText = document.getElementById('authErrorText');
    errorBox.classList.add('hidden');

    showLoader('Verifying...');
    try {
        const res = await fetch('login.php', {
            method: 'POST',
            body: new FormData(form)
        });
        const data = await res.json();
        hideLoader();
        if (data.success) {
            window.location.href = data.redirect || 'index.php';
        } else {
            errorText.textContent = data.message || 'Authentication failed.';
            errorBox.classList.remove('hidden');
        }
    } catch (err) {
        hideLoader();
        errorText.textContent = 'Network error. Please try again.';
        errorBox.classList.remove('hidden');
    }
}

document.getElementById('loginForm').addEventListener('submit', handleAuthSubmit);
document.getElementById('signupForm').addEventListener('submit', handleAuthSubmit);
</script>

<?php require_once __DIR__ . '/common/bottom.php'; ?>
