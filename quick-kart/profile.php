<?php
require_once __DIR__ . '/common/config.php';

if (isset($_GET['logout']) && $_GET['logout'] === '1') {
    unset($_SESSION['user_id'], $_SESSION['user_name']);
    header('Location: login.php');
    exit;
}

if (!isUserLoggedIn()) {
    header('Location: login.php');
    exit;
}

$uid = (int)$_SESSION['user_id'];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['ajax_action'])) {
    $action = $_POST['ajax_action'];

    if ($action === 'update_profile') {
        $name = trim($_POST['name'] ?? '');
        $phone = trim($_POST['phone'] ?? '');
        $email = trim($_POST['email'] ?? '');
        $address = trim($_POST['address'] ?? '');

        if (mb_strlen($name) < 2) jsonResponse(false, 'Please enter a valid name.');
        if (!preg_match('/^[0-9+\-\s]{7,18}$/', $phone)) jsonResponse(false, 'Please enter a valid phone number.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonResponse(false, 'Please enter a valid email.');

        $chk = $conn->prepare('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1');
        $chk->bind_param('si', $email, $uid);
        $chk->execute();
        if ($chk->get_result()->num_rows > 0) {
            $chk->close();
            jsonResponse(false, 'Email is already used by another account.');
        }
        $chk->close();

        $stmt = $conn->prepare('UPDATE users SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?');
        $stmt->bind_param('ssssi', $name, $phone, $email, $address, $uid);
        $stmt->execute();
        $stmt->close();
        $_SESSION['user_name'] = $name;
        jsonResponse(true, 'Profile updated successfully.');
    }

    if ($action === 'change_password') {
        $currentPass = $_POST['current_password'] ?? '';
        $newPass = $_POST['new_password'] ?? '';

        if (strlen($newPass) < 6) {
            jsonResponse(false, 'New password must be at least 6 characters.');
        }

        $stmt = $conn->prepare('SELECT password FROM users WHERE id = ? LIMIT 1');
        $stmt->bind_param('i', $uid);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row || !password_verify($currentPass, $row['password'])) {
            jsonResponse(false, 'Current password is incorrect.');
        }

        $hashed = password_hash($newPass, PASSWORD_DEFAULT);
        $upd = $conn->prepare('UPDATE users SET password = ? WHERE id = ?');
        $upd->bind_param('si', $hashed, $uid);
        $upd->execute();
        $upd->close();
        jsonResponse(true, 'Password changed successfully.');
    }

    jsonResponse(false, 'Unsupported request.');
}

$user = getCurrentUser($conn);
$pageTitle = 'My Profile';
$showSearch = false;
require_once __DIR__ . '/common/header.php';
require_once __DIR__ . '/common/sidebar.php';
?>

<main class="max-w-2xl mx-auto px-4 py-6 space-y-5">
    <div class="bg-white rounded-3xl border border-slate-200 p-6 flex items-center justify-between gap-4">
        <div class="flex items-center gap-4 min-w-0">
            <div class="w-14 h-14 rounded-2xl bg-orange-600 text-white flex items-center justify-center text-xl font-extrabold shrink-0">
                <?= strtoupper(substr($user['name'] ?? 'U', 0, 1)) ?>
            </div>
            <div class="min-w-0">
                <h1 class="text-lg font-extrabold text-slate-900 truncate"><?= e($user['name'] ?? '') ?></h1>
                <p class="text-xs text-slate-500 truncate"><?= e($user['email'] ?? '') ?></p>
            </div>
        </div>
        <a href="order.php" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold hover:bg-slate-200 whitespace-nowrap">
            My Orders
        </a>
    </div>

    <!-- Edit Profile Form -->
    <form id="profileForm" class="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
        <input type="hidden" name="ajax_action" value="update_profile">
        <h2 class="text-base font-bold text-slate-900">Account Details</h2>

        <div class="grid sm:grid-cols-2 gap-4">
            <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
                <input type="text" name="name" required value="<?= e($user['name'] ?? '') ?>"
                    class="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
            </div>
            <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5">Phone Number</label>
                <input type="tel" name="phone" required value="<?= e($user['phone'] ?? '') ?>"
                    class="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
            </div>
        </div>

        <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Email Address</label>
            <input type="email" name="email" required value="<?= e($user['email'] ?? '') ?>"
                class="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
        </div>

        <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Saved Address</label>
            <textarea name="address" rows="3" placeholder="Add your default delivery address"
                class="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none"><?= e($user['address'] ?? '') ?></textarea>
        </div>

        <button type="submit" class="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition">
            Save Profile Changes
        </button>
    </form>

    <!-- Change Password Form -->
    <form id="passwordForm" class="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
        <input type="hidden" name="ajax_action" value="change_password">
        <h2 class="text-base font-bold text-slate-900">Change Password</h2>

        <div class="grid sm:grid-cols-2 gap-4">
            <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5">Current Password</label>
                <input type="password" name="current_password" required placeholder="••••••••"
                    class="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
            </div>
            <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5">New Password</label>
                <input type="password" name="new_password" required minlength="6" placeholder="Min. 6 characters"
                    class="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
            </div>
        </div>

        <button type="submit" class="w-full h-11 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition">
            Update Password
        </button>
    </form>

    <a href="profile.php?logout=1" class="w-full h-11 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold flex items-center justify-center gap-2 hover:bg-rose-100 transition">
        <i class="fa-solid fa-right-from-bracket"></i>
        <span>Logout</span>
    </a>
</main>

<script>
async function submitProfileAjax(form, resetOnSuccess = false) {
    showLoader('Saving...');
    try {
        const res = await fetch('profile.php', { method: 'POST', body: new FormData(form) });
        const data = await res.json();
        hideLoader();
        showModal({
            title: data.success ? 'Success' : 'Error',
            message: data.message,
            type: data.success ? 'success' : 'error'
        });
        if (data.success && resetOnSuccess) form.reset();
    } catch {
        hideLoader();
        showModal({ title: 'Error', message: 'Network error.', type: 'error' });
    }
}

document.getElementById('profileForm').addEventListener('submit', e => {
    e.preventDefault();
    submitProfileAjax(e.target, false);
});

document.getElementById('passwordForm').addEventListener('submit', e => {
    e.preventDefault();
    submitProfileAjax(e.target, true);
});
</script>

<?php require_once __DIR__ . '/common/bottom.php'; ?>
