# Tally GPO Raspberry Pi

## Configure
- tally.tools.regoproduction.io:4300/_admin
- Bucket: gpo-boxes
- Create key: #computername#

#### Example object for mapping TallyArbiter names to physical gpo ports
```
{
  "CAM-1": 0,
  "CAM-2": 1
}
```


## Install
- sudo apt-get update
- sudo curl -sL https://deb.nodesource.com/setup_16.x | sudo bash -
- sudo apt-get install -y nodejs
- sudo apt-get install -y git
- sudo npm install -g pm2
- sudo git clone https://github.com/regodev/tally-pi.git
- cd tally-pi
- npm install

## Start
- pm2 start index.js
- pm2 startup systemd
- pm2 save
