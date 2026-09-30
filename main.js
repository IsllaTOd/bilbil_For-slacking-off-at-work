const electron = require('electron');
const app = electron.app;
const ipc = electron.ipcMain;
const dialog = electron.dialog;
const globalShortcut = electron.globalShortcut;
const Menu = electron.Menu;
const utils = require('./js/utils.js');
const path = require('path');

// 禁用安全提示
// https://www.electronjs.org/docs/tutorial/security
// 目前electron会弹3个安全提示
// 1、CSP要求禁用unsafe-eval，但这会造成Vue template无法运行时编译，这对我们影响很大，整个index大概都要重写，懒的搞
// 2、enableBlinkFeature按照文档不传参默认是关闭的，但是不知道为什么我这里默认是开启的，我传false也关不掉，所以也不管了
// 3、最后一个禁用remote模块，全部线程间传递都改用ipc，但是这同样涉及到非常多改动，懒得改
// 反正我们的代码也都是本地的，我们完全不执行远程代码，应该不会有安全问题
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true;

const platform = process.platform.startsWith('win') ? 'win' : process.platform;

// handle uncaught exception
process.on('uncaughtException', (err) => {
  console.error('主线程意外报错', err);
  utils.error(`主线程意外报错\n${err}`);
  dialog.showErrorBox('肥肠抱歉', 
    '好像似乎也许可能出现了意料之外的错误，我建议您现在关闭程序并到bilimini的根目录下找到一个名为bilimini.log的文件，并把这个文件通过电子邮件发送给我：i@thec.me。\n这份文件会帮助我了解您的程序在进行什么操作时出现了问题，因此它会包含您最近一次运行bilimini的浏览记录，如果您介意也可以选择不发送。_(:з」∠)_');
});

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically hen the JavaScript object is garbage collected.
var mainWindow = null, mainWindowIsClosed = null;
function openMainWindow() {
  utils.log('主窗口：开始创建');
  if( mainWindow ) {
    utils.log('主窗口：检测到主窗口已存在，正在关闭她');
    mainWindow.close();
    utils.log('主窗口：原主窗口已关闭');
  }
  // 根据透明度设置决定是否要创建transparent窗口
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
    utils.log('主窗口：已关闭');
    if( platform != 'darwin' ) {
      mainWindowIsClosed = setTimeout(() => {
        utils.log('主窗口：关闭超过 3s 未重新创建，程序自动退出');
        app.quit();
      }, 3000);
    }
  });
  clearTimeout(mainWindowIsClosed);
  utils.log('主窗口：已创建');
}

function initMainWindow() {
  ipc.on('recreate-main-window', openMainWindow);
  ipc.on('close-main-window', () => {
    if( platform == 'darwin' ) {
      mainWindow.close();
      selectPartWindow.hide();
      configWindow.hide();
    } else {
      app.quit();
    }
  });
  openMainWindow();
}

// 初始化选分p窗口
var selectPartWindow = null;
function initSelectPartWindow() {
  utils.log('选p窗口：开始创建');
  selectPartWindow = new electron.BrowserWindow({
    width: 200, height: 300, frame: false, show: false,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true
    }
  });
  selectPartWindow.loadURL('file://' + __dirname + '/selectP.html');
  selectPartWindow.setAlwaysOnTop(true, 'modal-panel');
  selectPartWindow.on('closed', () => {
    selectPartWindow = null;
    utils.log('选p窗口：已关闭');
  });
  utils.log('选p窗口：已创建');
  // 切换、可开可关
  ipc.on('toggle-select-part-window', () => {
    if( selectPartWindow && selectPartWindow.isVisible() ) {
      selectPartWindow.hide();
    } else {
      showSelectPartWindow();
    }
  });
  // 仅开启
  ipc.on('show-select-part-window', showSelectPartWindow);
  // selectPartWindow.openDevTools();
}

function showSelectPartWindow() {
  utils.log('选p窗口：打开');
  if( !mainWindow || !selectPartWindow ) {
    return;
  }
  var p = mainWindow.getPosition(), s = mainWindow.getSize(),
      pos = [p[0] + s[0] + 10, p[1]];
  selectPartWindow.setPosition(pos[0], pos[1]);
  selectPartWindow.show();
}

