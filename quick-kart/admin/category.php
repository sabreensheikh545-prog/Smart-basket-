<?php
require_once __DIR__ . '/../common/config.php';

if (!isAdminLoggedIn()) {
    header('Location: login.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['ajax_action'])) {
    $action = $_POST['ajax_action'];

    if ($action === 'save_category') {
        $id = (int)($_POST['id'] ?? 0);
        $name = trim($_POST['name'] ?? '');
        if (mb_strlen($name) < 2) {
            jsonResponse(false, 'Category name is required.');
        }

        $imagePath = trim($_POST['existing_image'] ?? '');
        if (!empty($_FILES['image']['name']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $ext = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'])) {
                jsonResponse(false, 'Invalid image format. Use JPG, PNG, or WEBP.');
            }
            $fileName = 'cat_' . time() . '_' . mt_rand(100, 999) . '.' . $ext;
            $target = __DIR__ . '/../images/categories/' . $fileName;
            if (move_uploaded_file($_FILES['image']['tmp_name'], $target)) {
                $imagePath = 'images/categories/' . $fileName;
            }
        }

        if ($id > 0) {
            $stmt = $conn->prepare('UPDATE categories SET name = ?, image = ? WHERE id = ?');
            $stmt->bind_param('ssi', $name, $imagePath, $id);
            $stmt->execute();
            $stmt->close();
            jsonResponse(true, 'Category updated successfully.');
        } else {
            $stmt = $conn->prepare('INSERT INTO categories (name, image) VALUES (?, ?)');
            $stmt->bind_param('ss', $name, $imagePath);
            $stmt->execute();
            $stmt->close();
            jsonResponse(true, 'Category added successfully.');
        }
    }

    if ($action === 'delete_category') {
        $id = (int)($_POST['id'] ?? 0);
        $stmt = $conn->prepare('DELETE FROM categories WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
        jsonResponse(true, 'Category deleted.');
    }

    jsonResponse(false, 'Unknown action.');
}

$categories = $conn->query('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.cat_id = c.id) AS product_count FROM categories c ORDER BY c.id DESC')->fetch_all(MYSQLI_ASSOC);

$adminTitle = 'Categories';
require_once __DIR__ . '/common/header.php';
require_once __DIR__ . '/common/sidebar.php';
?>

<main class="max-w-5xl mx-auto px-4 py-5 space-y-5">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-xl font-extrabold text-slate-900">Categories</h1>
            <p class="text-xs text-slate-500">Manage product categories &amp; icons</p>
        </div>
        <button type="button" onclick="openCatModal()" class="px-4 py-2.5 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition flex items-center gap-1.5">
            <i class="fa-solid fa-plus"></i>
            <span>Add Category</span>
        </button>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <?php foreach ($categories as $cat): ?>
        <div class="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                    <?php if (!empty($cat['image'])): ?>
                        <img src="../<?= e($cat['image']) ?>" alt="<?= e($cat['name']) ?>" class="w-full h-full object-cover">
                    <?php else: ?>
                        <i class="fa-solid fa-tags text-slate-400"></i>
                    <?php endif; ?>
                </div>
                <div class="min-w-0">
                    <h3 class="text-sm font-bold text-slate-900 truncate"><?= e($cat['name']) ?></h3>
                    <p class="text-xs text-slate-500 tabular-nums"><?= (int)$cat['product_count'] ?> products</p>
                </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
                <button type="button" onclick='openCatModal(<?= json_encode($cat) ?>)' class="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center">
                    <i class="fa-solid fa-pen text-xs"></i>
                </button>
                <button type="button" onclick="deleteCategory(<?= (int)$cat['id'] ?>)" class="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
</main>

<!-- Category Add/Edit Modal -->
<div id="catFormModal" class="fixed inset-0 z-50 hidden items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
    <div class="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
        <div class="flex items-center justify-between mb-4">
            <h2 id="catModalTitle" class="text-base font-extrabold text-slate-900">Add Category</h2>
            <button type="button" onclick="closeCatModal()" class="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <form id="catForm" enctype="multipart/form-data" class="space-y-4">
            <input type="hidden" name="ajax_action" value="save_category">
            <input type="hidden" name="id" id="catId" value="0">
            <input type="hidden" name="existing_image" id="catExistingImg" value="">

            <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5">Category Name</label>
                <input type="text" name="name" id="catName" required placeholder="e.g. Electronics"
                    class="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none">
            </div>
            <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5">Category Image</label>
                <input type="file" name="image" accept="image/*"
                    class="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-slate-100 file:font-semibold">
            </div>
            <button type="submit" class="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-orange-600 transition">
                Save Category
            </button>
        </form>
    </div>
</div>

<script>
function openCatModal(cat = null) {
    document.getElementById('catModalTitle').textContent = cat ? 'Edit Category' : 'Add Category';
    document.getElementById('catId').value = cat ? cat.id : 0;
    document.getElementById('catName').value = cat ? cat.name : '';
    document.getElementById('catExistingImg').value = cat ? (cat.image || '') : '';
    const m = document.getElementById('catFormModal');
    m.classList.remove('hidden');
    m.classList.add('flex');
}

function closeCatModal() {
    const m = document.getElementById('catFormModal');
    m.classList.add('hidden');
    m.classList.remove('flex');
}

document.getElementById('catForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    showLoader('Saving...');
    try {
        const res = await fetch('category.php', { method: 'POST', body: new FormData(this) });
        const data = await res.json();
        hideLoader();
        if (data.success) window.location.reload();
        else showModal({ title: 'Error', message: data.message, type: 'error' });
    } catch {
        hideLoader();
        showModal({ title: 'Error', message: 'Failed to save category.', type: 'error' });
    }
});

function deleteCategory(id) {
    showModal({
        title: 'Delete Category',
        message: 'Deleting a category also deletes its products. Continue?',
        type: 'error',
        confirmText: 'Delete',
        onConfirm: async () => {
            showLoader('Deleting...');
            const fd = new FormData();
            fd.append('ajax_action', 'delete_category');
            fd.append('id', id);
            const res = await fetch('category.php', { method: 'POST', body: fd });
            const data = await res.json();
            hideLoader();
            if (data.success) window.location.reload();
        }
    });
}
</script>

<?php require_once __DIR__ . '/common/bottom.php'; ?>
