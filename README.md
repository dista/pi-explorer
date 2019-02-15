# pi-explorer
Web File Explorer UI for linux server

## Install
It is just a nodejs app, so using following to install after installing nodejs
```
npm install
```

## Usage
start program at server
```
usage: node index.js -r {root_of_dir}
   -r: root_of_dir is the root directory you want to let user explor in your server
```
then visit `http://{your_ip_of_server}:8003` with your browser.

## Feature
* Basic file explore
* Support any size screen
* Search under current location
* Syntax highlight for some language, including `bash, java, css, js, ...`
* markdown preview
* convert video format to mp4 which can be played by browser natively.(need to install ffmpeg)
* videojs player for video

## preview
![alt tag](https://github.com/dista/pi-explorer/blob/master/pi-explorer-gif4.gif?raw=true)
