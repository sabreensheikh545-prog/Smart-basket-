<?php
require_once __DIR__ . '/common/config.php';

if (!isUserLoggedIn()) {
    header('Location: login.php');
    exit;
}

$uid = (int)$_SESSION['user_id'];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['ajax_action'] ?? '') === 'cancel_order') {
    $oid = (int)($_POST['order_id'] ?? 0);
    $stmt = $conn->prepare("UPDATE orders SET status = 'Cancelled' WHERE id = ? AND user_id = ? AND status = 'Placed'");
    $stmt->bind_param('ii', $oid, $uid);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();
    if ($affected > 0) {
        jsonResponse(true, 'Order #' . $oid . ' has been cancelled.');
    }
    jsonResponse(false, 'Only newly placed orders can be cancelled.');
}

// Fetch user orders + items
$ordStmt = $conn->prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC');
$ordStmt->bind_param('i', $uid);
$ordStmt->execute();
$ordersRaw = $ordStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$ordStmt->close();

$activeOrders = [];
$historyOrders = [];

$itemStmt = $conn->prepare('SELECT oi.*, p.name AS product_name, p.image AS product_image FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?');
foreach ($ordersRaw as $ord) {
    $oid = (int)$ord['id'];
    $itemStmt->bind_param('i', $oid);
    $itemStmt->execute();
    $ord['items'] = $itemStmt->get_result()->fetch_all(MYSQLI_ASSOC);

    if ($ord['status'] === 'Placed' || $ord['status'] === 'Dispatched') {
        $activeOrders[] = $ord;
    } else {
        $historyOrders[] = $ord;
    }
}
$itemStmt->close();

function renderOrderCard(array $ord): void {
    $firstItem = $ord['items'][0] ?? null;
    $extraCount = max(0, count($ord['items']) - 1);
    $status = $ord['status'];
    $stage = 1;
    if ($status === 'Dispatched') $stage = 2;
    if ($status === 'Delivered') $stage = 3;
    $isCancelled = $status === 'Cancelled';
    $oid = (int)$ord['id'];
    ?>
    <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition">
        <div class="p-4 flex items-center gap-3.5">
            <div class="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                <img src="<?= e($firstItem['product_image'] ?? 'images/hero.jpg') ?>" alt="<?= e($firstItem['product_name'] ?? 'Order Item') ?>" class="w-full h-full object-cover">
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-mono font-semibold text-slate-500">Order #<?= $oid ?></span>
                    <span class="text-xs font-semibold inline-flex items-center gap-1 <?= $isCancelled ? 'text-rose-600' : ($stage === 3 ? 'text-emerald-700' : ($stage === 2 ? 'text-blue-700' : 'text-amber-700')) ?>">
                        <i class="fa-solid <?= $isCancelled ? 'fa-circle-xmark' : ($stage === 3 ? 'fa-circle-check' : ($stage === 2 ? 'fa-truck-fast' : 'fa-receipt')) ?>"></i>
                        <span><?= e($status) ?></span>
                    </span>
                </div>
                <h3 class="mt-0.5 text-sm font-bold text-slate-900 truncate">
                    <?= e($firstItem['product_name'] ?? 'Quick Kart Order') ?><?= $extraCount > 0 ? " + $extraCount more" : '' ?>
                </h3>
                <div class="mt-1 flex items-center justify-between">
                    <span class="text-sm font-extrabold text-slate-900 font-mono tabular-nums"><?= formatINR($ord['total_amount']) ?></span>
                    <span class="text-[11px] text-slate-500"><?= date('d M Y', strtotime($ord['created_at'])) ?></span>
                </div>
            </div>
        </div>

        <?php if (!$isCancelled): ?>
        <!-- 3-Stage Horizontal Progress Tracker -->
        <div class="px-5 pt-2 pb-4 border-t border-slate-100 bg-slate-50/50">
            <div class="relative flex items-center justify-between">
                <div class="absolute left-6 right-6 top-4 h-1 bg-slate-200 rounded-full">
                    <div class="h-full bg-orange-600 rounded-full transition-all duration-300"
                        style="width: <?= $stage === 1 ? '0%' : ($stage === 2 ? '50%' : '100%') ?>"></div>
                </div>

                <!-- Stage 1: Placed -->
                <div class="relative z-10 flex flex-col items-center">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs <?= $stage >= 1 ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-200 text-slate-500' ?>">
                        <i class="fa-solid fa-receipt"></i>
                    </div>
                    <span class="mt-1.5 text-[11px] font-bold <?= $stage >= 1 ? 'text-slate-900' : 'text-slate-400' ?>">Placed</span>
                </div>

                <!-- Stage 2: Dispatched -->
                <div class="relative z-10 flex flex-col items-center">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs <?= $stage >= 2 ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-200 text-slate-500' ?>">
                        <i class="fa-solid fa-truck-fast"></i>
                    </div>
                    <span class="mt-1.5 text-[11px] font-bold <?= $stage >= 2 ? 'text-slate-900' : 'text-slate-400' ?>">Dispatched</span>
                </div>

                <!-- Stage 3: Delivered -->
                <div class="relative z-10 flex flex-col items-center">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs <?= $stage >= 3 ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-200 text-slate-500' ?>">
                        <i class="fa-solid fa-box-open"></i>
                    </div>
                    <span class="mt-1.5 text-[11px] font-bold <?= $stage >= 3 ? 'text-emerald-700' : 'text-slate-400' ?>">Delivered</span>
                </div>
            </div>
        </div>
        <?php endif; ?>

        <!-- Expandable Details Trigger -->
        <div class="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between bg-white">
            <button type="button" onclick="toggleOrderDetail(<?= $oid ?>)"
                class="text-xs font-bold text-slate-700 hover:text-orange-600 flex items-center gap-1.5">
                <span>View Details</span>
                <i id="chevron-<?= $oid ?>" class="fa-solid fa-chevron-down text-[10px] transition-transform"></i>
            </button>
            <?php if ($status === 'Placed'): ?>
            <button type="button" onclick="cancelUserOrder(<?= $oid ?>)"
                class="text-xs font-semibold text-rose-600 hover:text-rose-700">
                Cancel Order
            </button>
            <?php endif; ?>
        </div>

        <!-- Expandable Section -->
        <div id="orderDetail-<?= $oid ?>" class="hidden px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50 space-y-3">
            <div class="space-y-2">
                <?php foreach ($ord['items'] as $it): ?>
                <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="font-semibold text-slate-800 truncate"><?= e($it['product_name'] ?? 'Item') ?></span>
                        <span class="text-slate-500 shrink-0">× <?= (int)$it['quantity'] ?></span>
                    </div>
                    <span class="font-mono font-semibold text-slate-800 tabular-nums shrink-0"><?= formatINR($it['price'] * $it['quantity']) ?></span>
                </div>
                <?php endforeach; ?>
            </div>
            <div class="pt-2 border-t border-slate-200/70 text-xs text-slate-600 space-y-1">
                <p><strong class="text-slate-800">Recipient:</strong> <?= e($ord['name']) ?> · <?= e($ord['phone']) ?></p>
                <p><strong class="text-slate-800">Delivery Address:</strong> <?= e($ord['address']) ?></p>
                <p><strong class="text-slate-800">Payment:</strong> Cash on Delivery</p>
            </div>
        </div>
    </div>
    <?php
}

