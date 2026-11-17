<?php
$pageTitle = $pageTitle ?? 'Quick Kart';
$showSearch = $showSearch ?? true;
$cartCount = getCartCount();
$currentUser = isset($conn) && !$conn->connect_errno ? getCurrentUser($conn) : null;
$searchQuery = trim($_GET['q'] ?? '');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title><?= e($pageTitle) ?> — Quick Kart</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
                        mono: ['"JetBrains Mono"', 'monospace'],
                    }
                }
            }
        };
    </script>
    <style>
        html, body {
            touch-action: manipulation;
            -webkit-user-select: none;
            -ms-user-select: none;
            user-select: none;
            -webkit-touch-callout: none;
        }
        input, textarea, select {
            -webkit-user-select: text;
            user-select: text;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes qkDotBounce {
            0%, 80%, 100% { transform: scale(0.45); opacity: 0.35; }
            40% { transform: scale(1); opacity: 1; }
        }
        .qk-dot-1 { animation: qkDotBounce 1.1s infinite ease-in-out both; animation-delay: -0.32s; }
        .qk-dot-2 { animation: qkDotBounce 1.1s infinite ease-in-out both; animation-delay: -0.16s; }
        .qk-dot-3 { animation: qkDotBounce 1.1s infinite ease-in-out both; }
    </style>
</head>
<body class="bg-slate-50 text-slate-900 font-sans select-none overflow-x-hidden min-h-screen pb-20 md:pb-12">

<!-- Top Navigation Bar -->
<header class="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
    <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 shrink-0">
            <button type="button" onclick="toggleSidebar(true)" aria-label="Open menu"
                class="w-10 h-10 -ml-1 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition">
                <i class="fa-solid fa-bars text-lg"></i>
            </button>
            <a href="index.php" class="flex items-center gap-2 whitespace-nowrap shrink-0">
                <span class="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center shadow-sm">
                    <i class="fa-solid fa-bolt text-sm"></i>
                </span>
                <span class="text-lg font-extrabold tracking-tight text-slate-900">Quick Kart</span>
            </a>
        </div>

        <nav class="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="index.php" class="hover:text-slate-900 whitespace-nowrap shrink-0">Home</a>
            <a href="product.php" class="hover:text-slate-900 whitespace-nowrap shrink-0">Shop</a>
            <a href="order.php" class="hover:text-slate-900 whitespace-nowrap shrink-0">Orders</a>
            <a href="profile.php" class="hover:text-slate-900 whitespace-nowrap shrink-0">Profile</a>
        </nav>

        <div class="flex items-center gap-2 shrink-0">
            <?php if ($showSearch): ?>
            <form action="product.php" method="GET" class="hidden sm:flex items-center relative w-56 lg:w-72">
                <i class="fa-solid fa-magnifying-glass text-slate-400 text-xs absolute left-3.5 pointer-events-none"></i>
                <input type="text" name="q" value="<?= e($searchQuery) ?>" placeholder="Search products..."
                    class="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-100 text-sm text-slate-900 placeholder-slate-400 border border-transparent focus:border-orange-500 focus:bg-white focus:outline-none transition">
            </form>
            <?php endif; ?>

            <a href="cart.php" class="relative w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 transition" aria-label="Cart">
                <i class="fa-solid fa-bag-shopping text-lg"></i>
                <span id="headerCartBadge" class="<?= $cartCount > 0 ? '' : 'hidden' ?> absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    <?= $cartCount ?>
                </span>
            </a>
        </div>
    </div>

    <?php if ($showSearch): ?>
    <div class="sm:hidden px-4 pb-2.5">
        <form action="product.php" method="GET" class="relative flex items-center">
            <i class="fa-solid fa-magnifying-glass text-slate-400 text-xs absolute left-3.5 pointer-events-none"></i>
            <input type="text" name="q" value="<?= e($searchQuery) ?>" placeholder="Search essentials, audio, footwear..."
                class="w-full h-10 pl-9 pr-4 rounded-xl bg-slate-100 text-sm text-slate-900 placeholder-slate-400 border border-transparent focus:border-orange-500 focus:bg-white focus:outline-none transition">
        </form>
    </div>
    <?php endif; ?>
</header>

<!-- Square Animated Dotted Loading Modal -->
<div id="qkLoaderModal" class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-900/40 backdrop-blur-xs">
    <div class="w-28 h-28 rounded-2xl bg-white shadow-2xl border border-slate-100 flex flex-col items-center justify-center gap-3">
        <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-orange-600 qk-dot-1"></span>
            <span class="w-2.5 h-2.5 rounded-full bg-orange-600 qk-dot-2"></span>
            <span class="w-2.5 h-2.5 rounded-full bg-orange-600 qk-dot-3"></span>
        </div>
        <span id="qkLoaderText" class="text-[11px] font-semibold text-slate-600 tracking-wide">Loading...</span>
    </div>
</div>

<!-- Reusable Tailwind Notification / Confirm Modal -->
<div id="qkModal" class="fixed inset-0 z-50 hidden items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
    <div class="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 transform transition-all">
        <div class="flex items-start gap-3">
            <div id="qkModalIconWrap" class="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <i id="qkModalIcon" class="fa-solid fa-circle-info text-lg"></i>
            </div>
            <div class="min-w-0 flex-1">
                <h3 id="qkModalTitle" class="text-base font-bold text-slate-900">Notice</h3>
                <p id="qkModalMessage" class="mt-1 text-sm text-slate-600 leading-relaxed"></p>
            </div>
        </div>
        <div id="qkModalActions" class="mt-5 flex items-center justify-end gap-2">
            <button type="button" id="qkModalCancelBtn" class="hidden px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">Cancel</button>
            <button type="button" id="qkModalOkBtn" class="px-5 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition">OK</button>
        </div>
    </div>
</div>
