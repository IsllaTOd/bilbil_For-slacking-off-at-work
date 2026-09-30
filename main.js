const electron = require('electron');
const app = electron.app;
const ipc = electron.ipcMain;
const dialog = electron.dialog;
const globalShortcut = electron.globalShortcut;
const Menu = electron.Menu;
const utils = require('./js/utils.js');
const path = require('path');

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true;

const platform = process.platform.startsWith('win') ? 'win' : process.platform;

process.on('uncaughtException', (err) => {
  console.error('主线程意外报错', err);
  utils.error(`主线程意外报错\n${err}`);
  dialog.showErrorBox('抱歉', '好像出现了意料之外的错误，建议您现在关闭程序并到bilibili-hide-it的根目录下找到一个名为bilibili-hide-it.log的文件，并把这个文件通过电子邮件发送给我?(IsllaTOd@outlook.com)。\n但是也可能没人能看到，可能这个软件也只有我自己在用，上班怎么这么苦TT');
});

var mainWindow = null, mainWindowIsClosed = null;
function openMainWindow() {
  utils.log('主窗口：开始创建');
  if( mainWindow ) {
    mainWindow.close();
  }
  var opacity = utils.config.get('opacity'),
      windowParams = {
        width: 375,
        height: 500, 
        frame: false,
        icon: path.join(__dirname, 'build', 'icon.ico')
      };
  if( opacity < 1 ) {
    windowParams.transparent = true;
    windowParams.opacity = opacity;
  }
  
  windowParams.webPreferences = {
    nodeIntegration: true,
    webviewTag: true,
    enableRemoteModule: true
  }
  mainWindow = new electron.BrowserWindow(windowParams);
  mainWindow.loadURL('file://' + __dirname + '/index.html');
  mainWindow.setAlwaysOnTop(true, 'torn-off-menu');
  mainWindow.on('closed', () => {
    mainWindow = null;
    if( platform != 'darwin' ) {
      mainWindowIsClosed = setTimeout(() => { app.quit(); }, 3000);
    }
  });
  clearTimeout(mainWindowIsClosed);
}

function initMainWindow() {
  ipc.on('recreate-main-window', openMainWindow);
  ipc.on('close-main-window', () => {
    if( platform == 'darwin' ) {
      mainWindow.close();
      configWindow.hide();
    } else {
      app.quit();
    }
  });
  openMainWindow();
}

var configWindow = null;
function initConfigWindow() {
  configWindow = new electron.BrowserWindow({
    width: 200, height: 260, frame: false, show: false,
    webPreferences: { nodeIntegration: true, enableRemoteModule: true }
  });
  configWindow.loadURL('file://' + __dirname + '/config.html');
  configWindow.setAlwaysOnTop(true, 'modal-panel');
  configWindow.on('closed', () => { configWindow = null; });
  
  ipc.on('toggle-config-window', () => {
    if( configWindow && configWindow.isVisible() ) configWindow.hide();
    else showConfigWindow();
  });
  ipc.on('show-config-window', showConfigWindow);
}

function showConfigWindow() {
  if( !mainWindow || !configWindow ) return;
  var p = mainWindow.getPosition(), s = configWindow.getSize(), pos = [p[0] - s[0] - 10, p[1]];
  configWindow.setPosition(pos[0], pos[1]);
  configWindow.show();
}

function initExchangeMessageForRenderers() {
  ipc.on('set-opacity', () => {
    const opacity = utils.config.get('opacity');
    mainWindow && mainWindow.setOpacity(Number(opacity));
  });
}

function initActionOnMessage() {
  ipc.on('main-window-resized', (ev, pos, size) => {
    if( configWindow.isVisible() ) showConfigWindow();
  });
  ipc.on('set-proxy', () => { setProxy(true); });
}

function setProxy(isUpdate) {
  var proxy = utils.config.get('proxy');
  if( proxy == '' && !isUpdate ) return false;
  if( mainWindow ) {
    mainWindow.webContents.session.setProxy({ proxyRules: proxy }, () => {
      if( isUpdate ) dialog.showMessageBox({ message: '设置代理成功' });
    });
  }
}

function init() {
  app.setAppUserModelId("com.isllatod.moyu");
  initGlobalShortcut();
  initMenu();
  initMainWindow();
  initConfigWindow();
  initActionOnMessage();
  setProxy();
  initExchangeMessageForRenderers();
}

