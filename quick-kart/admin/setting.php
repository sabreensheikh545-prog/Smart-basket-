<?php
require_once __DIR__ . '/../common/config.php';

if (!isAdminLoggedIn()) {
    header('Location: login.php');
    exit;
}

$aid = (int)$_SESSION['admin_id'];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['ajax_action'] ?? '') === 'update_admin') {
    $username = trim($_POST['username'] ?? '');
    $newPass = $_POST['new_password'] ?? '';

    if (mb_strlen($username) < 3) {
        jsonResponse(false, 'Username must be at least 3 characters.');
    }

    if ($newPass !== '') {
        if (strlen($newPass) < 6) {
            jsonResponse(false, 'New password must be at least 6 characters.');
        }
        $hashed = password_hash($newPass, PASSWORD_DEFAULT);
        $stmt = $conn->prepare('UPDATE admin SET username = ?, password = ? WHERE id = ?');
        $stmt->bind_param('ssi', $username, $hashed, $aid);
    } else {
        $stmt = $conn->prepare('UPDATE admin SET username = ? WHERE id = ?');
        $stmt->bind_param('si', $username, $aid);
    }
    $stmt->execute();
    $stmt->close();
    $_SESSION['admin_username'] = $username;
    jsonResponse(true, 'Admin settings updated successfully.');
}

$stmt = $conn->prepare('SELECT username FROM admin WHERE id = ? LIMIT 1');
$stmt->bind_param('i', $aid);
$stmt->execute();
$adminRow = $stmt->get_result()->fetch_assoc();
$stmt->close();

$adminTitle = 'Settings';
require_once __DIR__ . '/common/header.php';
require_once __DIR__ . '/common/sidebar.php';
?>

<main class="max-w-lg mx-auto px-4 py-6 space-y-5">
    <div>
        <h1 class="text-xl font-extrabold text-slate-900">Admin Settings</h1>
        <p class="text-xs text-slate-500">Update administrator username or password</p>
    </div>

    <form id="adminSettingsForm" class="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
        <input type="hidden" name="ajax_action" value="update_admin">
        <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5">Admin Username</label>
            <input type="text" name="username" required value="<?= e($adminRow['username'] ?? 'admin') ?>"
                class="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
        </div>
        <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5">New Password (leave blank to keep current)</label>
            <input type="password" name="new_password" minlength="6" placeholder="Min. 6 characters"
                class="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
        </div>
        <button type="submit" class="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-orange-600 transition">
            Save Changes
        </button>
    </form>
</main>

<script>
document.getElementById('adminSettingsForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    showLoader('Updating...');
    try {
        const res = await fetch('setting.php', { method: 'POST', body: new FormData(this) });
        const data = await res.json();
        hideLoader();
        showModal({
            title: data.success ? 'Saved' : 'Error',
            message: data.message,
            type: data.success ? 'success' : 'error'
        });
    } catch {
        hideLoader();
        showModal({ title: 'Error', message: 'Failed to update settings.', type: 'error' });
    }
});
</script>

<?php require_once __DIR__ . '/common/bottom.php'; ?>
