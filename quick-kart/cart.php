<?php
require_once __DIR__ . '/common/config.php';

function buildCartSummary(mysqli $conn): array {
    $cart = $_SESSION['cart'] ?? [];
    if (empty($cart)) {
        return ['items' => [], 'total' => 0.0, 'count' => 0];
    }
    $ids = array_map('intval', array_keys($cart));
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $types = str_repeat('i', count($ids));
    $stmt = $conn->prepare("SELECT id, name, price, stock, image FROM products WHERE id IN ($placeholders)");
    $stmt->bind_param($types, ...$ids);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $items = [];
    $total = 0.0;
    foreach ($rows as $row) {
        $pid = (int)$row['id'];
        $qty = min((int)$row['stock'], max(1, (int)($cart[$pid] ?? 1)));
        if ((int)$row['stock'] <= 0) {
            unset($_SESSION['cart'][$pid]);
            continue;
        }
        $_SESSION['cart'][$pid] = $qty;
        $lineTotal = (float)$row['price'] * $qty;
        $total += $lineTotal;
        $items[] = [
            'id' => $pid,
            'name' => $row['name'],
            'price' => (float)$row['price'],
            'stock' => (int)$row['stock'],
            'image' => $row['image'] ?: 'images/hero.jpg',
            'quantity' => $qty,
            'line_total' => $lineTotal,
        ];
    }
    return ['items' => $items, 'total' => $total, 'count' => getCartCount()];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['ajax_action'])) {
    $action = $_POST['ajax_action'];
    $pid = (int)($_POST['product_id'] ?? 0);

    if ($action === 'update_qty') {
        $qty = (int)($_POST['quantity'] ?? 1);
        if ($qty <= 0) {
            unset($_SESSION['cart'][$pid]);
        } else {
            $stmt = $conn->prepare('SELECT stock FROM products WHERE id = ? LIMIT 1');
            $stmt->bind_param('i', $pid);
            $stmt->execute();
            $prod = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if ($prod) {
                $_SESSION['cart'][$pid] = min((int)$prod['stock'], $qty);
            }
        }
        $summary = buildCartSummary($conn);
        jsonResponse(true, 'Cart updated.', [
            'cart_count' => $summary['count'],
            'total_formatted' => formatINR($summary['total']),
            'items' => $summary['items'],
        ]);
    }

    if ($action === 'remove_item') {
        unset($_SESSION['cart'][$pid]);
        $summary = buildCartSummary($conn);
        jsonResponse(true, 'Item removed from cart.', [
            'cart_count' => $summary['count'],
            'total_formatted' => formatINR($summary['total']),
            'items' => $summary['items'],
        ]);
    }

    jsonResponse(false, 'Unknown action.');
}

$summary = buildCartSummary($conn);
$cartItems = $summary['items'];
$cartTotal = $summary['total'];

$pageTitle = 'My Cart';
require_once __DIR__ . '/common/header.php';
require_once __DIR__ . '/common/sidebar.php';
?>

