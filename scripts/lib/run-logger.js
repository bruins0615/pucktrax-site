const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { formatWithOptions } = require("node:util");

function createRunLogger(runName = "collection") {
    const directory = path.resolve("logs");
    fs.mkdirSync(directory, { recursive: true });

    const timestamp = new Date().toISOString()
        .replace(/[:.]/g, "-");

    const safeName = runName.replace(/[^a-zA-Z0-9_-]/g, "-");

    const logFile = path.join(
        directory,
        `${safeName}-${timestamp}-${randomUUID()}.log`
    );

    fs.writeFileSync(logFile, "", { flag: "wx" });

    function write(level, values) {
        const message = formatWithOptions(
            { colors: false, depth: null },
            ...values
        );

        const entry =
            `[${new Date().toISOString()}] [${level}] ${message}`;

        fs.appendFileSync(logFile, `${entry}\n`);

        if (level === "ERROR") {
            console.error(entry);
        } else {
            console.log(entry);
        }
    }

    return {
        logFile,
        log: (...values) => write("INFO", values),
        error: (...values) => write("ERROR", values)
    };
}

module.exports = { createRunLogger };