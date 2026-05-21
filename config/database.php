<?php
// Конфигурация базы данных
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'delivery_cargo');

// Создание соединения
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

// Проверка соединения
if ($conn->connect_error) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка соединения с базой данных']);
    exit;
}

// Установка кодировки
$conn->set_charset("utf8mb4");
?>
