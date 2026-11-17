<?php
$currentPage = basename($_SERVER['PHP_SELF'] ?? 'index.php');
$bottomCartCount = getCartCount();
?>
<!-- Fixed Mobile Bottom Navigation -->
<nav class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200">
    <div class="grid grid-cols-4 h-16 items-center">
        <a href="index.php" class="flex flex-col items-center justify-center h-full <?= $currentPage === 'index.php' ? 'text-orange-600' : 'text-slate-500 hover:text-slate-900' ?>">
            <i class="fa-solid fa-house text-lg"></i>
            <span class="text-[10px] font-semibold mt-1">Home</span>
        </a>
        <a href="product.php" class="flex flex-col items-center justify-center h-full <?= ($currentPage === 'product.php' || $currentPage === 'product_detail.php') ? 'text-orange-600' : 'text-slate-500 hover:text-slate-900' ?>">
            <i class="fa-solid fa-grid-2 fa-border-all text-lg"></i>
            <span class="text-[10px] font-semibold mt-1">Shop</span>
        </a>
        <a href="cart.php" class="relative flex flex-col items-center justify-center h-full <?= ($currentPage === 'cart.php' || $currentPage === 'checkout.php') ? 'text-orange-600' : 'text-slate-500 hover:text-slate-900' ?>">
            <div class="relative">
                <i class="fa-solid fa-bag-shopping text-lg"></i>
                <span id="bottomCartBadge" class="<?= $bottomCartCount > 0 ? '' : 'hidden' ?> absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-orange-600 text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                    <?= $bottomCartCount ?>
                </span>
            </div>
            <span class="text-[10px] font-semibold mt-1">Cart</span>
        </a>
        <a href="profile.php" class="flex flex-col items-center justify-center h-full <?= ($currentPage === 'profile.php' || $currentPage === 'order.php') ? 'text-orange-600' : 'text-slate-500 hover:text-slate-900' ?>">
            <i class="fa-solid fa-user text-lg"></i>
            <span class="text-[10px] font-semibold mt-1">Profile</span>
        </a>
    </div>
</nav>

<script>
// Security & Native App UX Restrictions: Disable right-click, text selection, and zoom
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
});

document.addEventListener('selectstart', function(e) {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        e.preventDefault();
    }
});

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) {
        e.preventDefault();
    }
});

document.addEventListener('wheel', function(e) {
    if (e.ctrlKey) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('gesturestart', function(e) {
    e.preventDefault();
});

document.addEventListener('touchmove', function(e) {
    if (e.touches && e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

// Sidebar Drawer Controller
function toggleSidebar(open) {
    const backdrop = document.getElementById('qkSidebarBackdrop');
    const drawer = document.getElementById('qkSidebarDrawer');
    if (!backdrop || !drawer) return;
    if (open) {
        backdrop.classList.remove('hidden');
        requestAnimationFrame(() => drawer.classList.remove('-translate-x-full'));
    } else {
        drawer.classList.add('-translate-x-full');
        setTimeout(() => backdrop.classList.add('hidden'), 200);
    }
}

// Square Dotted Loader Modal
function showLoader(text = 'Please wait...') {
    const modal = document.getElementById('qkLoaderModal');
    const label = document.getElementById('qkLoaderText');
    if (label) label.textContent = text;
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function hideLoader() {
    const modal = document.getElementById('qkLoaderModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// Reusable Tailwind Alert / Confirm Modal
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

    if (typeof onConfirm === 'function') {
        cancelBtn.classList.remove('hidden');
    } else {
        cancelBtn.classList.add('hidden');
    }

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    cancelBtn.onclick = closeModal;
    okBtn.onclick = () => {
        closeModal();
        if (typeof onConfirm === 'function') onConfirm();
    };

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function updateCartBadges(count) {
    ['headerCartBadge', 'bottomCartBadge'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = count;
        if (count > 0) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}
</script>
</body>
</html>
