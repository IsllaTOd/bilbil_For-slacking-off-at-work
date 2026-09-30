const ipc = require('electron').ipcRenderer;
const remote = require('electron').remote;
const dialog = remote.dialog;
const shell = require('electron').shell;
const appData = require('./package.json');
const utils = require('./js/utils.js');

const userAgent = {
  desktop: 'bilbil-hide-it Desktop like Mozilla/233 (Windows NT or OSX) AppleWebKit like Gecko',
  mobile: 'bilbil-hide-it Mobile like (iPhone or Android) whatever AppleWebKit/124.50'
};

const videoUrlPrefix = 'https://www.bilibili.com/video/';
const liveUrlPrefix  = 'https://live.bilibili.com/blanc/';
let wv, wrapper;

// 保存用户浏览记录 (保留核心堆栈，供 Esc 快捷键调用)
let _lastNavigation = new Date();
var _history = {
  stack: ['https://m.bilibili.com/index.html'],
  pos: 0,
  lastTarget: '', 
  lastLoadedUrl: '', 
  go: function(target, noNewHistory) {
    if( target == _history.lastTarget ) {
      return false;
    }
    _history.lastTarget = target;
    wrapper.classList.add('loading');
    let vid = utils.getVidWithP(target);
    let live;
    
    const now = new Date();
    if( now - _lastNavigation < 3000 ) {
      utils.log('两次转跳间隔小于3s，疑似redirect');
      _history.pop();
    }
    _lastNavigation = now;
    
    if( vid ) {
      wv.loadURL(videoUrlPrefix + vid, {
        userAgent: userAgent.desktop
      });
      !noNewHistory && _history.add(videoUrlPrefix + vid);
      utils.log(`路由：类型① 视频详情页\n原地址：${target}\n转跳地址：${videoUrlPrefix+vid}`);
    } else if( target.indexOf('bangumi/play/') > -1 ) {
      wv.loadURL(target, {
        userAgent: userAgent.desktop
      });
      !noNewHistory && _history.add(target);
      utils.log(`路由：类型② 番剧播放页\n地址：${target}`);
    } else if ( live = /live\.bilibili\.com\/(h5\/||blanc\/)?(\d+).*/.exec(target) ) {
      wv.loadURL(liveUrlPrefix + live[2], {
        userAgent: userAgent.desktop
      });
      !noNewHistory && _history.add(liveUrlPrefix + live[2]);
      utils.log(`路由：类型③ 直播页面\n原地址：${target}\n转跳地址：${liveUrlPrefix+live[2]}`);
    } else {
      wv.loadURL(target, {
        userAgent: userAgent.mobile
      });
      !noNewHistory && _history.add(target);
      utils.log(`路由：类型④ 未归类\n原地址：${target}\n转跳地址：${target}`);
    }
  },
  add: function(url) {
    _history.stack.length = _history.pos + 1;
    _history.stack.push(url);
    _history.pos++;
  },
  replace: function(url) {
    _history.stack[_history.stack.length - 1] = url;
  },
  pop: function() {
    _history.stack.pop();
    _history.pos--;
  },
  goBack: function() {
    if(!_history.canGoBack()) {
      return false;
    }
    utils.log('路由：后退');
    _history.go(_history.stack[--_history.pos], true);
  },
  goForward: function() {
    if(!_history.canGoForward()) {
      return false;
    }
    utils.log('路由：前进');
    _history.go(_history.stack[++_history.pos], true);
  },
  canGoBack: function() {
    return _history.pos > 0;
  },
  canGoForward: function() {
    return _history.pos + 1 < _history.stack.length;
  }
};

// UI逻辑
const v = new Vue({
  el: '#wrapper',
  data: {
    version: remote.app.getVersion(),
    showAboutOverlay: false
  },
  methods: {
    showAbout: function() {
      utils.log('主窗口：点击关于');
      this.showAboutOverlay = !this.showAboutOverlay;
      wrapper.classList.toggle('showAbout');
    },
    hideAbout: function() {
      this.showAboutOverlay = false;
      wrapper.classList.remove('showAbout');
    },
    showFeed() {
      utils.log('主窗口：点击订阅');
      _history.go('https://t.bilibili.com/?tab=8');
    },
    toggleConfig: function() {
      utils.log('主窗口：点击设置');
      ipc.send('toggle-config-window');
    },
    turnOff: function() {
      utils.log('主窗口：点击退出');
      ipc.send('close-main-window');
    }
  }
});

