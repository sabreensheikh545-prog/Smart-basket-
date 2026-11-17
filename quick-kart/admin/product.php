<?php
require_once __DIR__ . '/../common/config.php';

if (!isAdminLoggedIn()) {
    header('Location: login.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['ajax_action'])) {
    $action = $_POST['ajax_action'];

    if ($action === 'save_product') {
        $id = (int)($_POST['id'] ?? 0);
        $catId = (int)($_POST['cat_id'] ?? 0);
        $name = trim($_POST['name'] ?? '');
        $desc = trim($_POST['description'] ?? '');
        $price = (float)($_POST['price'] ?? 0);
        $stock = (int)($_POST['stock'] ?? 0);

        if ($catId <= 0 || mb_strlen($name) < 2 || $price <= 0) {
            jsonResponse(false, 'Please provide valid category, name, and price.');
        }

        $imagePath = trim($_POST['existing_image'] ?? '');
        if (!empty($_FILES['image']['name']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $ext = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'])) {
                jsonResponse(false, 'Invalid image format. Use JPG, PNG, or WEBP.');
            }
            $fileName = 'prod_' . time() . '_' . mt_rand(100, 999) . '.' . $ext;
            $target = __DIR__ . '/../images/products/' . $fileName;
            if (move_uploaded_file($_FILES['image']['tmp_name'], $target)) {
                $imagePath = 'images/products/' . $fileName;
            }
        }

        if ($id > 0) {
            $stmt = $conn->prepare('UPDATE products SET cat_id = ?, name = ?, description = ?, price = ?, stock = ?, image = ? WHERE id = ?');
            $stmt->bind_param('issdisi', $catId, $name, $desc, $price, $stock, $imagePath, $id);
            $stmt->execute();
            $stmt->close();
            jsonResponse(true, 'Product updated successfully.');
        } else {
            $stmt = $conn->prepare('INSERT INTO products (cat_id, name, description, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->bind_param('issdis', $catId, $name, $desc, $price, $stock, $imagePath);
            $stmt->execute();
            $stmt->close();
            jsonResponse(true, 'Product added successfully.');
        }
    }

    if ($action === 'delete_product') {
        $id = (int)($_POST['id'] ?? 0);
        $stmt = $conn->prepare('DELETE FROM products WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
        jsonResponse(true, 'Product deleted.');
    }

    jsonResponse(false, 'Unknown action.');
}

$categories = $conn->query('SELECT id, name FROM categories ORDER BY name ASC')->fetch_all(MYSQLI_ASSOC);
$products = $conn->query('SELECT p.*, c.name AS cat_name FROM products p LEFT JOIN categories c ON p.cat_id = c.id ORDER BY p.id DESC')->fetch_all(MYSQLI_ASSOC);

$adminTitle = 'Products';
require_once __DIR__ . '/common/header.php';
require_once __DIR__ . '/common/sidebar.php';
?>

<main class="max-w-6xl mx-auto px-4 py-5 space-y-5">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-xl font-extrabold text-slate-900">Products</h1>
            <p class="text-xs text-slate-500">Manage inventory, pricing in ₹, and stock</p>
        </div>
        <button type="button" onclick="openProdModal()" class="px-4 py-2.5 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition flex items-center gap-1.5">
            <i class="fa-solid fa-plus"></i>
            <span>Add Product</span>
        </button>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <?php foreach ($products as $prod): ?>
        <div class="bg-white rounded-2xl border border-slate-200/80 p-4 flex gap-3.5 items-center">
            <div class="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                <img src="../<?= e($prod['image'] ?: 'images/hero.jpg') ?>" alt="<?= e($prod['name']) ?>" class="w-full h-full object-cover">
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-[11px] font-medium text-slate-500 truncate"><?= e($prod['cat_name'] ?? 'Uncategorized') ?></p>
                <h3 class="text-sm font-bold text-slate-900 truncate"><?= e($prod['name']) ?></h3>
                <div class="mt-1 flex items-center gap-3 text-xs">
                    <span class="font-extrabold text-slate-900 font-mono tabular-nums"><?= formatINR($prod['price']) ?></span>
                    <span class="<?= (int)$prod['stock'] > 0 ? 'text-emerald-700' : 'text-rose-600' ?> font-semibold">Stock: <?= (int)$prod['stock'] ?></span>
                </div>
                <div class="mt-2.5 flex items-center gap-2">
                    <button type="button" onclick='openProdModal(<?= json_encode($prod) ?>)' class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200">
                        <i class="fa-solid fa-pen mr-1"></i>Edit
                    </button>
                    <button type="button" onclick="deleteProduct(<?= (int)$prod['id'] ?>)" class="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-semibold hover:bg-rose-100">
                        <i class="fa-solid fa-trash mr-1"></i>Delete
                    </button>
                </div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
</main>

<!-- Product Add/Edit Modal -->
<div id="prodFormModal" class="fixed inset-0 z-50 hidden items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
    <div class="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 my-8">
        <div class="flex items-center justify-between mb-4">
            <h2 id="prodModalTitle" class="text-base font-extrabold text-slate-900">Add Product</h2>
            <button type="button" onclick="closeProdModal()" class="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <form id="prodForm" enctype="multipart/form-data" class="space-y-3.5">
            <input type="hidden" name="ajax_action" value="save_product">
            <input type="hidden" name="id" id="prodId" value="0">
            <input type="hidden" name="existing_image" id="prodExistingImg" value="">

            <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select name="cat_id" id="prodCatId" required class="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
                    <?php foreach ($categories as $c): ?>
                    <option value="<?= (int)$c['id'] ?>"><?= e($c['name']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Product Name</label>
                <input type="text" name="name" id="prodName" required class="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Price (₹)</label>
                    <input type="number" step="0.01" min="1" name="price" id="prodPrice" required class="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Stock</label>
                    <input type="number" min="0" name="stock" id="prodStock" required class="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
                </div>
            </div>
            <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea name="description" id="prodDesc" rows="3" required class="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none"></textarea>
            </div>
            <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Product Image</label>
                <input type="file" name="image" accept="image/*" class="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-slate-100 file:font-semibold">
            </div>
            <button type="submit" class="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-orange-600 transition">
                Save Product
            </button>
        </form>
    </div>
</div>

<script>
function openProdModal(prod = null) {
    document.getElementById('prodModalTitle').textContent = prod ? 'Edit Product' : 'Add Product';
    document.getElementById('prodId').value = prod ? prod.id : 0;
    document.getElementById('prodName').value = prod ? prod.name : '';
    document.getElementById('prodDesc').value = prod ? prod.description : '';
    document.getElementById('prodPrice').value = prod ? prod.price : '';
    document.getElementById('prodStock').value = prod ? prod.stock : 10;
    document.getElementById('prodExistingImg').value = prod ? (prod.image || '') : '';
    if (prod && prod.cat_id) document.getElementById('prodCatId').value = prod.cat_id;

    const m = document.getElementById('prodFormModal');
    m.classList.remove('hidden');
    m.classList.add('flex');
}

function closeProdModal() {
    const m = document.getElementById('prodFormModal');
    m.classList.add('hidden');
    m.classList.remove('flex');
}

document.getElementById('prodForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    showLoader('Saving...');
    try {
        const res = await fetch('product.php', { method: 'POST', body: new FormData(this) });
        const data = await res.json();
        hideLoader();
        if (data.success) window.location.reload();
        else showModal({ title: 'Validation Error', message: data.message, type: 'error' });
    } catch {
        hideLoader();
        showModal({ title: 'Error', message: 'Failed to save product.', type: 'error' });
    }
});

function deleteProduct(id) {
    showModal({
        title: 'Delete Product',
        message: 'Are you sure you want to delete this product?',
        type: 'error',
        confirmText: 'Delete',
        onConfirm: async () => {
            showLoader('Deleting...');
            const fd = new FormData();
            fd.append('ajax_action', 'delete_product');
            fd.append('id', id);
            const res = await fetch('product.php', { method: 'POST', body: fd });
            const data = await res.json();
            hideLoader();
            if (data.success) window.location.reload();
        }
    });
}
</script>

<?php require_once __DIR__ . '/common/bottom.php'; ?>
