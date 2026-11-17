<?php
require_once __DIR__ . '/../common/config.php';

if (!isAdminLoggedIn()) {
    header('Location: login.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['ajax_action'])) {
    $action = $_POST['ajax_action'];
    $uid = (int)($_POST['user_id'] ?? 0);

    if ($action === 'toggle_block') {
        $status = ($_POST['status'] ?? 'active') === 'blocked' ? 'blocked' : 'active';
        $stmt = $conn->prepare('UPDATE users SET status = ? WHERE id = ?');
        $stmt->bind_param('si', $status, $uid);
        $stmt->execute();
        $stmt->close();
        jsonResponse(true, 'User status updated.');
    }

    if ($action === 'delete_user') {
        $stmt = $conn->prepare('DELETE FROM users WHERE id = ?');
        $stmt->bind_param('i', $uid);
        $stmt->execute();
        $stmt->close();
        jsonResponse(true, 'User removed.');
    }

    jsonResponse(false, 'Unknown action.');
}

$users = $conn->query('SELECT id, name, phone, email, status, created_at FROM users ORDER BY id DESC')->fetch_all(MYSQLI_ASSOC);

$adminTitle = 'Users';
require_once __DIR__ . '/common/header.php';
require_once __DIR__ . '/common/sidebar.php';
?>

<main class="max-w-5xl mx-auto px-4 py-5 space-y-5">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-xl font-extrabold text-slate-900">Registered Users</h1>
            <p class="text-xs text-slate-500">Manage customer accounts &amp; access</p>
        </div>
        <span class="text-xs font-semibold text-slate-500 tabular-nums"><?= count($users) ?> users</span>
    </div>

    <div class="space-y-3">
        <?php foreach ($users as $u):
            $isBlocked = ($u['status'] ?? 'active') === 'blocked';
        ?>
        <div class="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="min-w-0">
                <div class="flex items-center gap-2">
                    <h3 class="text-sm font-bold text-slate-900 truncate"><?= e($u['name']) ?></h3>
                    <span class="text-[11px] font-semibold <?= $isBlocked ? 'text-rose-600' : 'text-emerald-700' ?>">
                        · <?= $isBlocked ? 'Blocked' : 'Active' ?>
                    </span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5"><?= e($u['email']) ?> · <?= e($u['phone']) ?></p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <button type="button" onclick="toggleBlockUser(<?= (int)$u['id'] ?>, '<?= $isBlocked ? 'active' : 'blocked' ?>')"
                    class="px-3.5 py-2 rounded-xl text-xs font-semibold <?= $isBlocked ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100' ?>">
                    <?= $isBlocked ? 'Unblock' : 'Block' ?>
                </button>
                <button type="button" onclick="deleteUser(<?= (int)$u['id'] ?>)"
                    class="px-3.5 py-2 rounded-xl bg-rose-50 text-rose-600 text-xs font-semibold hover:bg-rose-100">
                    Delete
                </button>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
</main>

<script>
async function toggleBlockUser(uid, nextStatus) {
    showLoader('Updating...');
    const fd = new FormData();
    fd.append('ajax_action', 'toggle_block');
    fd.append('user_id', uid);
    fd.append('status', nextStatus);
    const res = await fetch('user.php', { method: 'POST', body: fd });
    const data = await res.json();
    hideLoader();
    if (data.success) window.location.reload();
}

function deleteUser(uid) {
    showModal({
        title: 'Delete User',
        message: 'This will permanently delete the user and their orders. Continue?',
        type: 'error',
        confirmText: 'Delete',
        onConfirm: async () => {
            showLoader('Deleting...');
            const fd = new FormData();
            fd.append('ajax_action', 'delete_user');
            fd.append('user_id', uid);
            const res = await fetch('user.php', { method: 'POST', body: fd });
            const data = await res.json();
            hideLoader();
            if (data.success) window.location.reload();
        }
    });
}
</script>

<?php require_once __DIR__ . '/common/bottom.php'; ?>
