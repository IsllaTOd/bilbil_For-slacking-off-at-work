# bilbil-hide-it（上班摸鱼）

* **新增右键菜单配置**：🌟 关注动态、🔴 正在直播（暂时无法屏蔽弹幕）、📺 稍后再看、🏠 返回 B 站首页
* **修复失效按键**：esc返回、←后退、→前进、↑增加音量、↓减少音量、F1老板键、F2秒退键、F5刷新界面、空格暂停/播放。
* **修复无边框拖拽失效问题**
* **减少白屏崩溃**：白屏与网络有关，长时间白屏请按F5多刷新几次。

广告弹窗会有点多，有可能会随着bilbil的更新而失效。

---

## 只打包了64位，可以直接下载安装包，不用下载整个仓库。

---

### 运行环境
https://nodejs.org/zh-cn/download

### For Developers

```
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

```
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install
```
```
npm start
```

---

####  **Acknowledgements**

本项目是基于原作者开源的桌面悬浮摸鱼项目 (https://github.com/chitosai/bilimini#for-developers)进行的二次开发与修复版本。