$pageTitle = 'My Orders';
require_once __DIR__ . '/common/header.php';
require_once __DIR__ . '/common/sidebar.php';
?>

<main class="max-w-3xl mx-auto px-4 py-5 space-y-5">
    <div class="flex items-center justify-between">
        <h1 class="text-xl font-extrabold text-slate-900">My Orders</h1>
        <a href="product.php" class="text-xs font-semibold text-orange-600 hover:text-orange-700">Shop More</a>
    </div>

    <!-- Two-Tab Layout -->
    <div class="grid grid-cols-2 p-1 bg-slate-200/70 rounded-xl">
        <button type="button" id="tabActiveBtn" onclick="switchOrderTab('active')"
            class="py-2.5 text-xs font-bold rounded-lg bg-white text-slate-900 shadow-xs transition">
            Active Orders (<?= count($activeOrders) ?>)
        </button>
        <button type="button" id="tabHistoryBtn" onclick="switchOrderTab('history')"
            class="py-2.5 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition">
            Order History (<?= count($historyOrders) ?>)
        </button>
    </div>

    <!-- Active Orders Panel -->
    <section id="activeOrdersPanel" class="space-y-4">
        <?php if (empty($activeOrders)): ?>
        <div class="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <i class="fa-solid fa-box text-3xl text-slate-300"></i>
            <p class="mt-3 text-sm font-semibold text-slate-700">No active orders right now.</p>
        </div>
        <?php else: ?>
            <?php foreach ($activeOrders as $ord) { renderOrderCard($ord); } ?>
        <?php endif; ?>
    </section>

    <!-- Order History Panel -->
    <section id="historyOrdersPanel" class="hidden space-y-4">
        <?php if (empty($historyOrders)): ?>
        <div class="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <i class="fa-solid fa-clock-rotate-left text-3xl text-slate-300"></i>
            <p class="mt-3 text-sm font-semibold text-slate-700">No past orders yet.</p>
        </div>
        <?php else: ?>
            <?php foreach ($historyOrders as $ord) { renderOrderCard($ord); } ?>
        <?php endif; ?>
    </section>
</main>

<script>
function switchOrderTab(tab) {
    const activePanel = document.getElementById('activeOrdersPanel');
    const historyPanel = document.getElementById('historyOrdersPanel');
    const activeBtn = document.getElementById('tabActiveBtn');
    const historyBtn = document.getElementById('tabHistoryBtn');

    if (tab === 'active') {
        activePanel.classList.remove('hidden');
        historyPanel.classList.add('hidden');
        activeBtn.className = 'py-2.5 text-xs font-bold rounded-lg bg-white text-slate-900 shadow-xs transition';
        historyBtn.className = 'py-2.5 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition';
    } else {
        historyPanel.classList.remove('hidden');
        activePanel.classList.add('hidden');
        historyBtn.className = 'py-2.5 text-xs font-bold rounded-lg bg-white text-slate-900 shadow-xs transition';
        activeBtn.className = 'py-2.5 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition';
    }
}

function toggleOrderDetail(oid) {
    const box = document.getElementById('orderDetail-' + oid);
    const chevron = document.getElementById('chevron-' + oid);
    if (!box) return;
    const isHidden = box.classList.contains('hidden');
    box.classList.toggle('hidden', !isHidden);
    if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
}

function cancelUserOrder(oid) {
    showModal({
        title: 'Cancel Order #' + oid,
        message: 'Are you sure you want to cancel this order?',
        type: 'info',
        confirmText: 'Yes, Cancel',
        onConfirm: async () => {
            showLoader('Cancelling...');
            const fd = new FormData();
            fd.append('ajax_action', 'cancel_order');
            fd.append('order_id', oid);
            try {
                const res = await fetch('order.php', { method: 'POST', body: fd });
                const data = await res.json();
                hideLoader();
                if (data.success) {
                    window.location.reload();
                } else {
                    showModal({ title: 'Notice', message: data.message, type: 'error' });
                }
            } catch {
                hideLoader();
                showModal({ title: 'Error', message: 'Network error.', type: 'error' });
            }
        }
    });
}
</script>

<?php require_once __DIR__ . '/common/bottom.php'; ?>
