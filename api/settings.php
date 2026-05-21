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

if ($action === 'change_password') {
    changePassword();
} elseif ($action === 'change_email') {
    changeEmail();
} elseif ($action === 'delete_account') {
    deleteAccount();
} else {
    echo json_encode(['success' => false, 'message' => 'Неверное действие']);
}

function changePassword() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    $current_password = $_POST['current_password'] ?? '';
    $new_password = $_POST['new_password'] ?? '';
    
    if (strlen($new_password) < 6) {
        echo json_encode(['success' => false, 'message' => 'Новый пароль должен быть не менее 6 символов']);
        return;
    }
    
    // Проверяем текущий пароль
    $stmt = $conn->prepare("SELECT password FROM users WHERE id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    
    if (!password_verify($current_password, $user['password'])) {
        echo json_encode(['success' => false, 'message' => 'Неверный текущий пароль']);
        return;
    }
    
    // Обновляем пароль
    $hashed = password_hash($new_password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?");
    $stmt->bind_param("si", $hashed, $user_id);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Пароль успешно изменен']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка при изменении пароля']);
    }
}

function changeEmail() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    $new_email = trim($_POST['new_email'] ?? '');
    $password = $_POST['password'] ?? '';
    
    if (!filter_var($new_email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Неверный формат email']);
        return;
    }
    
    // Проверяем пароль
    $stmt = $conn->prepare("SELECT password FROM users WHERE id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    
    if (!password_verify($password, $user['password'])) {
        echo json_encode(['success' => false, 'message' => 'Неверный пароль']);
        return;
    }
    
    // Проверяем, не занят ли email
    $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
    $stmt->bind_param("si", $new_email, $user_id);
    $stmt->execute();
    
    if ($stmt->get_result()->num_rows > 0) {
        echo json_encode(['success' => false, 'message' => 'Этот email уже используется']);
        return;
    }
    
    // Обновляем email
    $stmt = $conn->prepare("UPDATE users SET email = ?, updated_at = NOW() WHERE id = ?");
    $stmt->bind_param("si", $new_email, $user_id);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Email успешно изменен']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка при изменении email']);
    }
}

function deleteAccount() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    $password = $_POST['password'] ?? '';
    
    // Проверяем пароль
    $stmt = $conn->prepare("SELECT password, role FROM users WHERE id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    
    if (!password_verify($password, $user['password'])) {
        echo json_encode(['success' => false, 'message' => 'Неверный пароль']);
        return;
    }
    
    if ($user['role'] === 'admin') {
        echo json_encode(['success' => false, 'message' => 'Нельзя удалить аккаунт администратора']);
        return;
    }
    
    // Удаляем аккаунт
    $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
    $stmt->bind_param("i", $user_id);
    
    if ($stmt->execute()) {
        session_destroy();
        echo json_encode(['success' => true, 'message' => 'Аккаунт успешно удален']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка при удалении аккаунта']);
    }
}
?>
