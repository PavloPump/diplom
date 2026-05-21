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

if ($_SESSION['user_role'] !== 'driver') {
    echo json_encode(['success' => false, 'message' => 'Только для водителей']);
    exit;
}

$action = $_POST['action'] ?? '';

if ($action === 'update_profile') {
    updateDriverProfile();
} else {
    echo json_encode(['success' => false, 'message' => 'Неверное действие']);
}

function updateDriverProfile() {
    global $conn;
    
    $user_id = $_SESSION['user_id'];
    $car_model = $_POST['car_model'] ?? '';
    $car_number = $_POST['car_number'] ?? '';
    $license_number = $_POST['license_number'] ?? '';
    
    $stmt = $conn->prepare("UPDATE drivers SET car_model = ?, car_number = ?, license_number = ? WHERE user_id = ?");
    $stmt->bind_param("sssi", $car_model, $car_number, $license_number, $user_id);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Профиль водителя обновлен']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка обновления профиля']);
    }
}
?>
