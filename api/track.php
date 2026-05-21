<?php
header('Content-Type: application/json');
require_once '../config/database.php';

$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($action === 'track_order') {
    trackOrder();
} else {
    echo json_encode(['success' => false, 'message' => 'Неверное действие']);
}

function trackOrder() {
    global $conn;
    
    $order_id = intval($_POST['order_id'] ?? $_GET['order_id'] ?? 0);
    
    if ($order_id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Укажите номер заказа']);
        return;
    }
    
    // Получаем информацию о заказе
    $stmt = $conn->prepare("
        SELECT 
            o.id,
            o.pickup_address,
            o.delivery_address,
            o.pickup_lat,
            o.pickup_lng,
            o.delivery_lat,
            o.delivery_lng,
            o.cargo_description,
            o.cargo_weight,
            o.cargo_dimensions,
            o.price,
            o.status,
            o.created_at,
            o.updated_at,
            u_driver.full_name as driver_name,
            u_driver.phone as driver_phone,
            d.car_model,
            d.car_number
        FROM orders o
        LEFT JOIN users u_driver ON o.driver_id = u_driver.id
        LEFT JOIN drivers d ON u_driver.id = d.user_id
        WHERE o.id = ?
    ");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Заказ не найден']);
        return;
    }
    
    $order = $result->fetch_assoc();
    
    // Получаем историю статусов
    $stmt = $conn->prepare("
        SELECT status, comment, created_at 
        FROM order_status_history 
        WHERE order_id = ? 
        ORDER BY created_at ASC
    ");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $history_result = $stmt->get_result();
    
    $history = [];
    while ($row = $history_result->fetch_assoc()) {
        $history[] = $row;
    }
    
    $order['history'] = $history;
    
    echo json_encode(['success' => true, 'order' => $order]);
}
?>