// 初始化设置窗口
var configWindow = null;
function initConfigWindow() {
  utils.log('设置窗口：开始创建');
  configWindow = new electron.BrowserWindow({
    width: 200, height: 260, frame: false, show: false,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    }
  });
  configWindow.loadURL('file://' + __dirname + '/config.html');
  configWindow.setAlwaysOnTop(true, 'modal-panel');
  configWindow.on('closed', () => {
    configWindow = null;
    utils.log('设置窗口：已关闭');
  });
  utils.log('设置窗口：已创建');
  // 切换、可开可关
  ipc.on('toggle-config-window', () => {
    if( configWindow && configWindow.isVisible() ) {
      configWindow.hide();
    } else {
      showConfigWindow();
    }
  });
  // 仅开启
  ipc.on('show-config-window', showConfigWindow);
  // configWindow.openDevTools();
}

function showConfigWindow() {
  utils.log('设置窗口：打开');
  if( !mainWindow || !configWindow ) {
    return;
  }
  var p = mainWindow.getPosition(), s = configWindow.getSize(),
      pos = [p[0] - s[0] - 10, p[1]];
  configWindow.setPosition(pos[0], pos[1]);
  configWindow.show();
}

function initExchangeMessageForRenderers() {
  // 转发分p数据，真的只能用这么蠢的方法实现么。。。
  ipc.on('update-part', (ev, args) => {
    if( !args && selectPartWindow && selectPartWindow.isVisible() ) {
      selectPartWindow.hide();
    } else {
      selectPartWindow && selectPartWindow.webContents.send('update-part', args);
    }
  });
  // 转发番剧分p消息，这俩的格式是不一样的，番剧的分p里带了playurl
  ipc.on('update-bangumi-part', (ev, args) => {
    selectPartWindow && selectPartWindow.webContents.send('update-bangumi-part', args);
  });
  // 转发当前webview的url地址给分p页面，方便分p页面判断当前位置
  ipc.on('url-changed', (ev, args) => {
    selectPartWindow && selectPartWindow.send('url-changed', args);
  });
  // 转发选p消息
  ipc.on('select-part', (ev, args) => {
    mainWindow && mainWindow.webContents.send('select-part', args);
  });
  // 番剧选P
  ipc.on('select-bangumi-part', (ev, args) => {
    mainWindow && mainWindow.webContents.send('select-bangumi-part', args);
  });
  // 设置主窗口透明度
  ipc.on('set-opacity', () => {
    const opacity = utils.config.get('opacity');
    mainWindow && mainWindow.setOpacity(Number(opacity));
  });
}

// 当主窗口收到各种消息时的反应
function initActionOnMessage() {
  // mainWindow在default/mini尺寸间切换时同时移动selectPartWindow
  ipc.on('main-window-resized', (ev, pos, size) => {
    if( selectPartWindow.isVisible() ) {
      showSelectPartWindow();
    }
    if( configWindow.isVisible() ) {
      showConfigWindow();
    }
  });
  // 用户设置proxy时更新session代理
  ipc.on('set-proxy', () => {
    setProxy(true);
  });
}

// 更新webview代理设置
function setProxy(isUpdate) {
  var proxy = utils.config.get('proxy');
  // 如果是用户手动设置代理，那么要允许用户通过设置空白代理来删除代理，反之当初始化时忽略空白代理
  if( proxy == '' && !isUpdate ) {
    return false;
  }
  utils.log(`代理：设置代理 ${proxy}, isUpdate：${!!isUpdate}`);
  if( mainWindow ) {
    mainWindow.webContents.session.setProxy({
      proxyRules: proxy
    }, () => {
      if( isUpdate ) {
        dialog.showMessageBox({
          message: '设置代理成功'
        });
      }
      utils.log('代理：设置成功');
    });
  }
}