app.disableHardwareAcceleration();
app.on('ready', init);

app.on('activate', () => {
  if( mainWindow === null ) openMainWindow();
  else mainWindow.show();
});

app.on('window-all-closed', () => {
  if( platform != 'darwin' ) app.quit();
});

function initMenu() {
  var template = [{
      label: app.name, submenu: [{ role: 'hide' }, { role: 'hideothers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }]
    }, {
      label: 'Shortcuts', submenu: [{ role: 'copy' }, { role: 'paste' }, { role: 'delete' }, { role: 'selectall' },
        { label: 'Backward', accelerator: 'Esc', click() { mainWindow.webContents.send('press-esc'); } }, 
        { label: 'Volume+', accelerator: 'Up', click() { mainWindow.webContents.send('change-volume', 'up'); } }, 
        { label: 'Volume-', accelerator: 'Down', click() { mainWindow.webContents.send('change-volume', 'down'); } }
      ]
    }, {
      label: 'Debug', submenu: [
        { label: 'Inspect Main Window', accelerator: 'CmdOrCtrl+1', click() { mainWindow.webContents.openDevTools(); } },
        { label: 'Inspect Config Window', accelerator: 'CmdOrCtrl+3', click() { configWindow.webContents.openDevTools(); } },
        { label: 'Inspect Webview', accelerator: 'CmdOrCtrl+4', click() { mainWindow.webContents.send('openWebviewDevTools'); } }
      ]
    }, {
      role: 'window', submenu: [{ role: 'minimize' }, { role: 'close' }]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function bindGlobalShortcut(isUpdate) {
  var shortcut = 'F1';
  let bindRes = globalShortcut.register(shortcut, () => {
    if( mainWindow ) {
      if( mainWindow.isVisible() ) {
        mainWindow.hide();
        mainWindow.webContents.send('hide-hide-hide');
        configWindow && configWindow.isVisible() && configWindow.hide();
      } else { mainWindow.showInactive(); }
    } else { openMainWindow(); }
  });
  if( !bindRes ) return false;
  else if( isUpdate ) dialog.showMessageBox({ type: 'info', message: `修改成功，老板键已替换为「${shortcut}」` });
  
  globalShortcut.register('F2', () => { app.exit(0); });
}

function initGlobalShortcut() {
  ipc.on('update-hide-shortcut', (ev, args) => {
    globalShortcut.unregister(args);
    bindGlobalShortcut(true);
  });
  bindGlobalShortcut();
}

app.on('web-contents-created', (e, contents) => {
  contents.on('context-menu', (event, params) => {
    const contextMenu = Menu.buildFromTemplate([
      { label: '🌟 关注动态', click: () => { contents.loadURL('https://t.bilibili.com/'); } },
      { label: '🔴 正在直播', click: () => contents.loadURL('https://live.bilibili.com/moyu-live') },
      { label: '📺 稍后再看', click: () => { contents.loadURL('https://www.bilibili.com/watchlater/#/list'); } },
      { label: '🏠 返回首页', click: () => { contents.loadURL('https://m.bilibili.com/'); } },
      { type: 'separator' },
      { label: '✨ IsllaTOd', enabled: false }
    ]);
    contextMenu.popup();
  });

  contents.on('did-navigate', (event, url) => {
    if (url.includes('passport.bilibili.com')) return;
    
    // 1. 关注动态
    if (url.includes('t.bilibili.com')) {
      contents.executeJavaScript(`
        document.body.innerHTML = '<h3 style="padding:20px; text-align:center; color:#999;">正在获取关注动态...</h3>';
        document.body.style.zoom = '1'; 
        
        function fetchDynamic(retry) {
            if(retry === undefined) retry = 2;
            fetch('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?timezone_offset=-480&type=video')
              .then(function(res){ return res.json(); })
              .then(function(res){
                if(res.code !== 0 || !res.data) {
                  if (retry > 0) return setTimeout(function(){ fetchDynamic(retry - 1) }, 1000);
                  document.body.innerHTML = '<div style="padding:40px; text-align:center;"><h3 style="color:red; margin-bottom:15px;">尚未登录</h3><a href="https://passport.bilibili.com/login" style="display:inline-block; padding:10px 20px; background:#00aeec; color:#fff; text-decoration:none; border-radius:4px; font-weight:bold;">点此登录</a></div>';
                  return;
                }
                var items = res.data.items || [];
                var html = '<div style="padding:10px; background:#f4f4f4; min-height:100vh; box-sizing:border-box;">';
                items.forEach(function(item){
                  if (!item.modules || !item.modules.module_dynamic || !item.modules.module_dynamic.major) return;
                  var major = item.modules.module_dynamic.major;
                  var author = item.modules.module_author;
                  if (major.type === 'MAJOR_TYPE_ARCHIVE') {
                    var arc = major.archive;
                    html += '<div onclick="window.location.href=\\'https://www.bilibili.com/video/' + arc.bvid + '\\'" style="display:flex; background:#fff; padding:10px; border-radius:8px; margin-bottom:12px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.05);">' +
                            '<div style="width:130px; height:75px; flex-shrink:0; margin-right:10px; position:relative;">' +
                            '<img src="' + arc.cover + '@300w.jpg" style="width:100%; height:100%; border-radius:4px; object-fit:cover;">' +
                            '<span style="position:absolute; bottom:4px; right:4px; background:rgba(0,0,0,0.7); color:#fff; font-size:11px; padding:2px 4px; border-radius:2px;">' + arc.duration_text + '</span>' +
                            '</div>' +
                            '<div style="flex:1; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden;">' +
                            '<div style="font-size:14px; font-weight:bold; color:#222; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-all;">' + arc.title + '</div>' +
                            '<div style="display:flex; align-items:center; font-size:12px; color:#999; margin-top:4px;">' +
                            '<img src="' + author.face + '@50w.jpg" style="width:16px; height:16px; border-radius:50%; margin-right:4px;"><span>' + author.name + '</span>' +
                            '</div></div></div>';
                  }
                });
                html += '</div>';
                document.body.innerHTML = html;
              })
              .catch(function(err){
                if (retry > 0) setTimeout(function(){ fetchDynamic(retry - 1) }, 1000);
                else document.body.innerHTML = '<h3 style="padding:20px; color:red; text-align:center;">网络断开了...</h3>';
              });
        }
        fetchDynamic();
      `);
    }
    
    // 2. 稍后再看
    if (url.includes('watchlater')) {
      contents.executeJavaScript(`
        document.body.innerHTML = '<h3 style="padding:20px; text-align:center; color:#999;">正在获取专属列表...</h3>';
        document.body.style.zoom = '1'; 
        
        function fetchWatchLater(retry) {
            if(retry === undefined) retry = 2;
            fetch('https://api.bilibili.com/x/v2/history/toview/web')
              .then(function(res){ return res.json(); })
              .then(function(res){
                if(res.code !== 0) {
                  if (retry > 0) return setTimeout(function(){ fetchWatchLater(retry - 1) }, 1000);
                  document.body.innerHTML = '<div style="padding:40px; text-align:center;"><h3 style="color:red; margin-bottom:15px;">尚未登录</h3><a href="https://passport.bilibili.com/login" style="display:inline-block; padding:10px 20px; background:#00aeec; color:#fff; text-decoration:none; border-radius:4px; font-weight:bold;">点此登录</a></div>';
                  return;
                }
                var list = res.data.list || [];
                var html = '<div style="padding:10px; background:#f4f4f4; min-height:100vh; box-sizing:border-box;">';
                list.forEach(function(video){
                  var min = Math.floor(video.duration/60);
                  var sec = video.duration%60;
                  var durationStr = min + ':' + (sec < 10 ? '0' + sec : sec);
                  html += '<div onclick="window.location.href=\\'https://www.bilibili.com/video/' + video.bvid + '\\'" style="display:flex; background:#fff; padding:10px; border-radius:8px; margin-bottom:12px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.05);">' +
                          '<div style="width:130px; height:75px; flex-shrink:0; margin-right:10px; position:relative;">' +
                          '<img src="' + video.pic + '@300w.jpg" style="width:100%; height:100%; border-radius:4px; object-fit:cover;">' +
                          '<span style="position:absolute; bottom:4px; right:4px; background:rgba(0,0,0,0.7); color:#fff; font-size:11px; padding:2px 4px; border-radius:2px;">' + durationStr + '</span>' +
                          '</div>' +
                          '<div style="flex:1; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden;">' +
                          '<div style="font-size:14px; font-weight:bold; color:#222; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-all;">' + video.title + '</div>' +
                          '<div style="font-size:12px; color:#999;">UP: ' + video.owner.name + '</div>' +
                          '</div></div>';
                });
                html += '</div>';
                document.body.innerHTML = html;
              })
              .catch(function(err){
                if (retry > 0) setTimeout(function(){ fetchWatchLater(retry - 1) }, 1000);
              });
        }
        fetchWatchLater();
      `);
    }

    // 3. 电脑版视频页净化
    if (url.includes('/video/')) {
      contents.executeJavaScript(`
        var antiAdStyle = document.createElement('style');
        antiAdStyle.innerHTML = ".international-header, .bili-header, .right-container, .pop-live-small-mode { display: none !important; } body { background: #f4f4f4 !important; }";
        document.head.appendChild(antiAdStyle);
      `);
    }

    // 4. 正在直播
    if (url.includes('live.bilibili.com/moyu-live')) {
      contents.executeJavaScript(`
        document.open();
        document.write('<html><head><meta charset="utf-8"><title>正在直播</title></head><body style="background:#f4f4f4;margin:0;"><div id="my-app"><h3 style="padding:20px;text-align:center;color:#999;">正在获取直播列表...</h3></div></body></html>');
        document.close();

        function fetchLive(retry) {
            if(retry === undefined) retry = 2;
            fetch('https://api.live.bilibili.com/xlive/web-ucenter/v1/xfetter/GetWebList?page=1&page_size=10')
              .then(function(res){ return res.json(); })
              .then(function(res){
                if(res.code !== 0) {
                  if (retry > 0) return setTimeout(function(){ fetchLive(retry - 1) }, 1000);
                  document.getElementById('my-app').innerHTML = '<div style="padding:40px; text-align:center;"><h3 style="color:red; margin-bottom:15px;">尚未登录</h3><a href="https://passport.bilibili.com/login" style="display:inline-block; padding:10px 20px; background:#00aeec; color:#fff; text-decoration:none; border-radius:4px; font-weight:bold;">点此登录</a></div>';
                  return;
                }
                var rooms = (res.data && res.data.rooms) || [];
                if (rooms.length === 0) {
                    document.getElementById('my-app').innerHTML = '<h3 style="padding:40px; text-align:center; color:#999;">当前无主播开播~</h3>';
                    return;
                }
                var htmlStr = '<div style="padding:10px; box-sizing:border-box;">';
                rooms.forEach(function(room) {
                  var cover = room.cover_from_user || room.keyframe;
                  htmlStr += '<div onclick="window.location.href=\\'https://live.bilibili.com/' + room.room_id + '\\'" style="display:flex; background:#fff; padding:10px; border-radius:8px; margin-bottom:12px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.05);">' +
                             '<div style="width:130px; height:75px; flex-shrink:0; margin-right:10px; position:relative;">' +
                             '<img src="' + cover + '@300w.jpg" style="width:100%; height:100%; border-radius:4px; object-fit:cover;">' +
                             '<span style="position:absolute; bottom:4px; right:4px; background:#ff6699; color:#fff; font-size:11px; padding:2px 4px; border-radius:2px;">LIVE</span>' +
                             '</div>' +
                             '<div style="flex:1; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden;">' +
                             '<div style="font-size:14px; font-weight:bold; color:#222; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-all;">' + room.title + '</div>' +
                             '<div style="font-size:12px; color:#999;">主播: ' + room.uname + '</div>' +
                             '</div></div>';
                });
                htmlStr += '</div>';
                document.getElementById('my-app').innerHTML = htmlStr;
              })
              .catch(function(err){
                if (retry > 0) setTimeout(function(){ fetchLive(retry - 1) }, 1000);
              });
        }
        fetchLive();
      `);
    }

    // 5. 直播间净化
    if (url.match(/live\.bilibili\.com\/(?:blanc\/)?\d+/)) {
      contents.executeJavaScript(`
        var liveStyle = document.createElement('style');
        liveStyle.innerHTML = "#head-info-vm, .bilibili-live-player-video-controller, header, .aside-area, .chat-history-panel, .right-container, .gift-control-section, .rank-list-ctnr, .link-toast, .combo-toast-cntr, .pay-gift-panel, .bottom-area, .side-bar-cntr, .popular-and-hot-rank { display: none !important; } body, html { background: #000 !important; min-width: 0 !important; overflow: hidden !important; }";
        document.head.appendChild(liveStyle);
      `);
    }
    
  });
});
