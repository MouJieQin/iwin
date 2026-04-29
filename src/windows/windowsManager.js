const { BrowserWindow, screen } = require("electron");
const path = require("path");

class WindowsManager {
    fixedWindows = {};
    /**
     * 创建置顶悬浮固定窗口
     * @param {string} winId - 窗口唯一标识符
     * @param {string} url - 窗口加载的 URL
     * @param {string} wsId - WebSocket 连接 ID
     * @param {string} session_id - 会话 ID
     */
    createFixedWindow(winId, url, wsId, session_id, inactive = false) {
        // 如果窗口已存在，直接显示并置顶
        if (this.fixedWindows[winId]?.fixedWindow) {
            const win = this.fixedWindows[winId].fixedWindow;
            if (win.isMinimized()) {
                win.restore();
            }
            if (inactive) {
                win.showInactive();
            } else {
                win.show();
            }
            return;
        }

        // 初始化窗口实例
        this.fixedWindows[winId] = {
            fixedWindow: null,
            pin: false,
            url: url,
            Id: winId,
            session_id: session_id,
        };

        const win = new BrowserWindow({
            width: 700,
            height: 1000,
            alwaysOnTop: true,
            movable: true,
            titleBarStyle: "hidden", // 隐藏原生标题栏
            // transparent: true,
            // 毛玻璃效果（仅限 macOS）
            // vibrancy: "ultra-dark",

            webPreferences: {
                preload: path.join(__dirname, "preload.js"),
                contextIsolation: true,
                nodeIntegration: false,
            },
        });

        this.fixedWindows[winId].fixedWindow = win;

        // win.webContents.openDevTools();
        // 窗口出现在鼠标右下角
        const mouse = screen.getCursorScreenPoint();
        win.setPosition(mouse.x + 20, mouse.y + 20);

        // macOS 专属优化（不压输入法、不压系统 UI）
        if (process.platform === "darwin") {
            win.setAlwaysOnTop(true, "modal-panel");
            win.setVisibleOnAllWorkspaces(false, {
                visibleOnFullScreen: true,
            });
            this.fixedWindows[winId].pin = true; // 默认固定
        } else {
            this.fixedWindows[winId].pin = false; // Windows/Linux 默认不固定
        }

        // 加载页面
        win.loadURL(url);

        // ==================== 事件监听 ====================
        // 关闭时清理内存（重要）
        win.on("close", async (e) => {
            await this._sendWebSocketMessage(wsId, {
                type: "close_fixed_window",
                data: {
                    session_id: session_id,
                    is_pinned: this.fixedWindows[winId].pin,
                },
            });
        });

        // 窗口完全销毁时清理对象
        win.on("closed", () => {
            if (this.fixedWindows[winId]) {
                this.fixedWindows[winId].fixedWindow = null;
                delete this.fixedWindows[winId];
            }
        });

        // 失焦隐藏（未固定时）
        win.on("blur", () => {
            const { pin } = this.fixedWindows[winId];
            if (!pin && win.isVisible()) {
                win.hide();
            }
        });

        win.once("ready-to-show", () => {
            if (inactive) {
                win.showInactive();
            } else {
                win.show();
            }
        });

        // 首次显示时发送 pin 状态
        win.once("show", async () => {
            if (inactive) {
                win.showInactive();
            } else {
                win.show();
            }

            // try {
            //     setTimeout(() => {
            //         sendPinStatus(wsId, this.fixedWindows[winId].pin, session_id);
            //     }, 1000);
            // } catch (err) {
            //     console.log("WebSocket 发送失败:", err);
            // }
        });
    }

    /**
     * 切换窗口固定状态（对外暴露方法）
     * @param {string} winId
     * @param {string} wsId
     * @param {string} session_id
     * @param {boolean} is_pinned - 是否固定
     */
    togglePinWindow(winId, wsId, session_id, is_pinned) {
        if (!this.fixedWindows[winId]) {
            return;
        }
        this.fixedWindows[winId].pin = is_pinned;
        this._sendPinStatus(wsId, is_pinned, session_id);
    }

    /**
     * 显示/隐藏窗口（对外暴露方法）
     * @param {string} winId
     * @param {string} url
     * @param {string} wsId
     * @param {string} session_id
     */
    toggleWindowVisible(winId, url, wsId, session_id) {
        if (!this.fixedWindows[winId]) {
            return this.createFixedWindow(winId, url, wsId, session_id);
        }
        const win = this.fixedWindows[winId].fixedWindow;
        if (win.isVisible()) {
            win.hide();
        } else {
            win.show();
            win.focus();
        }
    }

    /**
     * 显示/隐藏窗口（对外暴露方法）
     * @param {string} winId
     * @param {string} url
     * @param {string} wsId
     * @param {string} session_id
     */

    showWindow(winId, url, wsId, session_id, inactive = false) {
        if (!this.fixedWindows[winId]) {
            return this.createFixedWindow(winId, url, wsId, session_id, inactive);
        }
        const win = this.fixedWindows[winId].fixedWindow;
        if (inactive) {
            win.showInactive();
        } else {
            win.show();
        }
    }

    _sendWebSocketMessage = async (wsId, message) => {
        const ws = global.wsServer.getConnections()[wsId].ws;
        if (ws) {
            console.log("发送消息:", message);
            // 发送消息
            await ws.send(JSON.stringify(message));
        } else {
            console.log("WebSocket: id:" + wsId + "未初始化，无法发送消息");
        }
    };

    _sendPinStatus = async (wsId, pin, session_id) => {
        await this._sendWebSocketMessage(wsId, {
            type: "toggle_floating_pin",
            data: {
                session_id: session_id,
                is_pinned: pin,
            },
        });
    };
}

// 导出单例（全局唯一，方便其他文件直接引入使用）
const windowsManager = new WindowsManager();
module.exports = windowsManager;
