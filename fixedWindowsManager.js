const { BrowserWindow, screen } = require("electron");
const path = require("path");

// 全局存储所有固定窗口实例
const fixedWindows = {};

/**
 * 创建置顶悬浮固定窗口
 * @param {string} url - 窗口加载的 URL，默认本地 3999
 */
function createFixedWindow(url = "http://localhost:3999/") {
    // 如果窗口已存在，直接显示并置顶
    if (fixedWindows[url]?.fixedWindow) {
        const win = fixedWindows[url].fixedWindow;
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
        return;
    }

    // 初始化窗口实例
    fixedWindows[url] = { fixedWindow: null, pin: false };

    const win = new BrowserWindow({
        width: 700,
        height: 1000,
        alwaysOnTop: true,
        movable: true,
        titleBarStyle: "hidden", // 隐藏原生标题栏
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    fixedWindows[url].fixedWindow = win;

    // 窗口出现在鼠标右下角
    const mouse = screen.getCursorScreenPoint();
    win.setPosition(mouse.x + 20, mouse.y + 20);

    // macOS 专属优化（不压输入法、不压系统 UI）
    if (process.platform === "darwin") {
        win.setAlwaysOnTop(true, "modal-panel");
        win.setVisibleOnAllWorkspaces(false, {
            visibleOnFullScreen: true,
        });
        fixedWindows[url].pin = true; // 默认固定
    } else {
        fixedWindows[url].pin = false; // Windows/Linux 默认不固定
    }

    // 加载页面
    win.loadURL(url);

    // ==================== 事件监听 ====================
    // 关闭时清理内存（重要）
    win.on("close", (e) => {});

    // 窗口完全销毁时清理对象
    win.on("closed", () => {
        if (fixedWindows[url]) {
            fixedWindows[url].fixedWindow = null;
            delete fixedWindows[url];
        }
    });

    // 失焦隐藏（未固定时）
    win.on("blur", () => {
        const { pin } = fixedWindows[url];
        if (!pin && win.isVisible()) {
            win.hide();
        }
    });

    // 首次显示时发送 WebSocket 状态
    win.once("show", async () => {
        try {
            setTimeout(() => {
                sendPinStatus(url);
            }, 1000);
        } catch (err) {
            console.log("WebSocket 发送失败:", err);
        }
    });
}

const sendWebSocketMessage = async (message) => {
    if (global.webSocket) {
        await global.webSocket.send(JSON.stringify(message));
    } else {
        console.log("WebSocket 未初始化，无法发送消息");
    }
};

const sendPinStatus = async (url) => {
    const slices = url.split("/");
    const session_id = slices[slices.length - 1] || "";
    await sendWebSocketMessage({
        type: "toggle_float_pin",
        data: {
            url,
            session_id,
            is_pinned: fixedWindows[url].pin,
        },
    });
};

/**
 * 切换窗口固定状态（对外暴露方法）
 * @param {string} url
 */
function togglePinWindow(url) {
    if (!fixedWindows[url]) return;
    fixedWindows[url].pin = !fixedWindows[url].pin;
    sendPinStatus(url);
}

/**
 * 显示/隐藏窗口（对外暴露方法）
 * @param {string} url
 */
function toggleWindowVisible(url) {
    if (!fixedWindows[url]) return createFixedWindow(url);
    const win = fixedWindows[url].fixedWindow;
    if (win.isVisible()) {
        win.hide();
    } else {
        win.show();
        win.focus();
    }
}

module.exports = {
    createFixedWindow,
    togglePinWindow,
    toggleWindowVisible,
};
