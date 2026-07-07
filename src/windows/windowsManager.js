const { BrowserWindow, screen } = require("electron");
const path = require("path");
const axios = require("axios");
const configManager = require("../config/config-manager");
const cgEventMessageHandler = require("../websocket_api/ws-cg-event-message-handler"); // 引入全局服务

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
            show: !inactive,
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

        win.setMinimizable(false);
        win.setMaximizable(false);

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
        if (inactive) {
            // win.showInactive();
            this.registerleftMouseDownEvent(winId);
        }

        // ==================== 事件监听 ====================
        // 关闭时清理内存（重要）
        win.on("close", async (e) => {
            // 保存窗口数据到配置文件
            // this.saveWindowInfo(winId);

            if (!app.isQuitting && inactive) {
                e.preventDefault();
                win.hide();
            } else {
                await this._sendWebSocketMessage(wsId, {
                    type: "close_fixed_window",
                    data: {
                        session_id: session_id,
                        is_pinned: this.fixedWindows[winId].pin,
                    },
                });
            }
        });

        win.on("closed", () => {
            // 窗口完全销毁时清理对象
            if (this.fixedWindows[winId]) {
                this.fixedWindows[winId].fixedWindow = null;
                delete this.fixedWindows[winId];
            }
            // 注销事件
            cgEventMessageHandler.unregisterEvent(
                winId,
                "kCGEventLeftMouseDown",
            );
        });

        win.on("focus", () => {
            cgEventMessageHandler.unregisterEvent(
                winId,
                "kCGEventLeftMouseDown",
            );
        });

        win.on("hide", () => {
            cgEventMessageHandler.unregisterEvent(
                winId,
                "kCGEventLeftMouseDown",
            );
        });

        // 失焦隐藏（未固定时）
        win.on("blur", () => {
            const { pin } = this.fixedWindows[winId];
            const is_editing = this.fixedWindows[winId].is_editing || false;
            if (!pin && win.isVisible() && !is_editing) {
                win.hide();
            }
        });

        win.once("ready-to-show", () => {
            if (inactive) {
                console.log("ready-to-show-inactive");
            } else {
                win.show();
            }
        });

        win.once("show", async () => {
            if (inactive) {
                console.log("show-inactive");
                // win.hide();
                win.showInactive();
            } else {
                win.show();
            }
        });
    }

    saveWindowInfo(winId) {
        const win = this.fixedWindows[winId].fixedWindow;
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
        configManager.saveWindowConfig(winId, windowInfo);
    }

    /**
     * @param {string} winId
     * @param {boolean} is_editing
     */

    setWindownNoteEditingSatus(winId, is_editing) {
        if (!this.fixedWindows[winId]) {
            return;
        }
        this.fixedWindows[winId].is_editing = is_editing;
        if (winId === global.fstdict_selection_search_window_winId) {
            if (is_editing) {
                this.unregisterhandlerEventTextSelection(winId);
            } else {
                this.registerhandlerEventTextSelection(winId);
            }
        }
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
     * @param {boolean} inactive - 是否显示但不激活
     */
    toggleWindowVisible(winId, url, wsId, session_id, inactive = false) {
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
        if (win.isVisible()) {
            win.hide();
        } else {
            win.show();
            win.focus();
        }
        return win;
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
            // 注册事件回调
            if (!this.fixedWindows[winId].pin) {
                this.registerleftMouseDownEvent(winId);
            }
        } else {
            win.show();
        }
    }

    registerleftMouseDownEvent = (winId) => {
        const win = this.fixedWindows[winId].fixedWindow;
        cgEventMessageHandler.registerEvent(
            winId,
            "kCGEventLeftMouseDown",
            (data) => {
                const x = data.x;
                const y = data.y;
                const [winX, winY] = win.getPosition();
                const [width, height] = win.getSize();
                if (!win.isFocused()) {
                    if (
                        !(
                            x >= winX &&
                            x <= winX + width &&
                            y >= winY &&
                            y <= winY + height
                        )
                    ) {
                        if (!this.fixedWindows[winId].pin) {
                            win.hide();
                        }
                    }
                }
            },
        );
    };

    registerhandlerEventTextSelection = (winId) => {
        const win = this.fixedWindows[winId].fixedWindow;
        const session_id = this.fixedWindows[winId].session_id;
        cgEventMessageHandler.registerEvent(
            winId,
            "handlerEventTextSelection",
            async (data) => {
                console.log(
                    "[CGEvent handlerEventTextSelection Callback]:",
                    data,
                );
                if (this.fixedWindows[winId].pin) {
                    win.showInactive();
                } else {
                    // 🔥 核心：获取鼠标【当前所在的屏幕】，而不是主屏幕
                    const mouse = screen.getCursorScreenPoint();
                    const currentDisplay = screen.getDisplayNearestPoint(mouse); // 关键修复！
                    const {
                        x: screenX,
                        y: screenY,
                        width: swidth,
                        height: sheight,
                    } = currentDisplay.workArea;

                    // 窗口在鼠标附近弹出
                    let x = mouse.x + 20;
                    let y = mouse.y + 20;
                    const [winWidth, winHeight] = win.getSize();

                    // ===================== 屏幕内自动适配 =====================
                    // 右边超出 → 往左放
                    if (x + winWidth > screenX + swidth) {
                        x = screenX + swidth - winWidth - 8; // 留8px边距
                    }
                    // 下边超出 → 往上放
                    if (y + winHeight > screenY + sheight) {
                        y = screenY + sheight - winHeight - 8;
                    }
                    // 左边太靠左 → 修正
                    if (x < screenX + 8) {
                        x = screenX + 8;
                    }
                    // 上边太靠上 → 修正
                    if (y < screenY + 8) {
                        y = screenY + 8;
                    }

                    // 定位并显示
                    win.setPosition(x, y);
                    win.showInactive();
                }
                if (!win.pin) {
                    global.windowsManager.registerleftMouseDownEvent(winId);
                }
                const text_selected = data.text_selected;
                // 1. 调用 Python 接口
                const response = await axios.post(
                    "http://localhost:5959/api/command",
                    {
                        type: "lookup_keyword_request",
                        data: {
                            keyword: text_selected,
                            session_id: session_id,
                        },
                    },
                );
                if (!response.data.success) {
                    log.error("lookup_keyword_request 失败");
                    return;
                }
            },
        );
    };

    unregisterhandlerEventTextSelection = (winId) => {
        cgEventMessageHandler.unregisterEvent(
            winId,
            "handlerEventTextSelection",
        );
    };

    _sendWebSocketMessage = async (wsId, message) => {
        const connection = global.wsServer.getConnections()[wsId];
        if (!connection) {
            return;
        }
        const ws = connection.ws;
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
