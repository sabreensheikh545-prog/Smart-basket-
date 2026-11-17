<?php
require_once __DIR__ . '/../common/config.php';

if (!isAdminLoggedIn()) {
    header('Location: login.php');
    exit;
}

$orders = $conn->query('SELECT o.id, o.total_amount, o.status, o.created_at, o.name AS recipient_name, u.name AS user_name FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.id DESC')->fetch_all(MYSQLI_ASSOC);

$adminTitle = 'Orders';
require_once __DIR__ . '/common/header.php';
require_once __DIR__ . '/common/sidebar.php';
?>

<main class="max-w-6xl mx-auto px-4 py-5 space-y-5">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-xl font-extrabold text-slate-900">Orders</h1>
            <p class="text-xs text-slate-500">Tap any order to inspect items and update delivery status</p>
        </div>
        <span class="text-xs font-semibold text-slate-500 tabular-nums"><?= count($orders) ?> orders</span>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th class="py-3 px-4">Order ID</th>
                        <th class="py-3 px-4">User</th>
                        <th class="py-3 px-4">Amount</th>
                        <th class="py-3 px-4">Status</th>
                        <th class="py-3 px-4">Date</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-sm">
                    <?php if (empty($orders)): ?>
                    <tr>
                        <td colspan="5" class="py-8 text-center text-xs text-slate-500">No orders found.</td>
                    </tr>
                    <?php else: ?>
                        <?php foreach ($orders as $ord):
                            $st = $ord['status'];
                            $stClass = 'text-amber-700';
                            $stIcon = 'fa-receipt';
                            if ($st === 'Dispatched') { $stClass = 'text-blue-700'; $stIcon = 'fa-truck-fast'; }
                            elseif ($st === 'Delivered') { $stClass = 'text-emerald-700'; $stIcon = 'fa-circle-check'; }
                            elseif ($st === 'Cancelled') { $stClass = 'text-rose-600'; $stIcon = 'fa-circle-xmark'; }
                        ?>
                        <tr onclick="window.location.href='order_detail.php?id=<?= (int)$ord['id'] ?>'" class="hover:bg-slate-50 cursor-pointer transition">
                            <td class="py-3.5 px-4 font-mono font-bold text-slate-900 tabular-nums">#<?= (int)$ord['id'] ?></td>
                            <td class="py-3.5 px-4 font-semibold text-slate-800"><?= e($ord['user_name'] ?: $ord['recipient_name']) ?></td>
                            <td class="py-3.5 px-4 font-mono font-bold text-slate-900 tabular-nums"><?= formatINR($ord['total_amount']) ?></td>
                            <td class="py-3.5 px-4 font-semibold text-xs <?= $stClass ?> whitespace-nowrap">
                                <i class="fa-solid <?= $stIcon ?> mr-1"></i><?= e($st) ?>
                            </td>
                            <td class="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap"><?= date('d M Y', strtotime($ord['created_at'])) ?></td>
                        </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</main>

<?php require_once __DIR__ . '/common/bottom.php'; ?>
