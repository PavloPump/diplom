<?php
header('Content-Type: application/json');
require_once '../config/database.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$action = $_POST['action'] ?? '';

if ($action === 'register') {
    register();
} elseif ($action === 'login') {
    login();
} elseif ($action === 'logout') {
    logout();
} else {
    echo json_encode(['success' => false, 'message' => 'Неверное действие']);
}

function register() {
    global $conn;
    
    $email = $_POST['email'] ?? '';
    $password = $_POST['password'] ?? '';
    $full_name = $_POST['full_name'] ?? '';
    $phone = $_POST['phone'] ?? '';
    $role = $_POST['role'] ?? 'client';
    
    if (!in_array($role, ['client', 'driver'])) {
        $role = 'client';
    }
    
    if (empty($email) || empty($password) || empty($full_name)) {
        echo json_encode(['success' => false, 'message' => 'Заполните все обязательные поля']);
        return;
    }
    
    // Проверка существования email
    $stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        echo json_encode(['success' => false, 'message' => 'Email уже зарегистрирован']);
        return;
    }
    
    // Хеширование пароля
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);
    
    // Вставка пользователя
    $stmt = $conn->prepare("INSERT INTO users (email, password, full_name, phone, role) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("sssss", $email, $hashed_password, $full_name, $phone, $role);
    
    if ($stmt->execute()) {
        $user_id = $conn->insert_id;
        
        // Если водитель, создаем запись в таблице drivers
        if ($role === 'driver') {
            $stmt = $conn->prepare("INSERT INTO drivers (user_id) VALUES (?)");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
        }
        
        echo json_encode(['success' => true, 'message' => 'Регистрация успешна']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка регистрации']);
    }
}

function login() {
    global $conn;
    
    $email = $_POST['email'] ?? '';
    $password = $_POST['password'] ?? '';
    
    if (empty($email) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Заполните все поля']);
        return;
    }
    
    $stmt = $conn->prepare("SELECT id, email, password, full_name, phone, role FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Неверный email или пароль']);
        return;
    }
    
    $user = $result->fetch_assoc();
    
    if (password_verify($password, $user['password'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_email'] = $user['email'];
        $_SESSION['user_name'] = $user['full_name'];
        $_SESSION['user_role'] = $user['role'];
        
        unset($user['password']);
        echo json_encode(['success' => true, 'message' => 'Вход выполнен', 'user' => $user]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Неверный email или пароль']);
    }
}

function logout() {
    session_destroy();
    echo json_encode(['success' => true, 'message' => 'Выход выполнен']);
}
?>
