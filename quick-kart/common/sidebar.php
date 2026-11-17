<?php
$currentPage = basename($_SERVER['PHP_SELF'] ?? 'index.php');
$sidebarUser = isset($currentUser) ? $currentUser : null;
?>
<!-- Sliding Mobile Menu Overlay -->
<div id="qkSidebarBackdrop" onclick="toggleSidebar(false)" class="fixed inset-0 z-50 hidden bg-slate-900/50 backdrop-blur-xs transition-opacity"></div>

<aside id="qkSidebarDrawer" class="fixed top-0 left-0 bottom-0 z-50 w-72 bg-white border-r border-slate-200 shadow-2xl transform -translate-x-full transition-transform duration-200 ease-out flex flex-col">
    <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center">
                <i class="fa-solid fa-bolt text-sm"></i>
            </span>
            <span class="text-base font-extrabold text-slate-900">Quick Kart</span>
        </div>
        <button type="button" onclick="toggleSidebar(false)" aria-label="Close menu"
            class="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100">
            <i class="fa-solid fa-xmark"></i>
        </button>
    </div>

    <div class="px-5 py-4 bg-slate-50 border-b border-slate-100">
        <?php if ($sidebarUser): ?>
            <p class="text-sm font-bold text-slate-900 truncate"><?= e($sidebarUser['name']) ?></p>
            <p class="text-xs text-slate-500 truncate mt-0.5"><?= e($sidebarUser['email']) ?></p>
        <?php else: ?>
            <p class="text-sm font-semibold text-slate-800">Welcome, Guest</p>
            <a href="login.php" class="inline-flex items-center gap-1.5 mt-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700">
                <span>Sign in or Create Account</span>
                <i class="fa-solid fa-arrow-right text-[10px]"></i>
            </a>
        <?php endif; ?>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <a href="index.php" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium <?= $currentPage === 'index.php' ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-slate-700 hover:bg-slate-100' ?>">
            <i class="fa-solid fa-house w-5 text-center"></i>
            <span>Home</span>
        </a>
        <a href="product.php" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium <?= $currentPage === 'product.php' ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-slate-700 hover:bg-slate-100' ?>">
            <i class="fa-solid fa-store w-5 text-center"></i>
            <span>All Products</span>
        </a>
        <a href="cart.php" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium <?= $currentPage === 'cart.php' ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-slate-700 hover:bg-slate-100' ?>">
            <i class="fa-solid fa-bag-shopping w-5 text-center"></i>
            <span>My Cart</span>
        </a>
        <a href="order.php" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium <?= $currentPage === 'order.php' ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-slate-700 hover:bg-slate-100' ?>">
            <i class="fa-solid fa-box w-5 text-center"></i>
            <span>My Orders</span>
        </a>
        <a href="profile.php" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium <?= $currentPage === 'profile.php' ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-slate-700 hover:bg-slate-100' ?>">
            <i class="fa-solid fa-user w-5 text-center"></i>
            <span>My Profile</span>
        </a>
        <div class="pt-3 mt-3 border-t border-slate-100">
            <a href="admin/login.php" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100">
                <i class="fa-solid fa-shield-halved w-5 text-center"></i>
                <span>Admin Panel</span>
            </a>
        </div>
    </nav>

    <div class="p-4 border-t border-slate-100">
        <?php if ($sidebarUser): ?>
            <a href="profile.php?logout=1" class="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-800 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 transition">
                <i class="fa-solid fa-right-from-bracket"></i>
                <span>Logout</span>
            </a>
        <?php else: ?>
            <a href="login.php" class="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 transition">
                <i class="fa-solid fa-right-to-bracket"></i>
                <span>Login / Sign Up</span>
            </a>
        <?php endif; ?>
    </div>
</aside>