<main class="max-w-4xl mx-auto px-4 py-5 space-y-5">
    <div class="flex items-center justify-between">
        <h1 class="text-xl font-extrabold text-slate-900">Shopping Cart</h1>
        <span id="cartItemCountLabel" class="text-xs font-semibold text-slate-500 tabular-nums"><?= $summary['count'] ?> items</span>
    </div>

    <div id="cartContainer">
        <?php if (empty($cartItems)): ?>
        <div class="bg-white rounded-3xl border border-slate-200 p-10 text-center">
            <div class="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <i class="fa-solid fa-bag-shopping text-2xl"></i>
            </div>
            <h2 class="mt-4 text-base font-bold text-slate-900">Your cart is empty</h2>
            <p class="mt-1 text-xs text-slate-500">Add essentials from our catalog to get started.</p>
            <a href="product.php" class="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-orange-600 transition">
                <span>Browse Products</span>
                <i class="fa-solid fa-arrow-right text-xs"></i>
            </a>
        </div>
        <?php else: ?>
        <div class="space-y-3" id="cartItemsList">
            <?php foreach ($cartItems as $item): ?>
            <div id="cartRow-<?= $item['id'] ?>" class="bg-white rounded-2xl border border-slate-200/80 p-3.5 flex items-center gap-3.5">
                <a href="product_detail.php?id=<?= $item['id'] ?>" class="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                    <img src="<?= e($item['image']) ?>" alt="<?= e($item['name']) ?>" class="w-full h-full object-cover">
                </a>
                <div class="flex-1 min-w-0">
                    <a href="product_detail.php?id=<?= $item['id'] ?>" class="text-sm font-bold text-slate-900 truncate block hover:text-orange-600">
                        <?= e($item['name']) ?>
                    </a>
                    <p class="text-xs text-slate-500 font-mono tabular-nums mt-0.5"><?= formatINR($item['price']) ?> each</p>
                    <div class="mt-2.5 flex items-center justify-between gap-2">
                        <div class="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50">
                            <button type="button" onclick="updateCartItem(<?= $item['id'] ?>, <?= $item['quantity'] - 1 ?>)"
                                class="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded-l-xl">
                                <i class="fa-solid fa-minus text-[10px]"></i>
                            </button>
                            <span class="w-9 text-center text-xs font-bold text-slate-900 tabular-nums"><?= $item['quantity'] ?></span>
                            <button type="button" onclick="updateCartItem(<?= $item['id'] ?>, <?= min($item['stock'], $item['quantity'] + 1) ?>)"
                                class="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded-r-xl">
                                <i class="fa-solid fa-plus text-[10px]"></i>
                            </button>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-sm font-extrabold text-slate-900 font-mono tabular-nums"><?= formatINR($item['line_total']) ?></span>
                            <button type="button" onclick="removeCartItem(<?= $item['id'] ?>)" aria-label="Remove item"
                                class="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition">
                                <i class="fa-solid fa-trash-can text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <?php endforeach; ?>
        </div>

        <!-- Bottom Total & Checkout -->
        <div class="mt-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div class="flex items-center justify-between text-sm text-slate-600">
                <span>Delivery (Cash on Delivery)</span>
                <span class="font-semibold text-emerald-700">Free</span>
            </div>
            <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span class="text-base font-bold text-slate-900">Total Payable</span>
                <span id="cartTotalValue" class="text-xl font-extrabold text-slate-900 font-mono tabular-nums"><?= formatINR($cartTotal) ?></span>
            </div>
            <a href="checkout.php" class="w-full h-12 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 active:scale-[0.99] transition flex items-center justify-center gap-2">
                <span>Proceed to Checkout</span>
                <i class="fa-solid fa-arrow-right text-xs"></i>
            </a>
        </div>
        <?php endif; ?>
    </div>
</main>

<script>
async function updateCartItem(productId, qty) {
    showLoader('Updating...');
    const fd = new FormData();
    fd.append('ajax_action', qty <= 0 ? 'remove_item' : 'update_qty');
    fd.append('product_id', productId);
    fd.append('quantity', qty);

    try {
        const res = await fetch('cart.php', { method: 'POST', body: fd });
        const data = await res.json();
        hideLoader();
        if (data.success) {
            window.location.reload();
        } else {
            showModal({ title: 'Error', message: data.message, type: 'error' });
        }
    } catch {
        hideLoader();
        showModal({ title: 'Error', message: 'Failed to update cart.', type: 'error' });
    }
}

function removeCartItem(productId) {
    showModal({
        title: 'Remove Item',
        message: 'Remove this product from your shopping cart?',
        type: 'info',
        confirmText: 'Remove',
        onConfirm: () => updateCartItem(productId, 0)
    });
}
</script>

<?php require_once __DIR__ . '/common/bottom.php'; ?>
