const http = require("http");
const apiServer = require("./http-api-server");
const axios = require("axios");

class HttpMessageHandler {
    // 启动 HTTP 接口服务
    startHttpServer() {
        // 示例接口
        apiServer.post("/api/voichai", async (json, callback) => {
            console.log("收到 voichai 消息：", json);

            try {
                const { type, data } = json;

                // ✅ 关键：setup 不再传入 callback，只返回结果
                const setupOk = await this._handle_voichai_message_setup();
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
                        this._handle_voichai_toggle_top_window(data);
                        break;
                    case "show_top_window":
                        this._handle_voichai_show_top_window(data);
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
                const setupOk = await this._handle_mxdict_message_setup();
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
                        this._handle_mxdict_toggle_top_window(data);
                        break;
                    case "show_top_window":
                        this._handle_mxdict_show_top_window(data);
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

    async _handle_voichai_message_setup() {
        // 已经连接，直接返回成功
        if (global.wsServer.getConnections()["/ws/voichai"]) {
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
    async _handle_mxdict_message_setup() {
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

    _handle_voichai_toggle_top_window(data) {
        const winId = data.win_id;
        const url = data.url;
        const session_id = data.session_id;
        const connections = global.wsServer.getConnections();
        const wsId = Object.values(connections).find(
            (client) => client.path === "/ws/voichai",
        )?.id;
        global.windowsManager.toggleWindowVisible(winId, url, wsId, session_id);
        console.log("toggle top window:", data);
    }

    _handle_voichai_show_top_window(data) {
        const winId = data.win_id;
        const url = data.url;
        const session_id = data.session_id;
        const connections = global.wsServer.getConnections();
        const wsId = Object.values(connections).find(
            (client) => client.path === "/ws/voichai",
        )?.id;
        global.windowsManager.showWindow(winId, url, wsId, session_id);
        console.log("show top window:", data);
    }

    _handle_mxdict_toggle_top_window(data) {
        const winId = data.win_id;
        const url = data.url;
        const session_id = data.session_id;
        const connections = global.wsServer.getConnections();
        const wsId = Object.values(connections).find(
            (client) => client.path === "/ws/mxdict",
        )?.id;
        global.windowsManager.toggleWindowVisible(winId, url, wsId, session_id);
        console.log("toggle top window:", data);
    }

    _handle_mxdict_show_top_window(data) {
        const winId = data.win_id;
        const url = data.url;
        const session_id = data.session_id;
        const inactive = data.inactive || false; // 是否显示但不激活

        const connections = global.wsServer.getConnections();
        const wsId = Object.values(connections).find(
            (client) => client.path === "/ws/mxdict",
        )?.id;
        global.windowsManager.showWindow(winId, url, wsId, session_id, inactive);
        console.log("show top window:", data);
    }
}


// 导出单例（全局唯一，方便其他文件直接引入使用）
const httpMessageHandler = new HttpMessageHandler();
module.exports = httpMessageHandler;
