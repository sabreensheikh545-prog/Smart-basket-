<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

define('DB_HOST', '127.0.0.1');
define('DB_USER', 'root');
define('DB_PASS', 'root');
define('DB_NAME', 'quick_kart');

mysqli_report(MYSQLI_REPORT_OFF);
$conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_errno) {
    $currentScript = basename($_SERVER['PHP_SELF'] ?? '');
    if ($currentScript !== 'install.php') {
        $inAdmin = strpos(str_replace('\\', '/', $_SERVER['PHP_SELF'] ?? ''), '/admin/') !== false;
        $installUrl = $inAdmin ? '../install.php' : 'install.php';
        header('Location: ' . $installUrl);
        exit;
    }
} else {
    $conn->set_charset('utf8mb4');
}

function e($value): string {
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function formatINR($amount): string {
    return '₹' . number_format((float)$amount, 2, '.', ',');
}

function jsonResponse(bool $success, string $message, array $data = []): void {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array_merge([
        'success' => $success,
        'message' => $message,
    ], $data));
    exit;
}

function isUserLoggedIn(): bool {
    return isset($_SESSION['user_id']) && (int)$_SESSION['user_id'] > 0;
}

function isAdminLoggedIn(): bool {
    return isset($_SESSION['admin_id']) && (int)$_SESSION['admin_id'] > 0;
}

function getCurrentUser(mysqli $conn): ?array {
    if (!isUserLoggedIn()) {
        return null;
    }
    $uid = (int)$_SESSION['user_id'];
    $stmt = $conn->prepare('SELECT id, name, phone, email, address, status, created_at FROM users WHERE id = ? LIMIT 1');
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $res = $stmt->get_result();
    $user = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$user || (isset($user['status']) && $user['status'] === 'blocked')) {
        unset($_SESSION['user_id'], $_SESSION['user_name']);
        return null;
    }
    return $user;
}

function getCartCount(): int {
    if (!isset($_SESSION['cart']) || !is_array($_SESSION['cart'])) {
        return 0;
    }
    return (int)array_sum($_SESSION['cart']);
}
?>
