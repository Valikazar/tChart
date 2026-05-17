#!/bin/bash
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'root'; FLUSH PRIVILEGES;"
pip3 install pymysql
pm2 restart all
pm2 save
