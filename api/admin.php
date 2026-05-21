<?php
header('Content-Type: application/json');
require_once '../config/database.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Требуется авторизация']);
    exit;
}

if ($_SESSION['user_role'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Только для администраторов']);
    exit;
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($action === 'list_users') {
    listUsers();
} elseif ($action === 'delete_user') {
    deleteUser();
} elseif ($action === 'update_user_role') {
    updateUserRole();
} elseif ($action === 'stats') {
    getStats();
} else {
    echo json_encode(['success' => false, 'message' => 'Неверное действие']);
}

function listUsers() {
    global $conn;
    $result = $conn->query(
        "SELECT u.id, u.email, u.full_name, u.phone, u.role, u.created_at,
                d.car_model, d.car_number, d.status AS driver_status, d.rating
         FROM users u
         LEFT JOIN drivers d ON d.user_id = u.id
         ORDER BY u.created_at DESC"
    );
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }
    echo json_encode(['success' => true, 'users' => $users]);
}

function deleteUser() {
    global $conn;
    $user_id = intval($_POST['user_id'] ?? 0);

    if ($user_id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Неверный ID пользователя']);
        return;
    }

    if ($user_id === (int)$_SESSION['user_id']) {
        echo json_encode(['success' => false, 'message' => 'Нельзя удалить собственный аккаунт']);
        return;
    }

    $stmt = $conn->prepare("DELETE FROM users WHERE id = ? AND role != 'admin'");
    $stmt->bind_param("i", $user_id);

    if ($stmt->execute() && $stmt->affected_rows > 0) {
        echo json_encode(['success' => true, 'message' => 'Пользователь удалён']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Не удалось удалить пользователя']);
    }
}

function updateUserRole() {
    global $conn;
    $user_id = intval($_POST['user_id'] ?? 0);
    $role    = $_POST['role'] ?? '';

    if (!in_array($role, ['client', 'driver', 'admin'])) {
        echo json_encode(['success' => false, 'message' => 'Неверная роль']);
        return;
    }

    if ($user_id === (int)$_SESSION['user_id']) {
        echo json_encode(['success' => false, 'message' => 'Нельзя изменить собственную роль']);
        return;
    }

    $stmt = $conn->prepare("UPDATE users SET role = ? WHERE id = ?");
    $stmt->bind_param("si", $role, $user_id);

    if ($stmt->execute()) {
        if ($role === 'driver') {
            $chk = $conn->prepare("SELECT id FROM drivers WHERE user_id = ?");
            $chk->bind_param("i", $user_id);
            $chk->execute();
            if ($chk->get_result()->num_rows === 0) {
                $ins = $conn->prepare("INSERT INTO drivers (user_id) VALUES (?)");
                $ins->bind_param("i", $user_id);
                $ins->execute();
            }
        }
        echo json_encode(['success' => true, 'message' => 'Роль обновлена']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка обновления роли']);
    }
}

function getStats() {
    global $conn;
    $stats = [];

    $r = $conn->query("SELECT COUNT(*) AS cnt FROM users WHERE role='client'");
    $stats['clients'] = (int)$r->fetch_assoc()['cnt'];

    $r = $conn->query("SELECT COUNT(*) AS cnt FROM users WHERE role='driver'");
    $stats['drivers'] = (int)$r->fetch_assoc()['cnt'];

    $r = $conn->query("SELECT COUNT(*) AS cnt FROM orders");
    $stats['orders_total'] = (int)$r->fetch_assoc()['cnt'];

    $r = $conn->query("SELECT COUNT(*) AS cnt FROM orders WHERE status='pending'");
    $stats['orders_pending'] = (int)$r->fetch_assoc()['cnt'];

    $r = $conn->query("SELECT COUNT(*) AS cnt FROM orders WHERE status='in_progress'");
    $stats['orders_in_progress'] = (int)$r->fetch_assoc()['cnt'];

    $r = $conn->query("SELECT COUNT(*) AS cnt FROM orders WHERE status='delivered'");
    $stats['orders_delivered'] = (int)$r->fetch_assoc()['cnt'];

    $r = $conn->query("SELECT COUNT(*) AS cnt FROM orders WHERE status='cancelled'");
    $stats['orders_cancelled'] = (int)$r->fetch_assoc()['cnt'];

    $r = $conn->query("SELECT COALESCE(SUM(price),0) AS total FROM orders WHERE status='delivered'");
    $stats['revenue'] = (float)$r->fetch_assoc()['total'];

    $r = $conn->query("SELECT COALESCE(AVG(price),0) AS avg FROM orders WHERE status='delivered'");
    $stats['avg_order_value'] = (float)$r->fetch_assoc()['avg'];

    $r = $conn->query("SELECT DATE(created_at) as date, COUNT(*) as count FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY DATE(created_at) ORDER BY date");
    $stats['orders_by_day'] = [];
    while ($row = $r->fetch_assoc()) {
        $stats['orders_by_day'][] = $row;
    }

    $r = $conn->query("SELECT status, COUNT(*) as count FROM orders GROUP BY status");
    $stats['orders_by_status'] = [];
    while ($row = $r->fetch_assoc()) {
        $stats['orders_by_status'][] = $row;
    }

    $r = $conn->query("SELECT u.full_name, COUNT(o.id) as order_count, COALESCE(SUM(o.price),0) as total_revenue FROM users u INNER JOIN orders o ON o.driver_id = u.id WHERE o.status='delivered' GROUP BY u.id ORDER BY total_revenue DESC LIMIT 5");
    $stats['top_drivers'] = [];
    while ($row = $r->fetch_assoc()) {
        $stats['top_drivers'][] = $row;
    }

    echo json_encode(['success' => true, 'stats' => $stats]);
}
?>
