<?php
require_once __DIR__ . '/../common/config.php';

if (!isAdminLoggedIn()) {
    header('Location: login.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['ajax_action'] ?? '') === 'update_status') {
    $oid = (int)($_POST['order_id'] ?? 0);
    $status = $_POST['status'] ?? '';
    if (!in_array($status, ['Placed', 'Dispatched', 'Delivered', 'Cancelled'], true)) {
        jsonResponse(false, 'Invalid status selected.');
    }
    $stmt = $conn->prepare('UPDATE orders SET status = ? WHERE id = ?');
    $stmt->bind_param('si', $status, $oid);
    $stmt->execute();
    $stmt->close();
    jsonResponse(true, 'Order #' . $oid . ' updated to ' . $status . '.');
}

$oid = (int)($_GET['id'] ?? 0);
$stmt = $conn->prepare('SELECT o.*, u.email AS user_email, u.name AS account_name FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ? LIMIT 1');
$stmt->bind_param('i', $oid);
$stmt->execute();
$order = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$order) {
    header('Location: order.php');
    exit;
}

$itemStmt = $conn->prepare('SELECT oi.*, p.name AS product_name, p.image AS product_image FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?');
$itemStmt->bind_param('i', $oid);
$itemStmt->execute();
$items = $itemStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$itemStmt->close();

$adminTitle = 'Order #' . $oid;
require_once __DIR__ . '/common/header.php';
require_once __DIR__ . '/common/sidebar.php';
?>

<main class="max-w-4xl mx-auto px-4 py-5 space-y-5">
    <div class="flex items-center gap-3">
        <a href="order.php" class="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50">
            <i class="fa-solid fa-arrow-left text-xs"></i>
        </a>
        <div>
            <h1 class="text-xl font-extrabold text-slate-900 font-mono">Order #<?= $oid ?></h1>
            <p class="text-xs text-slate-500">Placed on <?= date('d M Y, h:i A', strtotime($order['created_at'])) ?></p>
        </div>
    </div>

    <div class="grid md:grid-cols-2 gap-4">
        <!-- Customer Info -->
        <div class="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-2">
            <h2 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Customer &amp; Delivery</h2>
            <p class="text-sm font-bold text-slate-900"><?= e($order['name'] ?: $order['account_name']) ?></p>
            <p class="text-xs text-slate-600"><i class="fa-solid fa-phone mr-1.5 text-slate-400"></i><?= e($order['phone']) ?></p>
            <p class="text-xs text-slate-600"><i class="fa-solid fa-envelope mr-1.5 text-slate-400"></i><?= e($order['user_email'] ?? '') ?></p>
            <p class="text-xs text-slate-600 leading-relaxed pt-1"><i class="fa-solid fa-location-dot mr-1.5 text-slate-400"></i><?= e($order['address']) ?></p>
        </div>

        <!-- Status Update Form -->
        <div class="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3">
            <h2 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Update Status</h2>
            <form id="statusForm" class="space-y-3">
                <input type="hidden" name="ajax_action" value="update_status">
                <input type="hidden" name="order_id" value="<?= $oid ?>">
                <select name="status" class="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:border-orange-500 focus:outline-none">
                    <?php foreach (['Placed', 'Dispatched', 'Delivered', 'Cancelled'] as $st): ?>
                    <option value="<?= $st ?>" <?= $order['status'] === $st ? 'selected' : '' ?>><?= $st ?></option>
                    <?php endforeach; ?>
                </select>
                <button type="submit" class="w-full h-11 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition">
                    Save Order Status
                </button>
            </form>
        </div>
    </div>

    <!-- Ordered Items -->
    <div class="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 class="text-sm font-bold text-slate-900">Ordered Items</h2>
            <span class="text-sm font-extrabold text-slate-900 font-mono tabular-nums"><?= formatINR($order['total_amount']) ?></span>
        </div>
        <div class="divide-y divide-slate-100">
            <?php foreach ($items as $it): ?>
            <div class="p-4 flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                        <img src="../<?= e($it['product_image'] ?: 'images/hero.jpg') ?>" alt="<?= e($it['product_name'] ?? 'Item') ?>" class="w-full h-full object-cover">
                    </div>
                    <div class="min-w-0">
                        <p class="text-sm font-bold text-slate-900 truncate"><?= e($it['product_name'] ?? 'Product') ?></p>
                        <p class="text-xs text-slate-500 font-mono tabular-nums"><?= formatINR($it['price']) ?> × <?= (int)$it['quantity'] ?></p>
                    </div>
                </div>
                <span class="text-sm font-extrabold text-slate-900 font-mono tabular-nums shrink-0">
                    <?= formatINR($it['price'] * $it['quantity']) ?>
                </span>
            </div>
            <?php endforeach; ?>
        </div>
    </div>
</main>

<script>
document.getElementById('statusForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    showLoader('Updating status...');
    try {
        const res = await fetch('order_detail.php?id=<?= $oid ?>', { method: 'POST', body: new FormData(this) });
        const data = await res.json();
        hideLoader();
        showModal({
            title: data.success ? 'Updated' : 'Error',
            message: data.message,
            type: data.success ? 'success' : 'error'
        });
    } catch {
        hideLoader();
        showModal({ title: 'Error', message: 'Failed to update status.', type: 'error' });
    }
});
</script>

<?php require_once __DIR__ . '/common/bottom.php'; ?>