function init() {
  app.setAppUserModelId("com.isllatod.moyu");
  utils.log(`主线程：初始化；Platform：${process.platform}`, null, true);
  initGlobalShortcut();
  initMenu();
  initMainWindow();
  initSelectPartWindow();
  initConfigWindow();
  initActionOnMessage();
  setProxy();
  initExchangeMessageForRenderers();
  utils.log('主线程：初始化流程结束');
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.disableHardwareAcceleration();
app.on('ready', init);

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if( mainWindow === null ) {
    openMainWindow();
  } else {
    mainWindow.show();
  }
});

app.on('window-all-closed', () => {
  utils.log('主线程：所有窗口关闭');
  if( platform != 'darwin' ) {
    utils.log('主线程：非OSX平台，程序即将退出');
    app.quit();
  }
});

// 菜单
function initMenu() {
  utils.log('菜单：初始化');
  // 本来我们是不需要菜单的，但是因为mac上app必须有菜单，所以只在mac上做一下
  var template = [{
      label: app.name,
      submenu: [
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }, {
      label: 'Shortcuts',
      submenu: [
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectall' },
        {
          label: 'Backward',
          accelerator: 'Esc',
          click() { mainWindow.webContents.send('press-esc'); }
        }, { 
          label: 'Volume+',
          accelerator: 'Up',
          click() { mainWindow.webContents.send('change-volume', 'up'); }
        }, {
          label: 'Volume-',
          accelerator: 'Down',
          click() { mainWindow.webContents.send('change-volume', 'down'); }
        }
      ]
    }, {
      label: 'Debug',
      submenu: [
        {
          label: 'Inspect Main Window',
          accelerator: 'CmdOrCtrl+1',
          click() { mainWindow.webContents.openDevTools(); }
        },
        {
          label: 'Inspect Select Part Window',
          accelerator: 'CmdOrCtrl+2',
          click() { selectPartWindow.webContents.openDevTools(); }
        },
        {
          label: 'Inspect Config Window',
          accelerator: 'CmdOrCtrl+3',
          click() { configWindow.webContents.openDevTools(); }
        },
        {
          label: 'Inspect Webview',
          accelerator: 'CmdOrCtrl+4',
          click() { mainWindow.webContents.send('openWebviewDevTools'); }
        }
      ]
    }, {
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];
  var menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  utils.log('菜单：初始化结束');
}

// 老板键
function bindGlobalShortcut(isUpdate) {
  utils.log(`老板键：开始注册，isUpdate: ${!!isUpdate}`);
  var shortcut = 'F1';
  let bindRes = globalShortcut.register(shortcut, () => {
    if( mainWindow ) {
      if( mainWindow.isVisible() ) {
        mainWindow.hide();
        mainWindow.webContents.send('hide-hide-hide');
        selectPartWindow && selectPartWindow.isVisible() && selectPartWindow.hide();
        configWindow && configWindow.isVisible() && configWindow.hide();
      } else {
        mainWindow.showInactive();
      }
    } else {
      openMainWindow();
    }
  });
  if( !bindRes ) {
    utils.log('老板键：注册失败');
    dialog.showErrorBox(`修改老板键失败，「${shortcut}」可能不能用作全局快捷键或已被其他程序占用`, '');
    return false;
  } else if( isUpdate ) {
    // 通过设置页面修改快捷键成功时弹个窗提示修改成功
    dialog.showMessageBox({
      type: 'info',
      message: `修改成功，老板键已替换为「${shortcut}」`
    });
  }
  utils.log('老板键：注册成功');
  // 秒退键
  globalShortcut.register('F2', () => {
    utils.log('秒退键触发：瞬间强杀进程');
    app.exit(0); 
  });
}

function initGlobalShortcut() {
  ipc.on('update-hide-shortcut', (ev, args) => {
    globalShortcut.unregister(args);
    bindGlobalShortcut(true);
  });
  bindGlobalShortcut();
}
// ==========================================
// --- 右键+重新导航 ---
// ==========================================
app.on('web-contents-created', (e, contents) => {
  contents.on('context-menu', (event, params) => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '🌟 关注动态',
        click: () => {
          contents.loadURL('https://t.bilibili.com/'); 
        }
      },
      { label: '🔴 正在直播', click: () => contents.loadURL('https://live.bilibili.com/moyu-live') },
      {
        label: '📺 稍后再看',
        click: () => {
          contents.loadURL('https://www.bilibili.com/watchlater/#/list');
        }
      },
      {
        label: '🏠 返回首页',
        click: () => {
          contents.loadURL('https://m.bilibili.com/'); 
        }
      },
      { type: 'separator' },
      {
        label: '✨ IsllaTOd',
        enabled: false
      }
    ]);
    contextMenu.popup();
  });
});

