const { app, Tray, screen, Menu, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const axios = require("axios");
const fixedWindowsManager = require("./fixedWindowsManager");
const wsServer = require("./websocket-server"); // 引入全局服务
const apiServer = require("./http-api-server");
global.wsServer = wsServer; // 全局暴露 WebSocket 服务器实例，供其他模块访问
global.apiServer = apiServer; // 全局暴露 HTTP 服务器实例，供其他模块访问

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
        // 处理来自websocket的消息
        handel_websocket_message(client, msg);
    };
}

function handel_websocket_message(client, msg) {
    switch (client.path) {
        case "/ws/voichai":
            handle_voichai_websocket_message(client, msg);
            break;
        case "/ws/mxdict":
            handle_mxdict_websocket_message(client, msg);
            break;
        default:
            console.warn("未知路径消息：", client.path);
    }
}

const handle_voichai_websocket_message = (client, msg) => {
    // 处理来自 voichai 的消息
    console.log("处理 voichai 消息：", msg);
    try {
        const message = JSON.parse(msg);
        switch (message.type) {
            case "toggle_floating_pin":
                handle_voichai_toggle_floating_pin(message.data);
                break;
            default:
                break;
        }
    } catch (err) {
        console.error("解析 JSON 消息失败：", err);
    }
};

function handle_voichai_toggle_floating_pin(data) {
    const winId = "voichai-chat-" + data.session_id;
    const wsId = data.client_id;
    const session_id = data.session_id;
    fixedWindowsManager.togglePinWindow(winId, wsId, session_id);
}

const handle_mxdict_websocket_message = (client, msg) => {
    // 处理来自 mxdict 的消息
    console.log("处理 mxdict 消息：", msg);
    try {
        const message = JSON.parse(msg);
        switch (message.type) {
            case "toggle_floating_pin":
                handle_mxdict_toggle_floating_pin(message.data);
                break;
            default:
                break;
        }
    } catch (err) {
        console.error("解析 JSON 消息失败：", err);
    }
};

function handle_mxdict_toggle_floating_pin(data) {
    const winId = "mxdict-dict-" + data.session_id;
    const wsId = data.client_id;
    const session_id = data.session_id;
    fixedWindowsManager.togglePinWindow(winId, wsId, session_id);
}

// 启动 HTTP 接口服务
function startHttpServer() {
    // 示例接口
    apiServer.post("/api/voichai", async (json, callback) => {
        console.log("收到 voichai 消息：", json);

        try {
            const { type, data } = json;

            // ✅ 关键：setup 不再传入 callback，只返回结果
            const setupOk = await handle_voichai_message_setup();
            if (!setupOk) {
                callback({
                    success: false,
                    msg: "voichai 未连接或连接超时",
                });
                return;
            }

            // 处理业务
            switch (type) {
                case "toggle_top_window":
                    handle_voichai_toggle_top_window(data);
                    break;
                case "show_top_window":
                    handle_voichai_show_top_window(data);
                    break;
                default:
                    callback({ success: false, msg: "未知 type 类型" });
                    return;
            }

            // 成功返回
            callback({ success: true, msg: "处理完成" });
        } catch (err) {
            console.error("处理 voichai 错误：", err);
            callback({ success: false, msg: "服务器错误：" + err.message });
        }
    });

    // ✅ 修复后的 mxdict 接口
    apiServer.post("/api/mxdict", async (json, callback) => {
        console.log("收到 mxdict 消息：", json);

        try {
            const { type, data } = json;

            // ✅ 关键：setup 不再传入 callback，只返回结果
            const setupOk = await handle_mxdict_message_setup();
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
                case "show_top_window":
                    handle_mxdict_show_top_window(data);
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

async function handle_voichai_message_setup() {
    // 已经连接，直接返回成功
    if (global.wsServer.connections["/ws/voichai"]) {
        return true;
    }

    try {
        // 1. 调用 Python 接口
        const response = await axios.get(
            "http://localhost:4999/api/connectiwin",
        );

        // 2. 检查返回状态
        if (!response.data.status) {
            console.log("❌ 命令 mxdict 连接 iwin 失败");
            return false;
        }

        // 3. 等待连接成功（最多 5 秒）
        let waiting_count = 0;
        while (waiting_count < 10) {
            const connections = global.wsServer.getConnections();
            const connection = Object.values(connections).find(
                (client) => client.path === "/ws/voichai",
            );
            if (connection) {
                return true;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
            waiting_count++;
        }

        // 超时
        console.log("❌ 等待 voichai 连接超时");
        return false;
    } catch (err) {
        console.log("❌ 请求 connectiwin 接口失败：", err.message);
        return false;
    }
}

// ✅ 不再传入 callback，只返回 true/false
async function handle_mxdict_message_setup() {
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
            const connections = global.wsServer.getConnections();
            const connection = Object.values(connections).find(
                (client) => client.path === "/ws/mxdict",
            );
            if (connection) {
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

function handle_voichai_toggle_top_window(data) {
    const winId = data.win_id;
    const url = data.url;
    const session_id = data.session_id;
    const connections = global.wsServer.getConnections();
    const wsId = Object.values(connections).find(
        (client) => client.path === "/ws/voichai",
    )?.id;
    fixedWindowsManager.toggleWindowVisible(winId, url, wsId, session_id);
    console.log("toggle top window:", data);
}

function handle_voichai_show_top_window(data) {
    const winId = data.win_id;
    const url = data.url;
    const session_id = data.session_id;
    const connections = global.wsServer.getConnections();
    const wsId = Object.values(connections).find(
        (client) => client.path === "/ws/voichai",
    )?.id;
    fixedWindowsManager.showWindow(winId, url, wsId, session_id);
    console.log("show top window:", data);
}

function handle_mxdict_toggle_top_window(data) {
    const winId = data.win_id;
    const url = data.url;
    const session_id = data.session_id;
    const connections = global.wsServer.getConnections();
    const wsId = Object.values(connections).find(
        (client) => client.path === "/ws/mxdict",
    )?.id;
    fixedWindowsManager.toggleWindowVisible(winId, url, wsId, session_id);
    console.log("toggle top window:", data);
}

function handle_mxdict_show_top_window(data) {
    const winId = data.win_id;
    const url = data.url;
    const session_id = data.session_id;
    const connections = global.wsServer.getConnections();
    const wsId = Object.values(connections).find(
        (client) => client.path === "/ws/mxdict",
    )?.id;
    fixedWindowsManager.showWindow(winId, url, wsId, session_id);
    console.log("show top window:", data);
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
