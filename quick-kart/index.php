<?php
require_once __DIR__ . '/common/config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['ajax_action'] ?? '') === 'add_to_cart') {
    $pid = (int)($_POST['product_id'] ?? 0);
    $qty = max(1, (int)($_POST['quantity'] ?? 1));

    $stmt = $conn->prepare('SELECT id, name, stock FROM products WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $pid);
    $stmt->execute();
    $prod = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$prod) {
        jsonResponse(false, 'Product not found.');
    }
    if ((int)$prod['stock'] <= 0) {
        jsonResponse(false, 'This item is currently out of stock.');
    }

    if (!isset($_SESSION['cart']) || !is_array($_SESSION['cart'])) {
        $_SESSION['cart'] = [];
    }
    $currentQty = (int)($_SESSION['cart'][$pid] ?? 0);
    $newQty = min((int)$prod['stock'], $currentQty + $qty);
    $_SESSION['cart'][$pid] = $newQty;

    jsonResponse(true, $prod['name'] . ' added to your cart.', ['cart_count' => getCartCount()]);
}

$categories = [];
$catRes = $conn->query('SELECT id, name, image FROM categories ORDER BY id ASC');
if ($catRes) {
    while ($row = $catRes->fetch_assoc()) {
        $categories[] = $row;
    }
}

$products = [];
$prodRes = $conn->query('SELECT p.id, p.cat_id, p.name, p.price, p.stock, p.image, c.name AS cat_name FROM products p LEFT JOIN categories c ON p.cat_id = c.id ORDER BY p.id DESC LIMIT 8');
if ($prodRes) {
    while ($row = $prodRes->fetch_assoc()) {
        $products[] = $row;
    }
}

$pageTitle = 'Home';
require_once __DIR__ . '/common/header.php';
require_once __DIR__ . '/common/sidebar.php';
?>

<main class="max-w-7xl mx-auto px-4 py-5 space-y-7">
    <!-- Hero Showcase -->
    <section class="relative rounded-3xl overflow-hidden bg-slate-900 text-white shadow-sm">
        <div class="grid md:grid-cols-2 items-stretch">
            <div class="p-6 sm:p-10 flex flex-col justify-center">
                <p class="text-xs font-semibold text-orange-400 tracking-wide">Curated Daily Essentials</p>
                <h1 class="mt-2 text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                    Smart tech &amp; everyday carry, delivered fast.
                </h1>
                <p class="mt-3 text-sm text-slate-300 max-w-md leading-relaxed">
                    Shop studio-grade audio, titanium wearables, and commuter gear with instant Cash on Delivery.
                </p>
                <div class="mt-6 flex items-center gap-3">
                    <a href="product.php" class="px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition inline-flex items-center gap-2 whitespace-nowrap">
                        <span>Explore Catalog</span>
                        <i class="fa-solid fa-arrow-right text-xs"></i>
                    </a>
                    <a href="order.php" class="px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/15 transition whitespace-nowrap">
                        Track Orders
                    </a>
                </div>
            </div>
            <div class="h-48 sm:h-64 md:h-auto relative">
                <img src="images/hero.jpg" alt="Quick Kart Featured Essentials" class="w-full h-full object-cover">
            </div>
        </div>
    </section>

    <!-- Top Categories Horizontal Scroll -->
    <section>
        <div class="flex items-center justify-between mb-3.5">
            <h2 class="text-base sm:text-lg font-bold text-slate-900">Top Categories</h2>
            <a href="product.php" class="text-xs font-semibold text-orange-600 hover:text-orange-700 whitespace-nowrap">
                View All <i class="fa-solid fa-chevron-right text-[10px] ml-0.5"></i>
            </a>
        </div>
        <div class="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
            <?php foreach ($categories as $cat): ?>
            <a href="product.php?cat=<?= (int)$cat['id'] ?>"
                class="shrink-0 w-24 sm:w-28 bg-white rounded-2xl border border-slate-200/80 p-3 flex flex-col items-center text-center hover:border-orange-300 hover:shadow-sm transition">
                <div class="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                    <?php if (!empty($cat['image'])): ?>
                        <img src="<?= e($cat['image']) ?>" alt="<?= e($cat['name']) ?>" class="w-full h-full object-cover">
                    <?php else: ?>
                        <i class="fa-solid fa-layer-group text-slate-400"></i>
                    <?php endif; ?>
                </div>
                <span class="mt-2 text-xs font-semibold text-slate-800 truncate w-full"><?= e($cat['name']) ?></span>
            </a>
            <?php endforeach; ?>
        </div>
    </section>

    <!-- Featured Products Grid -->
    <section>
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-base sm:text-lg font-bold text-slate-900">Featured Products</h2>
            <span class="text-xs text-slate-500">Cash on Delivery available</span>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            <?php foreach ($products as $prod): ?>
            <div class="bg-white rounded-2xl border border-slate-200/80 overflow-hidden flex flex-col hover:shadow-md transition">
                <a href="product_detail.php?id=<?= (int)$prod['id'] ?>" class="block aspect-square bg-slate-100 overflow-hidden">
                    <img src="<?= e($prod['image'] ?: 'images/hero.jpg') ?>" alt="<?= e($prod['name']) ?>"
                        class="w-full h-full object-cover hover:scale-105 transition duration-300">
                </a>
                <div class="p-3.5 flex-1 flex flex-col">
                    <p class="text-[11px] font-medium text-slate-500 truncate"><?= e($prod['cat_name'] ?? 'General') ?></p>
                    <a href="product_detail.php?id=<?= (int)$prod['id'] ?>" class="mt-0.5 text-sm font-bold text-slate-900 line-clamp-2 hover:text-orange-600 transition">
                        <?= e($prod['name']) ?>
                    </a>
                    <div class="mt-auto pt-3 flex items-center justify-between gap-2">
                        <span class="text-sm sm:text-base font-extrabold text-slate-900 font-mono tabular-nums">
                            <?= formatINR($prod['price']) ?>
                        </span>
                        <?php if ((int)$prod['stock'] > 0): ?>
                        <button type="button" onclick="quickAddToCart(<?= (int)$prod['id'] ?>)"
                            class="h-9 px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-orange-600 active:scale-95 transition flex items-center gap-1.5 shrink-0">
                            <i class="fa-solid fa-plus text-[10px]"></i>
                            <span>Add</span>
                        </button>
                        <?php else: ?>
                        <span class="text-[11px] font-semibold text-rose-600">Out of stock</span>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    </section>
</main>

<script>
async function quickAddToCart(productId) {
    showLoader('Adding item...');
    const fd = new FormData();
    fd.append('ajax_action', 'add_to_cart');
    fd.append('product_id', productId);
    fd.append('quantity', 1);

    try {
        const res = await fetch('index.php', { method: 'POST', body: fd });
        const data = await res.json();
        hideLoader();
        if (data.success) {
            updateCartBadges(data.cart_count);
            showModal({ title: 'Added to Cart', message: data.message, type: 'success' });
        } else {
            showModal({ title: 'Unable to Add', message: data.message, type: 'error' });
        }
    } catch (err) {
        hideLoader();
        showModal({ title: 'Error', message: 'Could not update cart.', type: 'error' });
    }
}
</script>

<?php require_once __DIR__ . '/common/bottom.php'; ?>
