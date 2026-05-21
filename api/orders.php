<?php
header('Content-Type: application/json');
require_once '../config/database.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Проверка авторизации
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Требуется авторизация']);
    exit;
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($action === 'create') {
    createOrder();
} elseif ($action === 'list') {
    listOrders();
} elseif ($action === 'accept') {
    acceptOrder();
} elseif ($action === 'update_status') {
    updateOrderStatus();
} elseif ($action === 'get') {
    getOrder();
} elseif ($action === 'cancel') {
    cancelOrder();
} else {
    echo json_encode(['success' => false, 'message' => 'Неверное действие']);
}

function createOrder() {
    global $conn;
    
    $client_id = $_SESSION['user_id'];
    $pickup_address = $_POST['pickup_address'] ?? '';
    $delivery_address = $_POST['delivery_address'] ?? '';
    $cargo_description = $_POST['cargo_description'] ?? '';
    $cargo_weight = $_POST['cargo_weight'] ?? 0;
    $cargo_dimensions = $_POST['cargo_dimensions'] ?? '';
    $price = $_POST['price'] ?? 0;
    
    if (empty($pickup_address) || empty($delivery_address)) {
        echo json_encode(['success' => false, 'message' => 'Заполните адреса']);
        return;
    }
    
    $stmt = $conn->prepare("INSERT INTO orders (client_id, pickup_address, delivery_address, cargo_description, cargo_weight, cargo_dimensions, price) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("isssdsd", $client_id, $pickup_address, $delivery_address, $cargo_description, $cargo_weight, $cargo_dimensions, $price);
    
    if ($stmt->execute()) {
        $order_id = $conn->insert_id;
        
        // Добавляем запись в историю статусов
        $stmt = $conn->prepare("INSERT INTO order_status_history (order_id, status, comment) VALUES (?, 'pending', 'Заказ создан')");
        $stmt->bind_param("i", $order_id);
        $stmt->execute();
        
        echo json_encode(['success' => true, 'message' => 'Заказ создан', 'order_id' => $order_id]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка создания заказа']);
    }
}

function listOrders() {
    global $conn;
    
    $user_id = $_SESSION['user_id'];
    $user_role = $_SESSION['user_role'];
    
    if ($user_role === 'client') {
        $stmt = $conn->prepare("SELECT o.*, u.full_name as driver_name FROM orders o LEFT JOIN users u ON o.driver_id = u.id WHERE o.client_id = ? ORDER BY o.created_at DESC");
        $stmt->bind_param("i", $user_id);
    } elseif ($user_role === 'driver') {
        $stmt = $conn->prepare("SELECT o.*, u.full_name as client_name FROM orders o JOIN users u ON o.client_id = u.id WHERE o.status = 'pending' OR o.driver_id = ? ORDER BY o.created_at DESC");
        $stmt->bind_param("i", $user_id);
    } else {
        $stmt = $conn->prepare("SELECT o.*, u1.full_name as client_name, u2.full_name as driver_name FROM orders o LEFT JOIN users u1 ON o.client_id = u1.id LEFT JOIN users u2 ON o.driver_id = u2.id ORDER BY o.created_at DESC");
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    $orders = [];
    
    while ($row = $result->fetch_assoc()) {
        $orders[] = $row;
    }
    
    echo json_encode(['success' => true, 'orders' => $orders]);
}

function acceptOrder() {
    global $conn;
    
    $driver_id = $_SESSION['user_id'];
    $order_id = $_POST['order_id'] ?? 0;
    
    if ($_SESSION['user_role'] !== 'driver') {
        echo json_encode(['success' => false, 'message' => 'Только водители могут принимать заказы']);
        return;
    }

    if ($order_id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Неверный ID заказа']);
        return;
    }

    // Атомарный захват заказа: status='pending' AND driver_id IS NULL
    $stmt = $conn->prepare("UPDATE orders SET driver_id = ?, status = 'accepted' WHERE id = ? AND status = 'pending' AND driver_id IS NULL");
    $stmt->bind_param("ii", $driver_id, $order_id);
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Заказ уже принят другим водителем или не существует']);
        return;
    }

    // Обновление статуса водителя
    $stmt = $conn->prepare("UPDATE drivers SET status = 'busy' WHERE user_id = ?");
    $stmt->bind_param("i", $driver_id);
    $stmt->execute();

    // История статусов
    $stmt = $conn->prepare("INSERT INTO order_status_history (order_id, status, comment) VALUES (?, 'accepted', 'Заказ принят водителем')");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();

    echo json_encode(['success' => true, 'message' => 'Заказ принят']);
}

function cancelOrder() {
    global $conn;

    $order_id = intval($_POST['order_id'] ?? 0);
    $user_id  = $_SESSION['user_id'];
    $user_role = $_SESSION['user_role'];

    if ($user_role === 'client') {
        $stmt = $conn->prepare("SELECT id, driver_id FROM orders WHERE id = ? AND client_id = ? AND status = 'pending'");
        $stmt->bind_param("ii", $order_id, $user_id);
    } elseif ($user_role === 'admin') {
        $stmt = $conn->prepare("SELECT id, driver_id FROM orders WHERE id = ? AND status NOT IN ('delivered','cancelled')");
        $stmt->bind_param("i", $order_id);
    } else {
        echo json_encode(['success' => false, 'message' => 'Нет доступа']);
        return;
    }

    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Невозможно отменить заказ']);
        return;
    }

    $order = $result->fetch_assoc();

    $stmt = $conn->prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?");
    $stmt->bind_param("i", $order_id);

    if ($stmt->execute()) {
        if ($order['driver_id']) {
            $stmt2 = $conn->prepare("UPDATE drivers SET status = 'available' WHERE user_id = ?");
            $stmt2->bind_param("i", $order['driver_id']);
            $stmt2->execute();
        }
        $stmt3 = $conn->prepare("INSERT INTO order_status_history (order_id, status, comment) VALUES (?, 'cancelled', 'Заказ отменён')");
        $stmt3->bind_param("i", $order_id);
        $stmt3->execute();
        echo json_encode(['success' => true, 'message' => 'Заказ отменён']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка отмены заказа']);
    }
}

function updateOrderStatus() {
    global $conn;
    
    $order_id  = intval($_POST['order_id'] ?? 0);
    $status    = $_POST['status'] ?? '';
    $comment   = $_POST['comment'] ?? '';
    $user_id   = $_SESSION['user_id'];
    $user_role = $_SESSION['user_role'];
    
    if (!in_array($status, ['pending', 'accepted', 'in_progress', 'delivered', 'cancelled'])) {
        echo json_encode(['success' => false, 'message' => 'Неверный статус']);
        return;
    }

    if ($user_role === 'driver') {
        $chk = $conn->prepare("SELECT id FROM orders WHERE id = ? AND driver_id = ?");
        $chk->bind_param("ii", $order_id, $user_id);
        $chk->execute();
        if ($chk->get_result()->num_rows === 0) {
            echo json_encode(['success' => false, 'message' => 'Нет доступа к заказу']);
            return;
        }
    } elseif ($user_role !== 'admin') {
        echo json_encode(['success' => false, 'message' => 'Нет доступа']);
        return;
    }
    
    $stmt = $conn->prepare("UPDATE orders SET status = ? WHERE id = ?");
    $stmt->bind_param("si", $status, $order_id);
    
    if ($stmt->execute()) {
        // Если статус delivered, освобождаем водителя
        if ($status === 'delivered' || $status === 'cancelled') {
            $stmt = $conn->prepare("SELECT driver_id FROM orders WHERE id = ?");
            $stmt->bind_param("i", $order_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $order = $result->fetch_assoc();
            
            if ($order['driver_id']) {
                $stmt = $conn->prepare("UPDATE drivers SET status = 'available' WHERE user_id = ?");
                $stmt->bind_param("i", $order['driver_id']);
                $stmt->execute();
            }
        }
        
        // История статусов
        $stmt = $conn->prepare("INSERT INTO order_status_history (order_id, status, comment) VALUES (?, ?, ?)");
        $stmt->bind_param("iss", $order_id, $status, $comment);
        $stmt->execute();
        
        echo json_encode(['success' => true, 'message' => 'Статус обновлен']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка обновления статуса']);
    }
}

function getOrder() {
    global $conn;
    
    $order_id = intval($_GET['order_id'] ?? 0);
    $user_id  = $_SESSION['user_id'];
    $user_role = $_SESSION['user_role'];
    
    $stmt = $conn->prepare("SELECT o.*, u1.full_name as client_name, u2.full_name as driver_name FROM orders o LEFT JOIN users u1 ON o.client_id = u1.id LEFT JOIN users u2 ON o.driver_id = u2.id WHERE o.id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Заказ не найден']);
        return;
    }
    
    $order = $result->fetch_assoc();
    
    if ($user_role !== 'admin' && (int)$order['client_id'] !== (int)$user_id && (int)$order['driver_id'] !== (int)$user_id) {
        echo json_encode(['success' => false, 'message' => 'Нет доступа к заказу']);
        return;
    }
    
    echo json_encode(['success' => true, 'order' => $order]);
}
?>
