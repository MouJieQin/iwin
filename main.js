const { app, Tray, screen, Menu, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const fixedWindowsManager = require("./fixedWindowsManager.js");

let webSocket = {};

// 保持窗口的全局引用，防止被垃圾回收
let win;
let tray;

// 禁止程序显示在 Dock 栏（关键）
app.dock.hide();

// websocket
function retryWebsocketConnection() {
    let timer = setTimeout(async () => {
        clearTimeout(timer);
        if (webSocket.readyState !== WebSocket.OPEN) {
            try {
                await webSocketManager();
            } catch (error) {
                console.log("This could be an expected exception:", error);
                return [];
            }
        }
    }, 5000);
}

async function handleMessage(message) {
    switch (message.type) {
        case "new_window":
            createWindow(message.data.url);
            break;
        case "update_theme":
            if (message.data.theme === "auto") {
                nativeTheme.themeSource = "system";
            } else {
                nativeTheme.themeSource = message.data.theme;
            }
            break;
        case "toggle_top_window":
            fixedWindowsManager.toggleWindowVisible(message.data.url);
            break;
        case "toggle_float_pin":
            fixedWindowsManager.togglePinWindow(message.data.url);
            break;
        default:
            break;
    }
}

const options = {
    rejectUnauthorized: false, // Bypass SSL certificate verification
};

const agent = new http.Agent(options);

async function webSocketManager() {
    try {
        const wsUrl = "ws://localhost:4999/ws/aichat/windows";
        webSocket = new WebSocket(wsUrl, { agent });
        global.webSocket = webSocket;
        webSocket.onerror = (error) => {
            // console.error("WebSocket error:", error);
        };
        // webSocket.onopen = (event) => {};
        webSocket.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            console.log("message:", message);
            await handleMessage(message);
        };
        webSocket.onclose = (event) => {
            retryWebsocketConnection();
        };
    } catch (error) {
        console.error("WebSocket error:", error);
        retryWebsocketConnection();
    }
}

// 主窗口相关代码

function createWindow() {
    // 创建一个小窗口，点击托盘图标弹出
    win = new BrowserWindow({
        width: 300,
        height: 400,
        // 窗口样式：无边框、不显示任务栏、始终置顶
        frame: false,
        show: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    // 加载页面
    win.loadFile("index.html");

    // 点击窗口外部自动关闭
    win.on("blur", () => {
        win.hide();
    });
}

function createTray() {
    // 托盘图标（macOS 推荐使用 16x16、黑色透明图标）
    const iconPath = path.join(__dirname, "icon.png");
    tray = new Tray(iconPath);

    // 托盘菜单
    const contextMenu = Menu.buildFromTemplate([
        { label: "显示窗口", click: () => win.show() },
        { type: "separator" },
        { label: "退出", click: () => app.quit() },
    ]);

    tray.setToolTip("我的 Electron 菜单栏应用");
    tray.setContextMenu(contextMenu);

    // 点击托盘图标切换窗口显示/隐藏
    tray.on("click", () => {
        if (win.isVisible()) {
            win.hide();
        } else {
            // 让窗口显示在托盘图标正下方
            const trayBounds = tray.getBounds();
            const windowBounds = win.getBounds();

            const x = Math.round(
                trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2,
            );
            const y = Math.round(trayBounds.y + trayBounds.height);

            win.setPosition(x, y);
            win.show();
        }
    });
}

// Electron 初始化完成
app.whenReady().then(async () => {
    createWindow();
    createTray();
    await webSocketManager();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// 全部窗口关闭时不退出程序（mac 托盘应用标准行为）
app.on("window-all-closed", () => {});
