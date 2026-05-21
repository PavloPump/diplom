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

if ($action === 'create') {
    createReview();
} elseif ($action === 'list') {
    listReviews();
} elseif ($action === 'get_for_order') {
    getReviewForOrder();
} elseif ($action === 'can_review') {
    canReview();
} else {
    echo json_encode(['success' => false, 'message' => 'Неверное действие']);
}

function createReview() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    $order_id = intval($_POST['order_id'] ?? 0);
    $to_user_id = intval($_POST['to_user_id'] ?? 0);
    $rating = intval($_POST['rating'] ?? 0);
    $comment = trim($_POST['comment'] ?? '');
    
    if ($order_id <= 0 || $to_user_id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Неверные параметры']);
        return;
    }
    
    if ($rating < 1 || $rating > 5) {
        echo json_encode(['success' => false, 'message' => 'Рейтинг должен быть от 1 до 5']);
        return;
    }
    
    // Проверяем, что заказ завершен
    $stmt = $conn->prepare("SELECT status, client_id, driver_id FROM orders WHERE id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $order = $stmt->get_result()->fetch_assoc();
    
    if (!$order || $order['status'] !== 'delivered') {
        echo json_encode(['success' => false, 'message' => 'Можно оценить только завершенные заказы']);
        return;
    }
    
    // Только клиент может оставлять отзыв на водителя
    if ($user_id != $order['client_id']) {
        echo json_encode(['success' => false, 'message' => 'Только клиент может оставить отзыв']);
        return;
    }
    
    // Проверяем, что отзыв еще не оставлен
    $stmt = $conn->prepare("SELECT id FROM reviews WHERE order_id = ? AND from_user_id = ?");
    $stmt->bind_param("ii", $order_id, $user_id);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        echo json_encode(['success' => false, 'message' => 'Вы уже оставили отзыв на этот заказ']);
        return;
    }
    
    // Создаем отзыв
    $stmt = $conn->prepare("INSERT INTO reviews (order_id, from_user_id, to_user_id, rating, comment) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("iiiis", $order_id, $user_id, $to_user_id, $rating, $comment);
    
    if ($stmt->execute()) {
        // Обновляем рейтинг водителя
        updateDriverRating($to_user_id);
        
        // Создаем уведомление
        $stmt = $conn->prepare("INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)");
        $title = "Новый отзыв";
        $message = "Вы получили новый отзыв с оценкой $rating звезд";
        $stmt->bind_param("iss", $to_user_id, $title, $message);
        $stmt->execute();
        
        echo json_encode(['success' => true, 'message' => 'Отзыв успешно добавлен']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка при создании отзыва']);
    }
}

function updateDriverRating($user_id) {
    global $conn;
    
    // Вычисляем средний рейтинг
    $stmt = $conn->prepare("SELECT AVG(rating) as avg_rating FROM reviews WHERE to_user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $avg_rating = round($result['avg_rating'], 2);
    
    // Обновляем рейтинг в таблице водителей
    $stmt = $conn->prepare("UPDATE drivers SET rating = ? WHERE user_id = ?");
    $stmt->bind_param("di", $avg_rating, $user_id);
    $stmt->execute();
}

function listReviews() {
    global $conn;
    $user_id = intval($_GET['user_id'] ?? 0);
    
    if ($user_id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Неверный ID пользователя']);
        return;
    }
    
    $stmt = $conn->prepare(
        "SELECT r.*, u.full_name as from_user_name, o.id as order_id 
         FROM reviews r 
         JOIN users u ON r.from_user_id = u.id 
         JOIN orders o ON r.order_id = o.id 
         WHERE r.to_user_id = ? 
         ORDER BY r.created_at DESC 
         LIMIT 50"
    );
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $reviews = [];
    while ($row = $result->fetch_assoc()) {
        $reviews[] = $row;
    }
    
    echo json_encode(['success' => true, 'reviews' => $reviews]);
}

function getReviewForOrder() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    $order_id = intval($_GET['order_id'] ?? 0);
    
    $stmt = $conn->prepare("SELECT * FROM reviews WHERE order_id = ? AND from_user_id = ?");
    $stmt->bind_param("ii", $order_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        echo json_encode(['success' => true, 'review' => $result->fetch_assoc()]);
    } else {
        echo json_encode(['success' => true, 'review' => null]);
    }
}

function canReview() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    $order_id = intval($_GET['order_id'] ?? 0);
    
    // Проверяем статус заказа
    $stmt = $conn->prepare("SELECT status, client_id, driver_id FROM orders WHERE id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $order = $stmt->get_result()->fetch_assoc();
    
    if (!$order) {
        echo json_encode(['success' => false, 'can_review' => false, 'message' => 'Заказ не найден']);
        return;
    }
    
    if ($order['status'] !== 'delivered') {
        echo json_encode(['success' => true, 'can_review' => false, 'message' => 'Заказ еще не завершен']);
        return;
    }
    
    // Только клиент может оставлять отзыв на водителя
    if ($user_id != $order['client_id']) {
        echo json_encode(['success' => true, 'can_review' => false, 'message' => 'Только клиент может оставить отзыв']);
        return;
    }
    
    // Проверяем, оставлен ли уже отзыв
    $stmt = $conn->prepare("SELECT id FROM reviews WHERE order_id = ? AND from_user_id = ?");
    $stmt->bind_param("ii", $order_id, $user_id);
    $stmt->execute();
    
    if ($stmt->get_result()->num_rows > 0) {
        echo json_encode(['success' => true, 'can_review' => false, 'message' => 'Вы уже оставили отзыв']);
        return;
    }
    
    // Клиент оценивает водителя
    $to_user_id = $order['driver_id'];
    
    echo json_encode(['success' => true, 'can_review' => true, 'to_user_id' => $to_user_id]);
}
?>
