const { app, Tray, screen, Menu, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const axios = require("axios");
const fixedWindowsManager = require("./fixedWindowsManager");
const wsServer = require("./websocket-server"); // 引入全局服务
const apiServer = require("./http-api-server");
global.wsServer = wsServer;

let webSocket = {};

// 保持窗口的全局引用，防止被垃圾回收
let win;
let tray;

// 禁止程序显示在 Dock 栏（关键）
app.dock.hide();

function startWebSocketServer() {
    wsServer.start();
    // 监听服务事件 → 推送到界面
    wsServer.onClientConnected = (client) => {
        console.log("log", `✅ 连接：${client.path} (${client.id})`);
    };

    wsServer.onClientDisconnected = (client) => {
        console.log("log", `❌ 断开：${client.path}`);
    };

    wsServer.onMessageReceived = (client, msg) => {
        console.log("log", `📩 ${client.path}：${msg}`);
    };
}

// 启动 HTTP 接口服务
function startHttpServer() {
    // 示例接口
    apiServer.post("/api/voichai", (json, callback) => {
        console.log("收到 POST JSON：", json);
        callback({ success: true, data: "已接收" });
    });

    // ✅ 修复后的 mxdict 接口
    apiServer.post("/api/mxdict", async (json, callback) => {
        console.log("收到 mxdict 消息：", json);

        try {
            const { type, data } = json;

            // ✅ 关键：setup 不再传入 callback，只返回结果
            const setupOk = await handl_mxdict_message_setup();
            if (!setupOk) {
                callback({
                    success: false,
                    msg: "mxdict 未连接或连接超时",
                });
                return;
            }

            // 处理业务
            switch (type) {
                case "toggle_top_window":
                    handle_mxdict_toggle_top_window(data);
                    break;
                default:
                    callback({ success: false, msg: "未知 type 类型" });
                    return;
            }

            // 成功返回
            callback({ success: true, msg: "处理完成" });
        } catch (err) {
            console.error("处理 mxdict 错误：", err);
            callback({ success: false, msg: "服务器错误：" + err.message });
        }
    });

    apiServer.start();
}

// ✅ 不再传入 callback，只返回 true/false
async function handl_mxdict_message_setup() {
    // 已经连接，直接返回成功
    if (global.wsServer.connections["/ws/mxdict"]) {
        return true;
    }

    try {
        // 1. 调用 Python 接口
        const response = await axios.get(
            "http://localhost:5959/api/connectiwin",
        );

        // 2. 检查返回状态
        if (!response.data.status) {
            console.log("❌ 命令 mxdict 连接 iwin 失败");
            return false;
        }

        // 3. 等待连接成功（最多 5 秒）
        let waiting_count = 0;
        while (waiting_count < 10) {
            // console.log("global.wsServer:", global.wsServer);
            // console.log("wsServer:", wsServer);

            if (global.wsServer.connections["/ws/mxdict"]) {
                return true;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
            waiting_count++;
        }

        // 超时
        console.log("❌ 等待 mxdict 连接超时");
        return false;
    } catch (err) {
        console.log("❌ 请求 connectiwin 接口失败：", err.message);
        return false;
    }
}

function handle_mxdict_toggle_top_window(data) {
    fixedWindowsManager.toggleWindowVisible(data.url);
    console.log("toggle top window:", data.url);
}

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
    startHttpServer();
    startWebSocketServer();
    await webSocketManager();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// 全部窗口关闭时不退出程序（mac 托盘应用标准行为）
app.on("window-all-closed", () => {});
