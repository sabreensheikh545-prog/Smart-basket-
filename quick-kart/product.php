<?php
require_once __DIR__ . '/common/config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['ajax_action'] ?? '') === 'add_to_cart') {
    $pid = (int)($_POST['product_id'] ?? 0);
    $stmt = $conn->prepare('SELECT id, name, stock FROM products WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $pid);
    $stmt->execute();
    $prod = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$prod || (int)$prod['stock'] <= 0) {
        jsonResponse(false, 'Product unavailable or out of stock.');
    }
    $_SESSION['cart'][$pid] = min((int)$prod['stock'], (int)($_SESSION['cart'][$pid] ?? 0) + 1);
    jsonResponse(true, $prod['name'] . ' added to cart.', ['cart_count' => getCartCount()]);
}

$catId = (int)($_GET['cat'] ?? 0);
$maxPrice = isset($_GET['max_price']) && $_GET['max_price'] !== '' ? (float)$_GET['max_price'] : 0;
$sort = $_GET['sort'] ?? 'newest';
$search = trim($_GET['q'] ?? '');

$categories = [];
$catRes = $conn->query('SELECT id, name FROM categories ORDER BY name ASC');
if ($catRes) {
    while ($row = $catRes->fetch_assoc()) {
        $categories[] = $row;
    }
}

$where = [];
$params = [];
$types = '';

if ($catId > 0) {
    $where[] = 'p.cat_id = ?';
    $params[] = $catId;
    $types .= 'i';
}
if ($maxPrice > 0) {
    $where[] = 'p.price <= ?';
    $params[] = $maxPrice;
    $types .= 'd';
}
if ($search !== '') {
    $where[] = '(p.name LIKE ? OR p.description LIKE ?)';
    $like = '%' . $search . '%';
    $params[] = $like;
    $params[] = $like;
    $types .= 'ss';
}

$orderBy = 'p.id DESC';
if ($sort === 'price_asc') $orderBy = 'p.price ASC';
if ($sort === 'price_desc') $orderBy = 'p.price DESC';

$sql = 'SELECT p.id, p.name, p.price, p.stock, p.image, c.name AS cat_name FROM products p LEFT JOIN categories c ON p.cat_id = c.id';
if (!empty($where)) {
    $sql .= ' WHERE ' . implode(' AND ', $where);
}
$sql .= ' ORDER BY ' . $orderBy;

$stmt = $conn->prepare($sql);
if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$res = $stmt->get_result();
$products = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
$stmt->close();

$pageTitle = 'Shop Catalog';
require_once __DIR__ . '/common/header.php';
require_once __DIR__ . '/common/sidebar.php';
?>

