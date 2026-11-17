<?php
require_once __DIR__ . '/common/config.php';

if (!isUserLoggedIn()) {
    header('Location: login.php');
    exit;
}

$user = getCurrentUser($conn);
$cart = $_SESSION['cart'] ?? [];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['ajax_action'] ?? '') === 'place_order') {
    if (empty($cart)) {
        jsonResponse(false, 'Your cart is empty.');
    }

    $name = trim($_POST['name'] ?? '');
    $phone = trim($_POST['phone'] ?? '');
    $address = trim($_POST['address'] ?? '');

    if (mb_strlen($name) < 2) jsonResponse(false, 'Please enter recipient name.');
    if (!preg_match('/^[0-9+\-\s]{7,18}$/', $phone)) jsonResponse(false, 'Please enter a valid phone number.');
    if (mb_strlen($address) < 8) jsonResponse(false, 'Please enter your complete delivery address.');

    $ids = array_map('intval', array_keys($cart));
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $types = str_repeat('i', count($ids));
    $stmt = $conn->prepare("SELECT id, name, price, stock FROM products WHERE id IN ($placeholders)");
    $stmt->bind_param($types, ...$ids);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    if (empty($rows)) {
        jsonResponse(false, 'No valid products found in cart.');
    }

    $total = 0.0;
    $orderLines = [];
    foreach ($rows as $row) {
        $pid = (int)$row['id'];
        $qty = min((int)$row['stock'], max(1, (int)($cart[$pid] ?? 1)));
        if ((int)$row['stock'] < $qty || $qty <= 0) {
            jsonResponse(false, $row['name'] . ' has insufficient stock.');
        }
        $total += (float)$row['price'] * $qty;
        $orderLines[] = [
            'product_id' => $pid,
            'quantity' => $qty,
            'price' => (float)$row['price'],
        ];
    }

    $conn->begin_transaction();
    try {
        $uid = (int)$_SESSION['user_id'];
        $ordStmt = $conn->prepare("INSERT INTO orders (user_id, name, phone, address, total_amount, status) VALUES (?, ?, ?, ?, ?, 'Placed')");
        $ordStmt->bind_param('isssd', $uid, $name, $phone, $address, $total);
        $ordStmt->execute();
        $orderId = (int)$ordStmt->insert_id;
        $ordStmt->close();

        $itemStmt = $conn->prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
        $stockStmt = $conn->prepare('UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id = ?');
        foreach ($orderLines as $line) {
            $itemStmt->bind_param('iiid', $orderId, $line['product_id'], $line['quantity'], $line['price']);
            $itemStmt->execute();
            $stockStmt->bind_param('ii', $line['quantity'], $line['product_id']);
            $stockStmt->execute();
        }
        $itemStmt->close();
        $stockStmt->close();

        // Save address on user profile if empty
        $updUser = $conn->prepare('UPDATE users SET address = ? WHERE id = ? AND (address IS NULL OR address = "")');
        $updUser->bind_param('si', $address, $uid);
        $updUser->execute();
        $updUser->close();

        $conn->commit();
        unset($_SESSION['cart']);
        jsonResponse(true, 'Order #' . $orderId . ' placed successfully!', ['redirect' => 'order.php']);
    } catch (Throwable $e) {
        $conn->rollback();
        jsonResponse(false, 'Could not place order. Please try again.');
    }
}

if (empty($cart)) {
    header('Location: cart.php');
    exit;
}

// Compute summary for display
$ids = array_map('intval', array_keys($cart));
$placeholders = implode(',', array_fill(0, count($ids), '?'));
$types = str_repeat('i', count($ids));
$stmt = $conn->prepare("SELECT id, name, price FROM products WHERE id IN ($placeholders)");
$stmt->bind_param($types, ...$ids);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$totalAmount = 0.0;
$totalQty = 0;
foreach ($rows as $r) {
    $q = max(1, (int)($cart[$r['id']] ?? 1));
    $totalAmount += (float)$r['price'] * $q;
    $totalQty += $q;
}

$pageTitle = 'Checkout';
$showSearch = false;
require_once __DIR__ . '/common/header.php';
require_once __DIR__ . '/common/sidebar.php';
?>

<main class="max-w-2xl mx-auto px-4 py-6 space-y-5">
    <div class="flex items-center gap-3">
        <a href="cart.php" class="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50">
            <i class="fa-solid fa-arrow-left text-xs"></i>
        </a>
        <div>
            <h1 class="text-xl font-extrabold text-slate-900">Checkout</h1>
            <p class="text-xs text-slate-500"><?= $totalQty ?> items · Total <?= formatINR($totalAmount) ?></p>
        </div>
    </div>

    <form id="checkoutForm" class="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
        <input type="hidden" name="ajax_action" value="place_order">

        <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
            <input type="text" name="name" required value="<?= e($user['name'] ?? '') ?>" placeholder="Recipient full name"
                class="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
        </div>

        <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number</label>
            <input type="tel" name="phone" required value="<?= e($user['phone'] ?? '') ?>" placeholder="10-digit mobile number"
                class="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
        </div>

        <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5">Delivery Address</label>
            <textarea name="address" rows="3" required placeholder="House/Flat No, Street, Landmark, City, PIN Code"
                class="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none"><?= e($user['address'] ?? '') ?></textarea>
        </div>

        <div class="pt-2">
            <label class="block text-xs font-semibold text-slate-700 mb-2">Payment Method</label>
            <div class="p-4 rounded-2xl border-2 border-orange-500 bg-orange-50/50 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <span class="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center">
                        <i class="fa-solid fa-money-bill-wave"></i>
                    </span>
                    <div>
                        <p class="text-sm font-bold text-slate-900">Cash on Delivery (COD)</p>
                        <p class="text-xs text-slate-500">Pay <?= formatINR($totalAmount) ?> when your order arrives</p>
                    </div>
                </div>
                <i class="fa-solid fa-circle-check text-orange-600 text-lg"></i>
            </div>
        </div>

        <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span class="text-sm font-semibold text-slate-600">Total Amount</span>
            <span class="text-xl font-extrabold text-slate-900 font-mono tabular-nums"><?= formatINR($totalAmount) ?></span>
        </div>

        <button type="submit" class="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-orange-600 active:scale-[0.99] transition flex items-center justify-center gap-2">
            <i class="fa-solid fa-check"></i>
            <span>Confirm COD Order</span>
        </button>
    </form>
</main>

<script>
document.getElementById('checkoutForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    showLoader('Placing order...');
    try {
        const res = await fetch('checkout.php', {
            method: 'POST',
            body: new FormData(this)
        });
        const data = await res.json();
        hideLoader();
        if (data.success) {
            window.location.href = data.redirect || 'order.php';
        } else {
            showModal({ title: 'Checkout Error', message: data.message, type: 'error' });
        }
    } catch {
        hideLoader();
        showModal({ title: 'Error', message: 'Failed to place order.', type: 'error' });
    }
});
</script>

<?php require_once __DIR__ . '/common/bottom.php'; ?>
