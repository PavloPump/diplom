<?php
header('Content-Type: application/json');
require_once '../config/database.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($action === 'get_profile') {
    getProfile();
} elseif ($action === 'update_profile') {
    updateProfile();
} elseif ($action === 'check_auth') {
    checkAuth();
} else {
    echo json_encode(['success' => false, 'message' => 'Неверное действие']);
}

function checkAuth() {
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            'success' => true, 
            'authenticated' => true,
            'user' => [
                'id' => $_SESSION['user_id'],
                'email' => $_SESSION['user_email'],
                'full_name' => $_SESSION['user_name'],
                'role' => $_SESSION['user_role']
            ]
        ]);
    } else {
        echo json_encode(['success' => true, 'authenticated' => false]);
    }
}

function getProfile() {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Требуется авторизация']);
        return;
    }
    
    $user_id = $_SESSION['user_id'];
    
    $stmt = $conn->prepare("SELECT id, email, full_name, phone, role, created_at FROM users WHERE id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Пользователь не найден']);
        return;
    }
    
    $user = $result->fetch_assoc();
    
    // Если водитель, получаем дополнительную информацию
    if ($user['role'] === 'driver') {
        $stmt = $conn->prepare("SELECT * FROM drivers WHERE user_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $driver_result = $stmt->get_result();
        
        if ($driver_result->num_rows > 0) {
            $user['driver_info'] = $driver_result->fetch_assoc();
        }
    }
    
    echo json_encode(['success' => true, 'user' => $user]);
}

function updateProfile() {
    global $conn;
    
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Требуется авторизация']);
        return;
    }
    
    $user_id = $_SESSION['user_id'];
    $full_name = $_POST['full_name'] ?? '';
    $phone = $_POST['phone'] ?? '';
    
    if (empty($full_name)) {
        echo json_encode(['success' => false, 'message' => 'Заполните имя']);
        return;
    }
    
    $stmt = $conn->prepare("UPDATE users SET full_name = ?, phone = ? WHERE id = ?");
    $stmt->bind_param("ssi", $full_name, $phone, $user_id);
    
    if ($stmt->execute()) {
        $_SESSION['user_name'] = $full_name;
        echo json_encode(['success' => true, 'message' => 'Профиль обновлен']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка обновления профиля']);
    }
}
?>