function detectPlatform() {
  if( process.platform.startsWith('win') ) {
    window.platform = 'win';
    document.body.classList.add('win');
  } else if( process.platform == 'darwin' ) {
    window.platform = 'darwin';
    document.body.classList.add('macos');
  }
}

function checkUpdateOnInit() {
  const now = new Date();
  const today = `${now.getFullYear()}/${now.getMonth()}/${now.getDate()}`;
  const lastCheckUpdateDate = utils.config.get('lastCheckUpdateDate');
  if( today == lastCheckUpdateDate ) return;
  
  const updateApiUrl = 'https://raw.githubusercontent.com/IsllaTOd/bilibili_For-slacking-off-at-work/main/update.json?_t=' + new Date().getTime();

  utils.ajax.get(updateApiUrl, (res) => {
    try {
      var data = JSON.parse(res);
      var order = 1, buttons = ['取消', '去下载'];
      utils.config.set('lastCheckUpdateDate', today);
      
      if(window.platform == 'win') {
        order = 0;
        buttons = ['去下载', '取消'];
      }
      
      var lastVersionArr = data.version.split('.'),
        lastVersion = lastVersionArr[0] * 10000 + lastVersionArr[1] * 100 + lastVersionArr[2],
        currentVersionArr = appData.version.split('.'),
        currentVersion = currentVersionArr[0] * 10000 + currentVersionArr[1] * 100 + currentVersionArr[2];
        
      if( lastVersion > currentVersion ) {
        dialog.showMessageBox(null, {
          buttons: buttons,
          message: `发现新版本 v${data.version}！当前版本是 v${appData.version}，是否前往下载最新版？`
        }, (res, checkboxChecked) => {
          if(res == order) {
            shell.openExternal(`https://github.com/IsllaTOd/bilibili_For-slacking-off-at-work/releases/tag/v${data.version}`);
          }
        });
      }
      
      if( data.announcement && data.announcement != '' && !localStorage.getItem(data.announcement) ) {
        dialog.showMessageBox(null, {
          buttons: ['收到'],
          message: data.announcement
        }, () => {
          localStorage.setItem(data.announcement, 1);
        });
      }
    } catch(e) {
      utils.log('检查更新失败，可能是还没配置更新服务器地址');
    }
  });
}

function saveWindowSizeOnResize() {
  var saveWindowSizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(saveWindowSizeTimer);
    saveWindowSizeTimer = setTimeout(function() {
      const currentSize = utils.config.get(currentWindowType);
      const newSize = [window.innerWidth, window.innerHeight];
      if( (currentSize[0] != newSize[0]) || (currentSize[1] != newSize[1]) ) {
        utils.config.set(currentWindowType, newSize);
      }
    }, 600);
  });
}

var currentWindowType = 'default';
function resizeMainWindow() {
  let targetWindowType, url = wv.getURL();
  if( url.indexOf('/video/') > -1 || url.indexOf('html5player.html') > -1 ||
    /\/\/live\.bilibili\.com\/blanc\/\d+/.test(url) || url.indexOf('bangumi/play/') > -1 ) {
    targetWindowType = 'windowSizeMini';
  } else if( url.indexOf('t.bilibili.com/?tab=8') > -1 ) {
    targetWindowType = 'windowSizeFeed';
  } else {
    targetWindowType = 'windowSizeDefault';
  }
  
  if( targetWindowType != currentWindowType ) {
    let mw = remote.getCurrentWindow(),
      currentSize = mw.getSize(),
      leftTopPosition = mw.getPosition(),
      rightBottomPosition = [leftTopPosition[0] + currentSize[0], leftTopPosition[1] + currentSize[1]],
      targetSize = utils.config.get(targetWindowType),
      targetPosition = [rightBottomPosition[0] - targetSize[0], rightBottomPosition[1] - targetSize[1]];
    
    if (targetPosition[0] > -targetSize[0] && targetPosition[0] < 10) {
      targetPosition[0] = 10;
    }
    targetPosition[1] = targetPosition[1] > 10 ? targetPosition[1] : 10;

    mw.setBounds({
      x: targetPosition[0],
      y: targetPosition[1],
      width: targetSize[0],
      height: targetSize[1]
    }, true);

    currentWindowType = targetWindowType;
    ipc.send('main-window-resized', targetPosition, targetSize);
  }
}