<main class="max-w-7xl mx-auto px-4 py-5 space-y-5">
    <!-- Filters Bar -->
    <section class="bg-white rounded-2xl border border-slate-200/80 p-4">
        <form method="GET" action="product.php" class="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                <select name="cat" onchange="this.form.submit()" class="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:border-orange-500 focus:outline-none">
                    <option value="0">All Categories</option>
                    <?php foreach ($categories as $c): ?>
                    <option value="<?= (int)$c['id'] ?>" <?= $catId === (int)$c['id'] ? 'selected' : '' ?>><?= e($c['name']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Max Price (₹)</label>
                <select name="max_price" onchange="this.form.submit()" class="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:border-orange-500 focus:outline-none">
                    <option value="">Any Price</option>
                    <option value="1500" <?= $maxPrice == 1500 ? 'selected' : '' ?>>Under ₹1,500</option>
                    <option value="3000" <?= $maxPrice == 3000 ? 'selected' : '' ?>>Under ₹3,000</option>
                    <option value="5000" <?= $maxPrice == 5000 ? 'selected' : '' ?>>Under ₹5,000</option>
                    <option value="10000" <?= $maxPrice == 10000 ? 'selected' : '' ?>>Under ₹10,000</option>
                </select>
            </div>
            <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Sort By</label>
                <select name="sort" onchange="this.form.submit()" class="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:border-orange-500 focus:outline-none">
                    <option value="newest" <?= $sort === 'newest' ? 'selected' : '' ?>>Newest First</option>
                    <option value="price_asc" <?= $sort === 'price_asc' ? 'selected' : '' ?>>Price: Low to High</option>
                    <option value="price_desc" <?= $sort === 'price_desc' ? 'selected' : '' ?>>Price: High to Low</option>
                </select>
            </div>
            <div class="flex items-center gap-2">
                <?php if ($search !== ''): ?>
                <input type="hidden" name="q" value="<?= e($search) ?>">
                <?php endif; ?>
                <a href="product.php" class="w-full h-10 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5">
                    <i class="fa-solid fa-rotate-left"></i>
                    <span>Reset Filters</span>
                </a>
            </div>
        </form>
    </section>

    <!-- Results Header -->
    <div class="flex items-center justify-between">
        <h1 class="text-base sm:text-lg font-bold text-slate-900">
            <?= $search !== '' ? 'Results for "' . e($search) . '"' : 'All Products' ?>
        </h1>
        <span class="text-xs font-medium text-slate-500 tabular-nums"><?= count($products) ?> items</span>
    </div>

    <!-- Product Grid -->
    <?php if (empty($products)): ?>
        <div class="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <i class="fa-solid fa-box-open text-3xl text-slate-300"></i>
            <p class="mt-3 text-sm font-semibold text-slate-700">No products match your filters.</p>
            <a href="product.php" class="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold">Show All Products</a>
        </div>
    <?php else: ?>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            <?php foreach ($products as $prod): ?>
            <div class="bg-white rounded-2xl border border-slate-200/80 overflow-hidden flex flex-col hover:shadow-md transition">
                <a href="product_detail.php?id=<?= (int)$prod['id'] ?>" class="block aspect-square bg-slate-100 overflow-hidden">
                    <img src="<?= e($prod['image'] ?: 'images/hero.jpg') ?>" alt="<?= e($prod['name']) ?>" class="w-full h-full object-cover">
                </a>
                <div class="p-3.5 flex-1 flex flex-col">
                    <p class="text-[11px] font-medium text-slate-500 truncate"><?= e($prod['cat_name'] ?? 'General') ?></p>
                    <a href="product_detail.php?id=<?= (int)$prod['id'] ?>" class="mt-0.5 text-sm font-bold text-slate-900 line-clamp-2 hover:text-orange-600">
                        <?= e($prod['name']) ?>
                    </a>
                    <div class="mt-auto pt-3 flex items-center justify-between gap-2">
                        <span class="text-sm sm:text-base font-extrabold text-slate-900 font-mono tabular-nums"><?= formatINR($prod['price']) ?></span>
                        <?php if ((int)$prod['stock'] > 0): ?>
                        <button type="button" onclick="addCatalogItem(<?= (int)$prod['id'] ?>)"
                            class="h-9 px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-orange-600 active:scale-95 transition flex items-center gap-1.5">
                            <i class="fa-solid fa-cart-plus text-[11px]"></i>
                            <span>Add</span>
                        </button>
                        <?php else: ?>
                        <span class="text-[11px] font-semibold text-rose-600">Sold out</span>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</main>

<script>
async function addCatalogItem(id) {
    showLoader('Adding...');
    const fd = new FormData();
    fd.append('ajax_action', 'add_to_cart');
    fd.append('product_id', id);
    try {
        const res = await fetch('product.php', { method: 'POST', body: fd });
        const data = await res.json();
        hideLoader();
        if (data.success) {
            updateCartBadges(data.cart_count);
            showModal({ title: 'Added to Cart', message: data.message, type: 'success' });
        } else {
            showModal({ title: 'Unavailable', message: data.message, type: 'error' });
        }
    } catch {
        hideLoader();
        showModal({ title: 'Error', message: 'Failed to add product.', type: 'error' });
    }
}
</script>

<?php require_once __DIR__ . '/common/bottom.php'; ?>
