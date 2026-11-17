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

    if (!$prod || (int)$prod['stock'] <= 0) {
        jsonResponse(false, 'This item is currently out of stock.');
    }

    $_SESSION['cart'][$pid] = min((int)$prod['stock'], (int)($_SESSION['cart'][$pid] ?? 0) + $qty);
    jsonResponse(true, $qty . ' × ' . $prod['name'] . ' added to cart.', ['cart_count' => getCartCount()]);
}

$id = (int)($_GET['id'] ?? 0);
$stmt = $conn->prepare('SELECT p.*, c.name AS cat_name FROM products p LEFT JOIN categories c ON p.cat_id = c.id WHERE p.id = ? LIMIT 1');
$stmt->bind_param('i', $id);
$stmt->execute();
$product = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$product) {
    header('Location: product.php');
    exit;
}

// Build gallery array for basic JS slider
$primaryImage = $product['image'] ?: 'images/hero.jpg';
$sliderImages = [$primaryImage, 'images/hero.jpg'];

// Related products
$relStmt = $conn->prepare('SELECT id, name, price, image, stock FROM products WHERE cat_id = ? AND id != ? LIMIT 4');
$relStmt->bind_param('ii', $product['cat_id'], $id);
$relStmt->execute();
$related = $relStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$relStmt->close();

$pageTitle = $product['name'];
require_once __DIR__ . '/common/header.php';
require_once __DIR__ . '/common/sidebar.php';
?>

<main class="max-w-6xl mx-auto px-4 py-5 space-y-8">
    <div class="grid md:grid-cols-2 gap-6 items-start">
        <!-- JS Image Slider -->
        <div class="bg-white rounded-3xl border border-slate-200/80 overflow-hidden relative">
            <div class="aspect-square bg-slate-100 relative overflow-hidden">
                <img id="sliderMainImg" src="<?= e($sliderImages[0]) ?>" alt="<?= e($product['name']) ?>" class="w-full h-full object-cover transition duration-300">
                <button type="button" onclick="slideImage(-1)" aria-label="Previous image"
                    class="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-slate-800 shadow-md flex items-center justify-center hover:bg-white">
                    <i class="fa-solid fa-chevron-left text-xs"></i>
                </button>
                <button type="button" onclick="slideImage(1)" aria-label="Next image"
                    class="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-slate-800 shadow-md flex items-center justify-center hover:bg-white">
                    <i class="fa-solid fa-chevron-right text-xs"></i>
                </button>
            </div>
            <div class="p-3 flex items-center justify-center gap-2 border-t border-slate-100">
                <?php foreach ($sliderImages as $idx => $img): ?>
                <button type="button" onclick="setSlide(<?= $idx ?>)"
                    class="w-14 h-14 rounded-xl overflow-hidden border-2 <?= $idx === 0 ? 'border-orange-600' : 'border-slate-200' ?> slider-thumb">
                    <img src="<?= e($img) ?>" alt="Thumb <?= $idx + 1 ?>" class="w-full h-full object-cover">
                </button>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- Product Purchase Module -->
        <div class="bg-white rounded-3xl border border-slate-200/80 p-6 space-y-5">
            <div>
                <div class="flex items-center gap-2 text-xs text-slate-500">
                    <span><?= e($product['cat_name'] ?? 'Collection') ?></span>
                    <span>·</span>
                    <?php if ((int)$product['stock'] > 0): ?>
                        <span class="text-emerald-700 font-semibold"><i class="fa-solid fa-circle-check mr-1"></i>In Stock (<?= (int)$product['stock'] ?>)</span>
                    <?php else: ?>
                        <span class="text-rose-600 font-semibold"><i class="fa-solid fa-circle-xmark mr-1"></i>Out of Stock</span>
                    <?php endif; ?>
                </div>
                <h1 class="mt-2 text-2xl font-extrabold text-slate-900"><?= e($product['name']) ?></h1>
                <p class="mt-2 text-2xl font-extrabold text-slate-900 font-mono tabular-nums"><?= formatINR($product['price']) ?></p>
                <p class="text-xs text-slate-500 mt-0.5">Inclusive of all taxes · Cash on Delivery available</p>
            </div>

            <div class="pt-4 border-t border-slate-100">
                <h2 class="text-xs font-bold text-slate-700 uppercase tracking-wider">Description</h2>
                <p class="mt-2 text-sm text-slate-600 leading-relaxed"><?= nl2br(e($product['description'])) ?></p>
            </div>

            <?php if ((int)$product['stock'] > 0): ?>
            <div class="pt-4 border-t border-slate-100 space-y-4">
                <div class="flex items-center justify-between">
                    <span class="text-sm font-semibold text-slate-700">Quantity</span>
                    <div class="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50">
                        <button type="button" onclick="changeQty(-1)" class="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded-l-xl">
                            <i class="fa-solid fa-minus text-xs"></i>
                        </button>
                        <input type="number" id="qtyInput" value="1" min="1" max="<?= (int)$product['stock'] ?>" readonly
                            class="w-12 h-10 text-center bg-transparent text-sm font-bold text-slate-900 tabular-nums focus:outline-none">
                        <button type="button" onclick="changeQty(1)" class="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded-r-xl">
                            <i class="fa-solid fa-plus text-xs"></i>
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <button type="button" onclick="addDetailToCart(false)"
                        class="h-12 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 active:scale-[0.99] transition flex items-center justify-center gap-2">
                        <i class="fa-solid fa-bag-shopping"></i>
                        <span>Add to Cart</span>
                    </button>
                    <button type="button" onclick="addDetailToCart(true)"
                        class="h-12 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 active:scale-[0.99] transition flex items-center justify-center gap-2">
                        <i class="fa-solid fa-bolt"></i>
                        <span>Buy Now</span>
                    </button>
                </div>
            </div>
            <?php endif; ?>
        </div>
    </div>

    <!-- Related Products -->
    <?php if (!empty($related)): ?>
    <section>
        <h2 class="text-base sm:text-lg font-bold text-slate-900 mb-4">Related Products</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <?php foreach ($related as $rel): ?>
            <a href="product_detail.php?id=<?= (int)$rel['id'] ?>" class="bg-white rounded-2xl border border-slate-200/80 overflow-hidden hover:shadow-md transition flex flex-col">
                <div class="aspect-square bg-slate-100">
                    <img src="<?= e($rel['image'] ?: 'images/hero.jpg') ?>" alt="<?= e($rel['name']) ?>" class="w-full h-full object-cover">
                </div>
                <div class="p-3">
                    <p class="text-sm font-bold text-slate-900 truncate"><?= e($rel['name']) ?></p>
                    <p class="mt-1 text-sm font-extrabold text-orange-600 font-mono tabular-nums"><?= formatINR($rel['price']) ?></p>
                </div>
            </a>
            <?php endforeach; ?>
        </div>
    </section>
    <?php endif; ?>
