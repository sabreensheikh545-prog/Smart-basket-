<?php
$adminPage = basename($_SERVER['PHP_SELF'] ?? 'index.php');
?>
<div id="adminSidebarBackdrop" onclick="toggleAdminSidebar(false)" class="fixed inset-0 z-50 hidden bg-slate-900/50 backdrop-blur-xs"></div>

<aside id="adminSidebarDrawer" class="fixed top-0 left-0 bottom-0 z-50 w-72 bg-slate-900 text-white border-r border-slate-800 shadow-2xl transform -translate-x-full transition-transform duration-200 ease-out flex flex-col">
    <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center">
                <i class="fa-solid fa-bolt text-sm"></i>
            </span>
            <span class="text-base font-extrabold">Admin Menu</span>
        </div>
        <button type="button" onclick="toggleAdminSidebar(false)" class="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-800">
            <i class="fa-solid fa-xmark"></i>
        </button>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <a href="index.php" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium <?= $adminPage === 'index.php' ? 'bg-orange-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800' ?>">
            <i class="fa-solid fa-chart-pie w-5 text-center"></i>
            <span>Dashboard</span>
        </a>
        <a href="category.php" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium <?= $adminPage === 'category.php' ? 'bg-orange-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800' ?>">
            <i class="fa-solid fa-tags w-5 text-center"></i>
            <span>Categories</span>
        </a>
        <a href="product.php" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium <?= $adminPage === 'product.php' ? 'bg-orange-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800' ?>">
            <i class="fa-solid fa-boxes-stacked w-5 text-center"></i>
            <span>Products</span>
        </a>
        <a href="order.php" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium <?= ($adminPage === 'order.php' || $adminPage === 'order_detail.php') ? 'bg-orange-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800' ?>">
            <i class="fa-solid fa-receipt w-5 text-center"></i>
            <span>Orders</span>
        </a>
        <a href="user.php" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium <?= $adminPage === 'user.php' ? 'bg-orange-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800' ?>">
            <i class="fa-solid fa-users w-5 text-center"></i>
            <span>Users</span>
        </a>
        <a href="setting.php" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium <?= $adminPage === 'setting.php' ? 'bg-orange-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800' ?>">
            <i class="fa-solid fa-gear w-5 text-center"></i>
            <span>Settings</span>
        </a>
    </nav>

    <div class="p-4 border-t border-slate-800">
        <a href="login.php?logout=1" class="w-full py-2.5 px-4 rounded-xl bg-slate-800 text-rose-400 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-700 transition">
            <i class="fa-solid fa-right-from-bracket"></i>
            <span>Logout</span>
        </a>
    </div>
</aside>
