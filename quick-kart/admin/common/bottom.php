<?php
$adminPage = basename($_SERVER['PHP_SELF'] ?? 'index.php');
?>
<nav class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200">
    <div class="grid grid-cols-4 h-16 items-center">
        <a href="index.php" class="flex flex-col items-center justify-center h-full <?= $adminPage === 'index.php' ? 'text-orange-600' : 'text-slate-500' ?>">
            <i class="fa-solid fa-chart-pie text-lg"></i>
            <span class="text-[10px] font-semibold mt-1">Home</span>
        </a>
        <a href="product.php" class="flex flex-col items-center justify-center h-full <?= ($adminPage === 'product.php' || $adminPage === 'category.php') ? 'text-orange-600' : 'text-slate-500' ?>">
            <i class="fa-solid fa-boxes-stacked text-lg"></i>
            <span class="text-[10px] font-semibold mt-1">Catalog</span>
        </a>
        <a href="order.php" class="flex flex-col items-center justify-center h-full <?= ($adminPage === 'order.php' || $adminPage === 'order_detail.php') ? 'text-orange-600' : 'text-slate-500' ?>">
            <i class="fa-solid fa-receipt text-lg"></i>
            <span class="text-[10px] font-semibold mt-1">Orders</span>
        </a>
        <a href="user.php" class="flex flex-col items-center justify-center h-full <?= ($adminPage === 'user.php' || $adminPage === 'setting.php') ? 'text-orange-600' : 'text-slate-500' ?>">
            <i class="fa-solid fa-users text-lg"></i>
            <span class="text-[10px] font-semibold mt-1">Users</span>
        </a>
    </div>
</nav>

<script>
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('selectstart', e => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') e.preventDefault();
});
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
});
document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());

function toggleAdminSidebar(open) {
    const backdrop = document.getElementById('adminSidebarBackdrop');
    const drawer = document.getElementById('adminSidebarDrawer');
    if (!backdrop || !drawer) return;
    if (open) {
        backdrop.classList.remove('hidden');
        requestAnimationFrame(() => drawer.classList.remove('-translate-x-full'));
    } else {
        drawer.classList.add('-translate-x-full');
        setTimeout(() => backdrop.classList.add('hidden'), 200);
    }
}

function showLoader(text = 'Please wait...') {
    const modal = document.getElementById('qkLoaderModal');
    const label = document.getElementById('qkLoaderText');
    if (label) label.textContent = text;
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function hideLoader() {
    const modal = document.getElementById('qkLoaderModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function showModal({ title = 'Notice', message = '', type = 'info', onConfirm = null, confirmText = 'OK' }) {
    const modal = document.getElementById('qkModal');
    const titleEl = document.getElementById('qkModalTitle');
    const msgEl = document.getElementById('qkModalMessage');
    const iconWrap = document.getElementById('qkModalIconWrap');
    const icon = document.getElementById('qkModalIcon');
    const okBtn = document.getElementById('qkModalOkBtn');
    const cancelBtn = document.getElementById('qkModalCancelBtn');

    titleEl.textContent = title;
    msgEl.textContent = message;
    okBtn.textContent = confirmText;

    iconWrap.className = 'w-10 h-10 rounded-xl flex items-center justify-center shrink-0';
    if (type === 'success') {
        iconWrap.classList.add('bg-emerald-50', 'text-emerald-600');
        icon.className = 'fa-solid fa-circle-check text-lg';
    } else if (type === 'error') {
        iconWrap.classList.add('bg-rose-50', 'text-rose-600');
        icon.className = 'fa-solid fa-circle-exclamation text-lg';
    } else {
        iconWrap.classList.add('bg-orange-50', 'text-orange-600');
        icon.className = 'fa-solid fa-circle-info text-lg';
    }

    if (typeof onConfirm === 'function') cancelBtn.classList.remove('hidden');
    else cancelBtn.classList.add('hidden');

    const closeModal = () => { modal.classList.add('hidden'); modal.classList.remove('flex'); };
    cancelBtn.onclick = closeModal;
    okBtn.onclick = () => { closeModal(); if (typeof onConfirm === 'function') onConfirm(); };

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}
</script>
</body>
</html>