// 🎯 全局双向导航监听
app.on('web-contents-created', (e, contents) => {
  contents.on('did-navigate', (event, url) => {
    
    // 如果在登录页，绝对不干扰
    if (url.includes('passport.bilibili.com')) {
      return;
    }
    
    // -----------------------------------------
    // 1. 如果切到了【关注动态】页面
    // -----------------------------------------
    if (url.includes('t.bilibili.com')) {
      contents.executeJavaScript(`
        document.body.innerHTML = '<h3 style="padding:20px; text-align:center; color:#999;">正在获取关注动态...</h3>';
        document.body.style.zoom = '1'; 
        
        function fetchDynamic(retry = 2) {
            fetch('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?timezone_offset=-480&type=video')
              .then(res => res.json())
              .then(res => {
                if(res.code !== 0 || !res.data) {
                  if (retry > 0) {
                      setTimeout(() => fetchDynamic(retry - 1), 1000);
                      return;
                  }
                  document.body.innerHTML = \`
                    <div style="padding:40px; text-align:center;">
                      <h3 style="color:red; margin-bottom:15px;">尚未登录或登录态未生效</h3>
                      <a href="https://passport.bilibili.com/login" style="display:inline-block; padding:10px 20px; background:#00aeec; color:#fff; text-decoration:none; border-radius:4px; font-weight:bold;">点此前往登录 B 站</a>
                    </div>
                  \`;
                  return;
                }
                
                const items = res.data.items || [];
                let html = '<div style="padding:10px; background:#f4f4f4; min-height:100vh; box-sizing:border-box;">';
                
                items.forEach(item => {
                  const module_author = item.modules.module_author;
                  const module_dynamic = item.modules.module_dynamic;
                  
                  if (!module_dynamic || !module_dynamic.major) return;
                  const major = module_dynamic.major;
                  
                  if (major.type === 'MAJOR_TYPE_ARCHIVE') {
                    const archive = major.archive;
                    const title = archive.title;
                    const cover = archive.cover;
                    const bvid = archive.bvid;
                    const duration = archive.duration_text;
                    const upName = module_author.name;
                    const upFace = module_author.face;
                    
                    // 🎯 核心修改：将跳转链接强制改为电脑版 www.bilibili.com/video/xxx
                    html += \`
                      <div onclick="window.location.href='https://www.bilibili.com/video/\${bvid}'" 
                           style="display:flex; background:#fff; padding:10px; border-radius:8px; margin-bottom:12px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                        <div style="width:130px; height:75px; flex-shrink:0; margin-right:10px; position:relative;">
                          <img src="\${cover}@300w.jpg" style="width:100%; height:100%; border-radius:4px; object-fit:cover;">
                          <span style="position:absolute; bottom:4px; right:4px; background:rgba(0,0,0,0.7); color:#fff; font-size:11px; padding:2px 4px; border-radius:2px;">
                            \${duration}
                          </span>
                        </div>
                        <div style="flex:1; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden;">
                          <div style="font-size:14px; font-weight:bold; color:#222; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-all;">
                            \${title}
                          </div>
                          <div style="display:flex; align-items:center; font-size:12px; color:#999; margin-top:4px;">
                            <img src="\${upFace}@50w.jpg" style="width:16px; height:16px; border-radius:50%; margin-right:4px;">
                            <span>\${upName}</span>
                          </div>
                        </div>
                      </div>
                    \`;
                  }
                });
                
                html += '</div>';
                document.body.innerHTML = html;
              })
              .catch(err => {
                if (retry > 0) {
                    setTimeout(() => fetchDynamic(retry - 1), 1000);
                } else {
                    document.body.innerHTML = '<h3 style="padding:20px; color:red; text-align:center;">网络断开了...</h3>';
                }
              });
        }
        
        fetchDynamic();
      `);
    }
    
    // -----------------------------------------
    // 2. 如果切到了【稍后再看】页面
    // -----------------------------------------
    if (url.includes('watchlater')) {
      contents.executeJavaScript(`
        document.body.innerHTML = '<h3 style="padding:20px; text-align:center; color:#999;">正在获取摸鱼专属列表...</h3>';
        document.body.style.zoom = '1'; 
        
        function fetchWatchLater(retry = 2) {
            fetch('https://api.bilibili.com/x/v2/history/toview/web')
              .then(res => res.json())
              .then(res => {
                if(res.code !== 0) {
                  if (retry > 0) {
                      setTimeout(() => fetchWatchLater(retry - 1), 1000);
                      return;
                  }
                  document.body.innerHTML = \`
                    <div style="padding:40px; text-align:center;">
                      <h3 style="color:red; margin-bottom:15px;">尚未登录或登录态未生效</h3>
                      <a href="https://passport.bilibili.com/login" style="display:inline-block; padding:10px 20px; background:#00aeec; color:#fff; text-decoration:none; border-radius:4px; font-weight:bold;">点此前往登录 B 站</a>
                    </div>
                  \`;
                  return;
                }
                
                const list = res.data.list;
                let html = '<div style="padding:10px; background:#f4f4f4; min-height:100vh; box-sizing:border-box;">';
                
                list.forEach(video => {
                  // 稍后再看也同步改为电脑版播放链接
                  html += \`
                    <div onclick="window.location.href='https://www.bilibili.com/video/\${video.bvid}'" 
                         style="display:flex; background:#fff; padding:10px; border-radius:8px; margin-bottom:12px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                      <div style="width:130px; height:75px; flex-shrink:0; margin-right:10px; position:relative;">
                        <img src="\${video.pic}@300w.jpg" style="width:100%; height:100%; border-radius:4px; object-fit:cover;">
                        <span style="position:absolute; bottom:4px; right:4px; background:rgba(0,0,0,0.7); color:#fff; font-size:11px; padding:2px 4px; border-radius:2px;">
                          \${Math.floor(video.duration/60)}:\${(video.duration%60).toString().padStart(2,'0')}
                        </span>
                      </div>
                      <div style="flex:1; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden;">
                        <div style="font-size:14px; font-weight:bold; color:#222; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-all;">
                          \${video.title}
                        </div>
                        <div style="font-size:12px; color:#999;">
                          UP: \${video.owner.name}
                        </div>
                      </div>
                    </div>
                  \`;
                });
                
                html += '</div>';
                document.body.innerHTML = html;
              })
              .catch(err => {
                if (retry > 0) {
                    setTimeout(() => fetchWatchLater(retry - 1), 1000);
                } else {
                    document.body.innerHTML = '<h3 style="padding:20px; color:red; text-align:center;">网络断开了...</h3>';
                }
              });
        }
        
        fetchWatchLater();
      `);
    }

    // -----------------------------------------
    // 3. 🛡️ 如果切到了【视频播放页】（净化电脑版视频页）
    // -----------------------------------------
    if (url.includes('/video/')) {
      contents.executeJavaScript(`
        var antiAdStyle = document.createElement('style');
        antiAdStyle.innerHTML = \`
          /* 隐藏电脑版多余的推荐、评论区顶部的引导下载等 */
          .international-header, .bili-header, .right-container, .pop-live-small-mode {
              display: none !important;
          }
          body { background: #f4f4f4 !important; }
        \`;
        document.head.appendChild(antiAdStyle);
      `);
    }
    
  });
});
// ==========================================
// --- 右键增加正在直播  ---
// ==========================================
app.on('web-contents-created', (e, contents) => {
  contents.on('did-navigate', (event, url) => {
    
    // -----------------------------------------
    // 触发功能：获取正在直播列表
    // -----------------------------------------
    if (url.includes('live.bilibili.com/moyu-live')) {
      contents.executeJavaScript(`
        (function() {
          document.open();
          document.write('<html><head><meta charset="utf-8"><title>正在直播</title></head><body style="background:#f4f4f4;margin:0;"><div id="my-app"><h3 style="padding:20px;text-align:center;color:#999;">正在获取直播列表...</h3></div></body></html>');
          document.close();

          function fetchLive(retry) {
              fetch('https://api.live.bilibili.com/xlive/web-ucenter/v1/xfetter/GetWebList?page=1&page_size=10')
                .then(res => res.json())
                .then(res => {
                  if(res.code !== 0) {
                    if (retry > 0) return setTimeout(() => fetchLive(retry - 1), 1000);
                    document.getElementById('my-app').innerHTML = '<div style="padding:40px; text-align:center;"><h3 style="color:red; margin-bottom:15px;">尚未登录或登录态未生效</h3><a href="https://passport.bilibili.com/login" style="display:inline-block; padding:10px 20px; background:#00aeec; color:#fff; text-decoration:none; border-radius:4px; font-weight:bold;">点此前往登录 B 站</a></div>';
                    return;
                  }
                  
                  var rooms = (res.data && res.data.rooms) || [];
                  if (rooms.length === 0) {
                      document.getElementById('my-app').innerHTML = '<h3 style="padding:40px; text-align:center; color:#999;">当前没有关注的主播开播哦~</h3>';
                      return;
                  }

                  var htmlStr = '<div style="padding:10px; box-sizing:border-box;">';
                  rooms.forEach(function(room) {
                    var roomId = room.room_id;
                    var title = room.title;
                    var cover = room.cover_from_user || room.keyframe;
                    var upName = room.uname;
                    
                    htmlStr += '<div onclick="window.location.href=\\'https://live.bilibili.com/' + roomId + '\\'" style="display:flex; background:#fff; padding:10px; border-radius:8px; margin-bottom:12px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.05);">';
                    htmlStr += '<div style="width:130px; height:75px; flex-shrink:0; margin-right:10px; position:relative;">';
                    htmlStr += '<img src="' + cover + '@300w.jpg" style="width:100%; height:100%; border-radius:4px; object-fit:cover;">';
                    htmlStr += '<span style="position:absolute; bottom:4px; right:4px; background:#ff6699; color:#fff; font-size:11px; padding:2px 4px; border-radius:2px;">LIVE</span>';
                    htmlStr += '</div>';
                    htmlStr += '<div style="flex:1; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden;">';
                    htmlStr += '<div style="font-size:14px; font-weight:bold; color:#222; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-all;">' + title + '</div>';
                    htmlStr += '<div style="font-size:12px; color:#999;">主播: ' + upName + '</div>';
                    htmlStr += '</div></div>';
                  });
                  htmlStr += '</div>';
                  document.getElementById('my-app').innerHTML = htmlStr;
                })
                .catch(err => {
                  if (retry > 0) setTimeout(() => fetchLive(retry - 1), 1000);
                  else document.getElementById('my-app').innerHTML = '<h3 style="padding:20px; color:red; text-align:center;">网络断开了...</h3>';
                });
          }
          fetchLive(2);
        })();
        void 0; 
      `).catch(() => {});
    }

    // -----------------------------------------
    // 直播间极简净化 (仅保留纯净视频画面)
    // -----------------------------------------
    if (url.match(/live\.bilibili\.com\/(?:blanc\/)?\d+/)) {
      contents.executeJavaScript(`
        var liveStyle = document.createElement('style');
        liveStyle.innerHTML = \`
          /* 彻底隐藏所有的导航栏、聊天栏、礼物打赏栏和悬浮控件 */
          #head-info-vm, .bilibili-live-player-video-controller, header, 
          .aside-area, .chat-history-panel, .right-container, 
          .gift-control-section, .rank-list-ctnr, .link-toast, 
          .combo-toast-cntr, .pay-gift-panel, .bottom-area,
          .side-bar-cntr, .popular-and-hot-rank { 
              display: none !important; 
          }
          /* 去除页面滚动条和最小宽度限制，让视频铺满 */
          body, html { background: #000 !important; min-width: 0 !important; overflow: hidden !important; }
        \`;
        document.head.appendChild(liveStyle);
        void 0;
      `).catch(() => {});
    }

  });
});
// ==========================================
