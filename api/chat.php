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

if ($action === 'get_or_create_chat') {
    getOrCreateChat();
} elseif ($action === 'get_chats') {
    getChats();
} elseif ($action === 'get_messages') {
    getMessages();
} elseif ($action === 'send_message') {
    sendMessage();
} elseif ($action === 'mark_read') {
    markRead();
} elseif ($action === 'get_unread_count') {
    getUnreadCount();
} else {
    echo json_encode(['success' => false, 'message' => 'Неверное действие']);
}

function getOrCreateChat() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    $type = $_POST['type'] ?? '';
    $order_id = isset($_POST['order_id']) ? intval($_POST['order_id']) : null;
    $participant_id = isset($_POST['participant_id']) ? intval($_POST['participant_id']) : null;
    
    if ($type === 'order' && $order_id) {
        // Чат по заказу (клиент-водитель)
        $stmt = $conn->prepare("SELECT * FROM chats WHERE type = 'order' AND order_id = ?");
        $stmt->bind_param("i", $order_id);
        $stmt->execute();
        $chat = $stmt->get_result()->fetch_assoc();
        
        if (!$chat) {
            // Получаем участников заказа
            $stmt = $conn->prepare("SELECT client_id, driver_id FROM orders WHERE id = ?");
            $stmt->bind_param("i", $order_id);
            $stmt->execute();
            $order = $stmt->get_result()->fetch_assoc();
            
            if ($order && $order['driver_id']) {
                $stmt = $conn->prepare("INSERT INTO chats (type, order_id, participant1_id, participant2_id) VALUES ('order', ?, ?, ?)");
                $stmt->bind_param("iii", $order_id, $order['client_id'], $order['driver_id']);
                $stmt->execute();
                $chat_id = $conn->insert_id;
                
                $stmt = $conn->prepare("SELECT * FROM chats WHERE id = ?");
                $stmt->bind_param("i", $chat_id);
                $stmt->execute();
                $chat = $stmt->get_result()->fetch_assoc();
            }
        }
    } elseif ($type === 'support') {
        // Чат с поддержкой
        $stmt = $conn->prepare("SELECT * FROM chats WHERE type = 'support' AND participant1_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $chat = $stmt->get_result()->fetch_assoc();
        
        if (!$chat) {
            // Получаем первого админа
            $admin = $conn->query("SELECT id FROM users WHERE role = 'admin' LIMIT 1")->fetch_assoc();
            
            if ($admin) {
                $stmt = $conn->prepare("INSERT INTO chats (type, participant1_id, participant2_id) VALUES ('support', ?, ?)");
                $stmt->bind_param("ii", $user_id, $admin['id']);
                $stmt->execute();
                $chat_id = $conn->insert_id;
                
                $stmt = $conn->prepare("SELECT * FROM chats WHERE id = ?");
                $stmt->bind_param("i", $chat_id);
                $stmt->execute();
                $chat = $stmt->get_result()->fetch_assoc();
            }
        }
    }
    
    if ($chat) {
        echo json_encode(['success' => true, 'chat' => $chat]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Не удалось создать чат']);
    }
}

function getChats() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    
    $stmt = $conn->prepare("
        SELECT c.*, 
               u1.full_name as participant1_name,
               u2.full_name as participant2_name,
               o.id as order_number,
               (SELECT COUNT(*) FROM messages WHERE chat_id = c.id AND sender_id != ? AND is_read = 0) as unread_count,
               (SELECT message FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
               (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
        FROM chats c
        LEFT JOIN users u1 ON c.participant1_id = u1.id
        LEFT JOIN users u2 ON c.participant2_id = u2.id
        LEFT JOIN orders o ON c.order_id = o.id
        WHERE c.participant1_id = ? OR c.participant2_id = ?
        ORDER BY c.updated_at DESC
    ");
    $stmt->bind_param("iii", $user_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $chats = [];
    while ($row = $result->fetch_assoc()) {
        $chats[] = $row;
    }
    
    echo json_encode(['success' => true, 'chats' => $chats]);
}

function getMessages() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    $chat_id = intval($_GET['chat_id'] ?? 0);
    
    // Проверяем доступ к чату
    $stmt = $conn->prepare("SELECT * FROM chats WHERE id = ? AND (participant1_id = ? OR participant2_id = ?)");
    $stmt->bind_param("iii", $chat_id, $user_id, $user_id);
    $stmt->execute();
    $chat = $stmt->get_result()->fetch_assoc();
    
    if (!$chat) {
        echo json_encode(['success' => false, 'message' => 'Доступ запрещен']);
        return;
    }
    
    $stmt = $conn->prepare("
        SELECT m.*, u.full_name as sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = ?
        ORDER BY m.created_at ASC
    ");
    $stmt->bind_param("i", $chat_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $messages = [];
    while ($row = $result->fetch_assoc()) {
        $messages[] = $row;
    }
    
    echo json_encode(['success' => true, 'messages' => $messages]);
}

function sendMessage() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    $chat_id = intval($_POST['chat_id'] ?? 0);
    $message = trim($_POST['message'] ?? '');
    $file_path = null;
    $file_name = null;
    $file_type = null;
    $file_size = null;
    
    // Проверяем доступ к чату
    $stmt = $conn->prepare("SELECT * FROM chats WHERE id = ? AND (participant1_id = ? OR participant2_id = ?)");
    $stmt->bind_param("iii", $chat_id, $user_id, $user_id);
    $stmt->execute();
    $chat = $stmt->get_result()->fetch_assoc();
    
    if (!$chat) {
        echo json_encode(['success' => false, 'message' => 'Доступ запрещен']);
        return;
    }
    
    // Обработка загрузки файла
    if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['file'];
        $max_size = 15 * 1024 * 1024; // 15MB
        
        if ($file['size'] > $max_size) {
            echo json_encode(['success' => false, 'message' => 'Файл слишком большой. Максимум 15MB']);
            return;
        }
        
        $allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 
                          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                          'text/plain', 'application/zip', 'application/x-rar-compressed'];
        
        if (!in_array($file['type'], $allowed_types)) {
            echo json_encode(['success' => false, 'message' => 'Недопустимый тип файла']);
            return;
        }
        
        // Создаем директорию для загрузок
        $upload_dir = '../uploads/chat/';
        if (!file_exists($upload_dir)) {
            mkdir($upload_dir, 0777, true);
        }
        
        // Генерируем уникальное имя файла
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $unique_name = uniqid() . '_' . time() . '.' . $extension;
        $target_path = $upload_dir . $unique_name;
        
        if (move_uploaded_file($file['tmp_name'], $target_path)) {
            $file_path = 'uploads/chat/' . $unique_name;
            $file_name = $file['name'];
            $file_type = $file['type'];
            $file_size = $file['size'];
        } else {
            echo json_encode(['success' => false, 'message' => 'Ошибка загрузки файла']);
            return;
        }
    }
    
    if (empty($message) && !$file_path) {
        echo json_encode(['success' => false, 'message' => 'Сообщение или файл обязательны']);
        return;
    }
    
    $stmt = $conn->prepare("INSERT INTO messages (chat_id, sender_id, message, file_path, file_name, file_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("iissssi", $chat_id, $user_id, $message, $file_path, $file_name, $file_type, $file_size);
    
    if ($stmt->execute()) {
        // Обновляем время чата
        $stmt = $conn->prepare("UPDATE chats SET updated_at = NOW() WHERE id = ?");
        $stmt->bind_param("i", $chat_id);
        $stmt->execute();
        
        echo json_encode(['success' => true, 'message' => 'Сообщение отправлено']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ошибка отправки']);
    }
}

function markRead() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    $chat_id = intval($_POST['chat_id'] ?? 0);
    
    $stmt = $conn->prepare("
        UPDATE messages 
        SET is_read = 1 
        WHERE chat_id = ? AND sender_id != ? AND is_read = 0
    ");
    $stmt->bind_param("ii", $chat_id, $user_id);
    $stmt->execute();
    
    echo json_encode(['success' => true]);
}

function getUnreadCount() {
    global $conn;
    $user_id = $_SESSION['user_id'];
    
    $stmt = $conn->prepare("
        SELECT COUNT(*) as count
        FROM messages m
        JOIN chats c ON m.chat_id = c.id
        WHERE (c.participant1_id = ? OR c.participant2_id = ?)
        AND m.sender_id != ?
        AND m.is_read = 0
    ");
    $stmt->bind_param("iii", $user_id, $user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    
    echo json_encode(['success' => true, 'count' => (int)$result['count']]);
}
?>
