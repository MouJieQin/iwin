const { exec } = require("child_process");
const { dialog } = require("electron");

function runShellCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stderr });
            } else {
                resolve(stdout);
            }
        });
    });
}

async function runShellCommandDialog(command) {
    await runShellCommand(command)
        .then((stdout) => {
            console.log("Output:", `${stdout}`);
            return;
        })
        .catch(async ({ error, stderr }) => {
            const options = {
                type: "error",
                message: `${command}`,
                detail: `${stderr}`,
                buttons: ["OK"],
            };
            await dialog.showMessageBox(options);
            return;
        });
}