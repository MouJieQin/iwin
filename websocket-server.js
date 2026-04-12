const { WebSocketServer } = require("ws");
const { v4: uuidv4 } = require("uuid"); // 生成唯一客户端ID

class WebSocketServerManager {
    constructor(port) {
        this.port = port;
        this.wss = null;

        // 【核心存储】结构：
        // this.connections = {
        //   "/ws/aichat/windows": [ { id, ws, path }, ... ],
        //   "/ws/aichat/electron": [ ... ]
        // }
        this.connections = {};

        // 全局事件回调（外部监听用）
        this.onClientConnected = null; // 客户端连上
        this.onClientDisconnected = null; // 客户端断开
        this.onMessageReceived = null; // 收到消息
    }

    // 启动服务器
    start() {
        if (this.wss) return;

        this.wss = new WebSocketServer({ port: this.port });
        console.log(
            `✅ WebSocket 多路径服务器启动：ws://localhost:${this.port}`,
        );

        this.wss.on("connection", (ws, request) => {
            // 🔴 关键：获取客户端连接的路径
            const path = request.url;
            // 生成唯一ID
            const clientId = path + "-" + uuidv4();

            // 存入分组
            if (!this.connections[clientId]) this.connections[clientId] = [];
            const clientInfo = { ws: ws, id: clientId, path: path };
            this.connections[clientId] = clientInfo;
            const msg = {
                type: "client_id",
                data: { client_id: clientId },
            };
            ws.send(JSON.stringify(msg));
            // this._sendIdToClient(clientId); // 连接成功后，发送唯一ID给客户端

            console.log(`📥 新连接 [${path}] 客户端ID：${clientId}`);
            if (this.onClientConnected) {
                this.onClientConnected(clientInfo);
            }

            // 消息监听
            ws.on("message", (data) => {
                const msg = data.toString();
                if (this.onMessageReceived) {
                    this.onMessageReceived(clientInfo, msg);
                }
            });

            // 断开连接
            ws.on("close", () => {
                this._removeClient(path, clientId);
                if (this.onClientDisconnected) {
                    this.onClientDisconnected(clientInfo);
                }
            });

            // 错误
            ws.on("error", (err) => {
                console.error(`❌ [${path}] 客户端错误：`, err);
            });
        });
    }

    _sendIdToClient(clientID) {
        this.connections[clientID]?.ws.send({
            type: "client_id",
            data: { client_id: clientID },
        });
    }

    // 🔴 移除断开的客户端
    _removeClient(path, clientId) {
        if (!this.connections[clientId]) {
            return;
        }
        delete this.connections[clientId];
    }

    // ------------------------------
    // 外部调用：发送消息方法
    // ------------------------------

    // 1. 发给【某个路径】的所有客户端
    sendToPath(path, message) {
        this.connections.forEach((client) => {
            if (
                client.path === path &&
                client.ws.readyState === WebSocket.OPEN
            ) {
                client.ws.send(JSON.stringify(message));
            }
        });
    }

    // 2. 发给【单个客户端】（通过ID）
    sendToClient(clientId, message) {
        try {
            this.connections[clientId]?.ws.send(JSON.stringify(message));
            return true;
        } catch (err) {
            console.error(`发送消息失败，客户端ID：${clientId}，错误：`, err);
            return false;
        }
    }

    // 3. 广播所有客户端
    sendToAll(message) {
        Object.values(this.connections).forEach((clients) => {
            clients.forEach(
                (c) =>
                    c.ws.readyState === WebSocket.OPEN &&
                    c.ws.send(JSON.stringify(message)),
            );
        });
    }

    // 4. 获取当前所有连接（给其他代码用）
    getConnections() {
        return this.connections;
    }

    // 关闭服务器
    stop() {
        if (this.wss) {
            this.wss.close();
            this.wss = null;
            this.connections = {};
            console.log("🛑 WebSocket 服务器已关闭");
        }
    }
}

// 导出单例（全局唯一，方便其他文件直接引入使用）
const wsServer = new WebSocketServerManager(9999);
module.exports = wsServer;
