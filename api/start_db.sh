#!/bin/bash

echo "[MySQL] [INFO] Installing MySQL via Homebrew"
brew install mysql

echo "[MySQL] [INFO] Starting local MySQL server"
brew services start mysql

sleep 5

echo "[MySQL] [HINT] Configuring root password and creating database"
mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '12345'; FLUSH PRIVILEGES;" 2>/dev/null || echo "[MySQL] [ALARM] Root password was already set previously"

mysql -u root -p12345 -e "CREATE DATABASE IF NOT EXISTS test_db;"

echo "[MySQL] [INFO] Local MySQL server successfully started"
echo "[MySQL] [HINT] Credentials - User: root | Password: 12345 | Database: test_db"