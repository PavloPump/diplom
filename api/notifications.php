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

$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($action === 'list') {
    listNotifications();
} elseif ($action === 'mark_read') {
    markAsRead();
} elseif ($action === 'mark_all_read') {
    markAllAsRead();
} elseif ($action === 'delete') {
    deleteNotification();
} elseif ($action === 'count_unread') {
    countUnread();
} else {
    echo json_encode(['success' => false, 'message' => 'Неверное действие']);
}

function listNotifications() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    
    $stmt = $conn->prepare(
        "SELECT id, title, message, is_read, created_at 
         FROM notifications 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT 50"
    );
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $notifications = [];
    while ($row = $result->fetch_assoc()) {
        $notifications[] = $row;
    }
    
    echo json_encode(['success' => true, 'notifications' => $notifications]);
}

function markAsRead() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    $notification_id = intval($_POST['notification_id'] ?? 0);
    
    $stmt = $conn->prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?");
    $stmt->bind_param("ii", $notification_id, $user_id);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Отмечено как прочитанное']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка обновления']);
    }
}

function markAllAsRead() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    
    $stmt = $conn->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0");
    $stmt->bind_param("i", $user_id);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Все уведомления отмечены как прочитанные']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка обновления']);
    }
}

function deleteNotification() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    $notification_id = intval($_POST['notification_id'] ?? 0);
    
    $stmt = $conn->prepare("DELETE FROM notifications WHERE id = ? AND user_id = ?");
    $stmt->bind_param("ii", $notification_id, $user_id);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Уведомление удалено']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка удаления']);
    }
}

function countUnread() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    
    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    
    echo json_encode(['success' => true, 'count' => (int)$row['count']]);
}
?>