</main>

<script>
const sliderImages = <?= json_encode($sliderImages) ?>;
let currentSlide = 0;
const maxStock = <?= (int)$product['stock'] ?>;

function setSlide(idx) {
    currentSlide = (idx + sliderImages.length) % sliderImages.length;
    document.getElementById('sliderMainImg').src = sliderImages[currentSlide];
    document.querySelectorAll('.slider-thumb').forEach((el, i) => {
        el.classList.toggle('border-orange-600', i === currentSlide);
        el.classList.toggle('border-slate-200', i !== currentSlide);
    });
}

function slideImage(delta) {
    setSlide(currentSlide + delta);
}

function changeQty(delta) {
    const input = document.getElementById('qtyInput');
    if (!input) return;
    let val = parseInt(input.value || '1', 10) + delta;
    if (val < 1) val = 1;
    if (val > maxStock) val = maxStock;
    input.value = val;
}

async function addDetailToCart(goToCheckout) {
    const qty = parseInt(document.getElementById('qtyInput')?.value || '1', 10);
    showLoader('Updating cart...');
    const fd = new FormData();
    fd.append('ajax_action', 'add_to_cart');
    fd.append('product_id', <?= (int)$product['id'] ?>);
    fd.append('quantity', qty);

    try {
        const res = await fetch('product_detail.php?id=<?= (int)$product['id'] ?>', { method: 'POST', body: fd });
        const data = await res.json();
        hideLoader();
        if (data.success) {
            updateCartBadges(data.cart_count);
            if (goToCheckout) {
                window.location.href = 'cart.php';
            } else {
                showModal({ title: 'Added to Cart', message: data.message, type: 'success' });
            }
        } else {
            showModal({ title: 'Notice', message: data.message, type: 'error' });
        }
    } catch {
        hideLoader();
        showModal({ title: 'Error', message: 'Network error while adding to cart.', type: 'error' });
    }
}
</script>

<?php require_once __DIR__ . '/common/bottom.php'; ?>
