<?php
require_once __DIR__ . '/../common/config.php';

if (!isAdminLoggedIn()) {
    header('Location: login.php');
    exit;
}

$totalUsers = (int)$conn->query('SELECT COUNT(*) AS c FROM users')->fetch_assoc()['c'];
$totalOrders = (int)$conn->query('SELECT COUNT(*) AS c FROM orders')->fetch_assoc()['c'];
$revenue = (float)$conn->query("SELECT COALESCE(SUM(total_amount), 0) AS r FROM orders WHERE status != 'Cancelled'")->fetch_assoc()['r'];
$activeProducts = (int)$conn->query('SELECT COUNT(*) AS c FROM products WHERE stock > 0')->fetch_assoc()['c'];
$cancellations = (int)$conn->query("SELECT COUNT(*) AS c FROM orders WHERE status = 'Cancelled'")->fetch_assoc()['c'];
$shipments = (int)$conn->query("SELECT COUNT(*) AS c FROM orders WHERE status IN ('Dispatched', 'Delivered')")->fetch_assoc()['c'];

$recentOrders = $conn->query('SELECT o.id, o.total_amount, o.status, o.created_at, u.name AS user_name FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.id DESC LIMIT 5')->fetch_all(MYSQLI_ASSOC);

$adminTitle = 'Dashboard';
require_once __DIR__ . '/common/header.php';
require_once __DIR__ . '/common/sidebar.php';
?>

<main class="max-w-7xl mx-auto px-4 py-5 space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-xl font-extrabold text-slate-900">Dashboard Overview</h1>
            <p class="text-xs text-slate-500">Store metrics &amp; quick management</p>
        </div>
        <a href="order.php" class="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-orange-600 transition">
            All Orders
        </a>
    </div>

    <!-- Quick Stats Grid (2/3-column responsive) -->
    <section class="grid grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-5">
        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3.5">
            <span class="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <i class="fa-solid fa-users text-lg"></i>
            </span>
            <div class="min-w-0">
                <p class="text-xs font-medium text-slate-500">Total Users</p>
                <p class="text-lg sm:text-xl font-extrabold text-slate-900 font-mono tabular-nums"><?= $totalUsers ?></p>
            </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3.5">
            <span class="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <i class="fa-solid fa-bag-shopping text-lg"></i>
            </span>
            <div class="min-w-0">
                <p class="text-xs font-medium text-slate-500">Orders</p>
                <p class="text-lg sm:text-xl font-extrabold text-slate-900 font-mono tabular-nums"><?= $totalOrders ?></p>
            </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3.5">
            <span class="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <i class="fa-solid fa-indian-rupee-sign text-lg"></i>
            </span>
            <div class="min-w-0">
                <p class="text-xs font-medium text-slate-500">Revenue</p>
                <p class="text-base sm:text-xl font-extrabold text-slate-900 font-mono tabular-nums truncate"><?= formatINR($revenue) ?></p>
            </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3.5">
            <span class="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <i class="fa-solid fa-boxes-stacked text-lg"></i>
            </span>
            <div class="min-w-0">
                <p class="text-xs font-medium text-slate-500">Active Products</p>
                <p class="text-lg sm:text-xl font-extrabold text-slate-900 font-mono tabular-nums"><?= $activeProducts ?></p>
            </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3.5">
            <span class="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <i class="fa-solid fa-circle-xmark text-lg"></i>
            </span>
            <div class="min-w-0">
                <p class="text-xs font-medium text-slate-500">Cancellations</p>
                <p class="text-lg sm:text-xl font-extrabold text-slate-900 font-mono tabular-nums"><?= $cancellations ?></p>
            </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3.5">
            <span class="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <i class="fa-solid fa-truck-fast text-lg"></i>
            </span>
            <div class="min-w-0">
                <p class="text-xs font-medium text-slate-500">Shipments</p>
                <p class="text-lg sm:text-xl font-extrabold text-slate-900 font-mono tabular-nums"><?= $shipments ?></p>
            </div>
        </div>
    </section>

    <!-- Quick Action Buttons -->
    <section>
        <h2 class="text-sm font-bold text-slate-800 mb-3">Quick Actions</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <a href="product.php" class="p-4 rounded-2xl bg-slate-900 text-white hover:bg-orange-600 transition flex items-center gap-3">
                <i class="fa-solid fa-plus-circle text-lg"></i>
                <span class="text-xs font-bold">Add Product</span>
            </a>
            <a href="category.php" class="p-4 rounded-2xl bg-white border border-slate-200 text-slate-800 hover:border-orange-300 transition flex items-center gap-3">
                <i class="fa-solid fa-tags text-orange-600 text-lg"></i>
                <span class="text-xs font-bold">Categories</span>
            </a>
            <a href="user.php" class="p-4 rounded-2xl bg-white border border-slate-200 text-slate-800 hover:border-orange-300 transition flex items-center gap-3">
                <i class="fa-solid fa-user-gear text-blue-600 text-lg"></i>
                <span class="text-xs font-bold">Manage Users</span>
            </a>
            <a href="setting.php" class="p-4 rounded-2xl bg-white border border-slate-200 text-slate-800 hover:border-orange-300 transition flex items-center gap-3">
                <i class="fa-solid fa-sliders text-slate-600 text-lg"></i>
                <span class="text-xs font-bold">Settings</span>
            </a>
        </div>
    </section>

    <!-- Recent Orders Snapshot -->
    <section class="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 class="text-sm font-bold text-slate-900">Recent Orders</h2>
            <a href="order.php" class="text-xs font-semibold text-orange-600">View all</a>
        </div>
        <div class="divide-y divide-slate-100">
            <?php if (empty($recentOrders)): ?>
                <p class="p-6 text-center text-xs text-slate-500">No orders placed yet.</p>
            <?php else: ?>
                <?php foreach ($recentOrders as $ord): ?>
                <a href="order_detail.php?id=<?= (int)$ord['id'] ?>" class="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition">
                    <div>
                        <p class="text-sm font-bold text-slate-900">#<?= (int)$ord['id'] ?> · <?= e($ord['user_name'] ?? 'Customer') ?></p>
                        <p class="text-xs text-slate-500 mt-0.5"><?= date('d M Y, h:i A', strtotime($ord['created_at'])) ?></p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-extrabold text-slate-900 font-mono tabular-nums"><?= formatINR($ord['total_amount']) ?></p>
                        <p class="text-[11px] font-semibold text-orange-600"><?= e($ord['status']) ?></p>
                    </div>
                </a>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </section>
</main>

<?php require_once __DIR__ . '/common/bottom.php'; ?>
