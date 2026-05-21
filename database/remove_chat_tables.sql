-- Удаление таблиц мессенджера из существующей базы данных
USE delivery_cargo;

-- Удаляем таблицу сообщений
DROP TABLE IF EXISTS messages;

-- Удаляем таблицу чатов
DROP TABLE IF EXISTS chats;
