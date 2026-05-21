# Настройка офлайн-режима

## Скачайте следующие файлы вручную:

### 1. React (сохранить как `public/react.development.js`)
https://unpkg.com/react@18/umd/react.development.js

### 2. React DOM (сохранить как `public/react-dom.development.js`)
https://unpkg.com/react-dom@18/umd/react-dom.development.js

### 3. Babel (сохранить как `public/babel.min.js`)
https://unpkg.com/@babel/standalone/babel.min.js

### 4. Bootstrap Icons CSS (сохранить как `public/bootstrap-icons.css`)
https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css

### 5. Bootstrap Icons Fonts (создать папку `public/fonts/`)
https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/fonts/bootstrap-icons.woff
https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/fonts/bootstrap-icons.woff2

### 6. Inter Font (сохранить как `public/inter.css`)
https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap

## Инструкция:

1. Откройте каждую ссылку в браузере
2. Нажмите Ctrl+S для сохранения
3. Сохраните в указанные папки
4. После скачивания обновите index.html (используйте готовый файл ниже)

## Или используйте PowerShell команды:

```powershell
cd C:\xampp\htdocs\DeliveryCarGo\public

# React
Invoke-WebRequest -Uri "https://unpkg.com/react@18/umd/react.development.js" -OutFile "react.development.js"

# React DOM
Invoke-WebRequest -Uri "https://unpkg.com/react-dom@18/umd/react-dom.development.js" -OutFile "react-dom.development.js"

# Babel
Invoke-WebRequest -Uri "https://unpkg.com/@babel/standalone/babel.min.js" -OutFile "babel.min.js"

# Bootstrap Icons CSS
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css" -OutFile "bootstrap-icons.css"

# Создать папку для шрифтов
New-Item -ItemType Directory -Force -Path "fonts"

# Bootstrap Icons Fonts
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/fonts/bootstrap-icons.woff" -OutFile "fonts/bootstrap-icons.woff"
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/fonts/bootstrap-icons.woff2" -OutFile "fonts/bootstrap-icons.woff2"
```

После скачивания файлов, index.html будет автоматически обновлен для использования локальных файлов.
