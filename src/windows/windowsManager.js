const { BrowserWindow, screen } = require("electron");
const path = require("path");
const configManager = require("../config/config-manager");

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

        // 从配置文件中获取窗口配置
        const windowConfig = configManager.getWindowConfig(winId);
        if (!windowConfig) {
            windowConfig = {};
        }

        // 初始化窗口实例
        this.fixedWindows[winId] = {
            fixedWindow: null,
            pin: false,
            url: url,
            Id: winId,
            session_id: session_id,
        };

        const windowWidth = windowConfig.width || 700;
        const windowHeight = windowConfig.height || 700;
        const win = new BrowserWindow({
            width: windowWidth,
            height: windowHeight,
            alwaysOnTop: windowConfig.alwaysOnTop || true,
            movable: windowConfig.movable || true,
            titleBarStyle: windowConfig.titleBarStyle || "hidden", // 隐藏原生标题栏
            // transparent: windowConfig.transparent || true,
            // 毛玻璃效果（仅限 macOS）
            // vibrancy: windowConfig.vibrancy || "ultra-dark",

            webPreferences: {
                preload: path.join(__dirname, "preload.js"),
                contextIsolation: true,
                nodeIntegration: false,
            },
        });

        this.fixedWindows[winId].fixedWindow = win;

        // win.webContents.openDevTools();

        // 窗口出现在鼠标附近但能在屏幕内完全显示
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        const mouse = screen.getCursorScreenPoint();
        let x = windowConfig.x || mouse.x + 20;
        let y = windowConfig.y || mouse.y + 20;
        if (x + windowWidth > width) {
            x = width - windowWidth;
        }
        if (y + windowHeight > height) {
            y = height - windowHeight;
        }
        win.setPosition(x, y);

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

            // 获取窗口当前位置和大小
            const [x, y] = win.getPosition();
            const [width, height] = win.getSize();

            // 获取其他常用属性
            const isAlwaysOnTop = win.isAlwaysOnTop();
            const isMovable = win.isMovable();
            const isFocused = win.isFocused();
            const isMinimized = win.isMinimized();
            const isMaximized = win.isMaximized();
            const isResizable = win.isResizable();

            // 组装成你想要的完整对象
            const windowInfo = {
                x,
                y,
                width,
                height,
                alwaysOnTop: isAlwaysOnTop,
                movable: isMovable,
                focused: isFocused,
                minimized: isMinimized,
                maximized: isMaximized,
                resizable: isResizable,
                title: win.getTitle(),
            };

            // 保存窗口数据到配置文件
            const window = this.fixedWindows[winId].fixedWindow;
            configManager.saveWindowConfig(winId, windowInfo);
        });

        win.on("closed", () => {
            // 窗口完全销毁时清理对象
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
            return this.createFixedWindow(
                winId,
                url,
                wsId,
                session_id,
                inactive,
            );
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
