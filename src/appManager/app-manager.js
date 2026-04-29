const {
    runShellCommandDialog,
    runShellCommand,
} = require("../common/shell-command");
const configManager = require("../config/config-manager");

class AppManager {
    constructor() {
        this.mxdictTop = false;
        this.voichaiTop = false;
        this.config = configManager.getConfig();
        this.keyboardConfig = this.config.keyboard || {};
        this.keyboardRootPath = this.keyboardConfig.root_path || "";
    }
    async checkKeyboardRunning() {
        const checkCommand =
            "ps -ef | grep -v grep|grep -i -v code |grep -v tail| grep cg_event_handler >/dev/null";
        return await runShellCommand(checkCommand)
            .then((stdout) => {
                return true;
            })
            .catch(async ({ error, stderr }) => {
                return false;
            });
    }
    async launchKeyboard() {
        const launchCommand =
            "cd " +
            this.keyboardRootPath +
            " && " +
            " nohup ./cg_event_handler >>" +
            this.keyboardRootPath +
            "/cg_event_handler.2.log 2>&1 &";
        return await runShellCommand(launchCommand);
    }
    async stopKeyboard() {
        const stopCommand =
            "ps -ef | grep -v grep|grep -i -v code |grep -v tail| grep cg_event_handler | awk '{print $2}' | xargs -I {} kill -9 {}";
        return await runShellCommand(stopCommand);
    }
    async checkMxdictRunning() {
        return await global.httpMessageHandler.check_mxdict_running();
    }
    async checkVoichaiRunning() {
        return await global.httpMessageHandler.check_voichai_running();
    }
}

const appManager = new AppManager();
module.exports = appManager;
