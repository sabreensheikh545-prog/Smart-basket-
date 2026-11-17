<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$host = '127.0.0.1';
$user = 'root';
$pass = 'root';
$dbName = 'quick_kart';

$messages = [];
$hasError = false;

$conn = @new mysqli($host, $user, $pass);
if ($conn->connect_errno) {
    $hasError = true;
    $messages[] = 'MySQL connection failed: ' . $conn->connect_error;
} else {
    $conn->set_charset('utf8mb4');

    // 1. Create Database
    if ($conn->query("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")) {
        $messages[] = "Database `$dbName` ready.";
        $conn->select_db($dbName);
    } else {
        $hasError = true;
        $messages[] = 'Failed creating database: ' . $conn->error;
    }

    // 2. Create Required Tables
    $tablesSql = [
        "CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            phone VARCHAR(25) NOT NULL,
            email VARCHAR(160) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            address TEXT NULL,
            status ENUM('active','blocked') NOT NULL DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB",

        "CREATE TABLE IF NOT EXISTS admin (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL
        ) ENGINE=InnoDB",

        "CREATE TABLE IF NOT EXISTS categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            image VARCHAR(255) NOT NULL DEFAULT ''
        ) ENGINE=InnoDB",

        "CREATE TABLE IF NOT EXISTS products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            cat_id INT NOT NULL,
            name VARCHAR(180) NOT NULL,
            description TEXT NOT NULL,
            price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            stock INT NOT NULL DEFAULT 0,
            image VARCHAR(255) NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cat_id) REFERENCES categories(id) ON DELETE CASCADE
        ) ENGINE=InnoDB",

        "CREATE TABLE IF NOT EXISTS orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            name VARCHAR(120) NOT NULL DEFAULT '',
            phone VARCHAR(25) NOT NULL DEFAULT '',
            address TEXT NULL,
            total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            status ENUM('Placed','Dispatched','Delivered','Cancelled') NOT NULL DEFAULT 'Placed',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB",

        "CREATE TABLE IF NOT EXISTS order_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            product_id INT NOT NULL,
            quantity INT NOT NULL DEFAULT 1,
            price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        ) ENGINE=InnoDB"
    ];

    foreach ($tablesSql as $sql) {
        if (!$conn->query($sql)) {
            $hasError = true;
            $messages[] = 'Table creation error: ' . $conn->error;
        }
    }
    if (!$hasError) {
        $messages[] = 'All 6 database tables verified.';
    }

    // 3. Create Required Folders
    $folders = ['images', 'images/categories', 'images/products'];
    foreach ($folders as $dir) {
        if (!is_dir(__DIR__ . '/' . $dir)) {
            @mkdir(__DIR__ . '/' . $dir, 0775, true);
        }
    }
    $messages[] = 'Asset directories verified.';

    // 4. Insert Default Admin Credentials (Seraj / seraj123)
    $checkAdmin = $conn->query("SELECT id FROM admin WHERE username = 'Seraj' LIMIT 1");
    if ($checkAdmin && $checkAdmin->num_rows === 0) {
        $hashedAdminPass = password_hash('seraj123', PASSWORD_DEFAULT);
        $stmt = $conn->prepare("INSERT INTO admin (username, password) VALUES (?, ?)");
        $defaultUser = 'Seraj';
        $stmt->bind_param('ss', $defaultUser, $hashedAdminPass);
        $stmt->execute();
        $stmt->close();
        $messages[] = 'Default admin inserted (Seraj / seraj123).';
    }

    // 5. Seed Sample Categories & Products if Empty
    $catCountRes = $conn->query("SELECT COUNT(*) AS cnt FROM categories");
    $catCount = $catCountRes ? (int)$catCountRes->fetch_assoc()['cnt'] : 0;
    if ($catCount === 0) {
        $categories = [
            ['Audio', 'images/categories/audio.jpg'],
            ['Wearables', 'images/categories/wearables.jpg'],
            ['Footwear', 'images/categories/footwear.jpg'],
            ['Carry', 'images/categories/carry.jpg'],
            ['Lifestyle', 'images/categories/lifestyle.jpg']
        ];
        $catIds = [];
        $stmtCat = $conn->prepare("INSERT INTO categories (name, image) VALUES (?, ?)");
        foreach ($categories as $cat) {
            $stmtCat->bind_param('ss', $cat[0], $cat[1]);
            $stmtCat->execute();
            $catIds[$cat[0]] = $stmtCat->insert_id;
        }
        $stmtCat->close();

        $products = [
            [$catIds['Audio'], 'Aura ANC Wireless Earbuds', 'Active noise cancelling earbuds with 36-hour charging case, dual-mic clarity, and IPX5 sweat resistance.', 2999.00, 28, 'images/products/earbuds.jpg'],
            [$catIds['Wearables'], 'Titan Pulse Smartwatch', 'Brushed titanium alloy bezel, AMOLED always-on display, SpO2 & heart rate tracking with 10-day battery.', 6499.00, 15, 'images/products/smartwatch.jpg'],
            [$catIds['Footwear'], 'Stride Knit Running Shoes', 'Breathable engineered fly-knit upper with responsive dual-density EVA cushioning for daily runs.', 3499.00, 22, 'images/products/sneakers.jpg'],
            [$catIds['Carry'], 'Nomad Weatherproof Backpack', '20L urban commuter backpack in ballistic matte canvas with padded 16-inch laptop sleeve and YKK zippers.', 2799.00, 18, 'images/products/backpack.jpg'],
            [$catIds['Lifestyle'], 'Rivers Insulated Steel Flask', 'Double-wall vacuum insulated 750ml stainless steel flask keeps drinks cold for 24h or hot for 12h.', 1199.00, 40, 'images/products/flask.jpg'],
            [$catIds['Audio'], 'Aura Studio Over-Ear Headphones', 'Low-latency wireless studio headphones with plush memory foam cushions and USB-C fast charging.', 4999.00, 12, 'images/hero.jpg']
        ];
        $stmtProd = $conn->prepare("INSERT INTO products (cat_id, name, description, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)");
        foreach ($products as $p) {
            $stmtProd->bind_param('issdis', $p[0], $p[1], $p[2], $p[3], $p[4], $p[5]);
            $stmtProd->execute();
        }
        $stmtProd->close();
        $messages[] = 'Sample categories and products seeded.';
    }

    // 6. Seed Demo Customer & Sample Order if Empty
    $userCountRes = $conn->query("SELECT COUNT(*) AS cnt FROM users");
    $userCount = $userCountRes ? (int)$userCountRes->fetch_assoc()['cnt'] : 0;
    if ($userCount === 0) {
        $demoPass = password_hash('demo1234', PASSWORD_DEFAULT);
        $stmtUser = $conn->prepare("INSERT INTO users (name, phone, email, password, address) VALUES (?, ?, ?, ?, ?)");
        $uName = 'Aarav Sharma';
        $uPhone = '9876543210';
        $uEmail = 'aarav@quickkart.in';
        $uAddr = '402 Indiranagar 100ft Road, Bengaluru, Karnataka 560038';
        $stmtUser->bind_param('sssss', $uName, $uPhone, $uEmail, $demoPass, $uAddr);
        $stmtUser->execute();
        $demoUserId = $stmtUser->insert_id;
        $stmtUser->close();

        $firstProd = $conn->query("SELECT id, price FROM products LIMIT 1")->fetch_assoc();
        if ($firstProd) {
            $stmtOrd = $conn->prepare("INSERT INTO orders (user_id, name, phone, address, total_amount, status) VALUES (?, ?, ?, ?, ?, 'Dispatched')");
            $stmtOrd->bind_param('isssd', $demoUserId, $uName, $uPhone, $uAddr, $firstProd['price']);
            $stmtOrd->execute();
            $ordId = $stmtOrd->insert_id;
            $stmtOrd->close();

            $stmtItem = $conn->prepare("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, 1, ?)");
            $stmtItem->bind_param('iid', $ordId, $firstProd['id'], $firstProd['price']);
            $stmtItem->execute();
            $stmtItem->close();
        }
        $messages[] = 'Demo customer account created (aarav@quickkart.in / demo1234).';
    }
}

