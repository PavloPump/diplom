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

    $r = $conn->query("SELECT COUNT(*) AS cnt FROM orders WHERE status='delivered'");
    $stats['orders_delivered'] = (int)$r->fetch_assoc()['cnt'];

    $r = $conn->query("SELECT COALESCE(SUM(price),0) AS total FROM orders WHERE status='delivered'");
    $stats['revenue'] = (float)$r->fetch_assoc()['total'];

    echo json_encode(['success' => true, 'stats' => $stats]);
}
?>
