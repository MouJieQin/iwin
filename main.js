const { app, BrowserWindow } = require("electron");
const trayManager = require("./src/tray/tray-manager"); // 引入托盘管理器模块
const windowsManager = require("./src/windows/windowsManager");
const httpMessageHandler = require("./src/http_api/http-message-handler");
const wsMessageHandler = require("./src/websocket_api/ws-message-handler"); // 引入全局服务
const apiServer = require("./http-api-server");
global.wsMessageHandler = wsMessageHandler; // 全局暴露 WebSocket 消息处理程序实例，供其他模块访问
global.apiServer = apiServer; // 全局暴露 HTTP 服务器实例，供其他模块访问
global.windowsManager = windowsManager; // 全局暴露窗口管理器实例，供其他模块访问

// 禁止程序显示在 Dock 栏（关键）
app.dock.hide();

// Electron 初始化完成
app.whenReady().then(async () => {
    trayManager.createWindow();
    trayManager.createTray();
    httpMessageHandler.startHttpServer();
    wsMessageHandler.startWebSocketServer();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) trayManager.createWindow();
    });
});

// 全部窗口关闭时不退出程序（mac 托盘应用标准行为）
app.on("window-all-closed", () => {});
