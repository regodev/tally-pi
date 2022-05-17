# Tally GPO Raspberry Pi

## Install
- sudo apt-get update
- curl -sL https://deb.nodesource.com/setup_14.x | bash -
- sudo apt-get install -y nodejs
- sudo npm install -g pm2

## Start
- pm2 start index.js
- pm2 startup systemd
- pm2 save