if (!$hasError && isset($_GET['redirect']) && $_GET['redirect'] === '1') {
    header('Location: login.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Install — Quick Kart</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <?php if (!$hasError): ?>
    <meta http-equiv="refresh" content="2;url=login.php">
    <?php endif; ?>
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen flex items-center justify-center p-4 select-none">
    <div class="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
        <div class="flex items-center gap-3 mb-5">
            <span class="w-10 h-10 rounded-xl <?= $hasError ? 'bg-rose-600' : 'bg-orange-600' ?> text-white flex items-center justify-center">
                <i class="fa-solid <?= $hasError ? 'fa-triangle-exclamation' : 'fa-bolt' ?>"></i>
            </span>
            <div>
                <h1 class="text-lg font-bold text-slate-900">Quick Kart Installer</h1>
                <p class="text-xs text-slate-500">Database &amp; Directory Setup</p>
            </div>
        </div>
        <ul class="space-y-2 text-sm">
            <?php foreach ($messages as $msg): ?>
            <li class="flex items-start gap-2.5 text-slate-700">
                <i class="fa-solid <?= $hasError ? 'fa-circle-xmark text-rose-500' : 'fa-circle-check text-emerald-600' ?> mt-0.5"></i>
                <span><?= htmlspecialchars($msg) ?></span>
            </li>
            <?php endforeach; ?>
        </ul>
        <div class="mt-6">
            <?php if (!$hasError): ?>
                <p class="text-xs text-slate-500 mb-3">Redirecting to login page automatically...</p>
                <a href="login.php" class="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 transition">
                    <span>Continue to Login</span>
                    <i class="fa-solid fa-arrow-right"></i>
                </a>
            <?php else: ?>
                <a href="install.php" class="w-full py-2.5 px-4 rounded-xl bg-rose-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-rose-700 transition">
                    <i class="fa-solid fa-rotate-right"></i>
                    <span>Retry Setup</span>
                </a>
            <?php endif; ?>
        </div>
    </div>
</body>
</html>