function initActionOnWebviewNavigate() {
  wv.addEventListener('did-finish-load', function() {
    let url = wv.getURL();
    utils.log(`触发 did-finish-load 事件，当前url是: ${url}`);
    _history.lastLoadedUrl = url;
    resizeMainWindow();
    wrapper.classList.remove('loading');
  });
  
  wv.addEventListener('will-navigate', function(e) {
    if( e.url.startsWith('bilibili://') ) {
      utils.log(`网页端尝试拉起App: ${e.url}`);
      e.preventDefault();
      return false;
    } else {
      utils.log(`触发 will-navigate 事件，目标: ${e.url}`);
      _history.go(e.url);
    }
  });
  
  setInterval(function() {
    const nowUrl = wv.getURL();
    if( nowUrl != _history.stack[_history.pos] && nowUrl != _history.lastLoadedUrl ) {
      utils.log(`Dirty-check检测到Webview的url改变，目标: ${nowUrl}`);
      _history.go(nowUrl);
    }
  }, 500);
  
  wv.addEventListener('new-window', function(e) {
    utils.log(`触发 new-window 事件，目标: ${e.url}`);
    _history.go(e.url);
  });
}

function openWebviewConsoleOnMenuClick() {
  ipc.on('openWebviewDevTools', () => {
    wv.openDevTools();
  });
}

function initActionOnEsc() {
  ipc.on('press-esc', (ev) => {
    let url = wv.getURL();
    if( utils.getVidWithP(url) || url.indexOf('bangumi/play') > -1 ) {
      utils.log('在播放器页面按下ESC，后退至上一页');
      _history.goBack();
    }
  });
}

function initWebviewVolumeContrlShortcuts() {
  ipc.on('change-volume', (ev, arg) => {
    wv.send('change-volume', arg);
  });
}

function initActionOnBossButtonPressed() {
  ipc.on('hide-hide-hide', () => {
    if (utils.config.get('autoPause')) {
      wv.send('hide-hide-hide');
    }
  });
}

function initMouseStateDirtyCheck() {
  var getMousePosition = remote.screen.getCursorScreenPoint,
    mw = remote.getCurrentWindow(), 
    lastStatus = 'OUT';
    
  setInterval(function() {
    let mousePos = getMousePosition(),
      windowPos = mw.getPosition(),
      windowSize = mw.getSize();
      
    function getTriggerAreaWidth() { return lastStatus == 'IN' ? 0 : 16; }
    function getTriggerAreaHeight() {
      let h = 0.1 * windowSize[1], minHeight = lastStatus == 'IN' ? 120 : 36; 
      return h > minHeight ? h : minHeight;
    }
    
    if( (mousePos.x > windowPos[0]) && (mousePos.x < windowPos[0] + windowSize[0] - getTriggerAreaWidth()) &&
        (mousePos.y > windowPos[1]) && (mousePos.y < windowPos[1] + getTriggerAreaHeight()) ) {
      if( lastStatus == 'OUT' ) {
        wrapper.classList.add('showTopBar');
        lastStatus = 'IN';
      }
    } else if( lastStatus == 'IN' ) {
      lastStatus = 'OUT';
      wrapper.classList.remove('showTopBar');
    }
  }, 200);
}

function openExternalLink(url) {
  shell.openExternal(url);
}

function logWebviewError() {
  wv.addEventListener('console-message', (err) => {
    if(err.level > 2) {
      utils.error(`Webview报错\nLine ${err.line}: ${err.message}\nwebview当前url: ${wv.getURL()}`)
    }
  });
}

window.addEventListener('DOMContentLoaded', function() {
  wrapper = document.getElementById('wrapper');
  wv = document.getElementById('wv');
  detectPlatform();
  checkUpdateOnInit();
  initActionOnWebviewNavigate();
  initActionOnEsc();
  initActionOnBossButtonPressed();
  initWebviewVolumeContrlShortcuts();
  saveWindowSizeOnResize();
  initMouseStateDirtyCheck();
  openWebviewConsoleOnMenuClick();
  logWebviewError();
});

window.onerror = function(err, f, line) {
  var id = f.split('/');
  utils.error(`${id[id.length-1]} : Line ${line}\n> ${err}`);
}