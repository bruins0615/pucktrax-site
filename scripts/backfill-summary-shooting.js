const fs = require("fs");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

const outputFile = "data/skater-performance.csv";
const newField = "timeOnIcePerGame5v5SummaryShooting";

const hasValue = (value) =>
    value !== undefined && value !== null && value !== "";

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSkaterStats(playerId, seasonId, report = "summary") {
    const url =
        `https://api.nhle.com/stats/rest/en/skater/${report}` +
        "?isAggregate=false" +
        "&isGame=false" +
        `&cayenneExp=playerId=${playerId} and seasonId=${seasonId} and gameTypeId=2` +
        "&limit=20";

    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Wait 2 seconds before every request
        await sleep(2000);

        try {
            const response = await fetch(encodeURI(url));

            if (response.status === 429) {
                const retryAfter = response.headers.get("retry-after");

                let waitMs = Math.min(15000 * (2 ** (attempt - 1)), 120000);

                if (retryAfter) {
                    const seconds = Number(retryAfter);

                    if (Number.isFinite(seconds)) {
                        waitMs = Math.max(0, seconds * 1000);
                    } else {
                        const retryDate = Date.parse(retryAfter);

                        if (!Number.isNaN(retryDate)) {
                            waitMs = Math.max(0, retryDate - Date.now());
                        }
                    }
                }

                console.log(
                    `Rate limited (${report}). Waiting ${Math.ceil(waitMs / 1000)} seconds.`
                );

                if (attempt === maxAttempts) {
                    throw new Error("HTTP 429: Maximum retries reached");
                }

                await sleep(waitMs);
                continue;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            return data.data?.[0] ?? null;

        } catch (error) {
            console.log(
                `NHL Stats API error (${report}, attempt ${attempt}/${maxAttempts}): ${error.message}`
            );

            if (attempt === maxAttempts) {
                throw new Error(
                    `Failed to retrieve ${report} for player ${playerId}, season ${seasonId}: ${error.message}`
                );
            }

            await sleep(5000);
        }
    }

    throw new Error(
        `Failed to retrieve ${report} for player ${playerId}, season ${seasonId}`
    );
}

async function main() {
    const csvText = fs.readFileSync(outputFile, "utf8");

    const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true
    });

    const pendingRecords = records.filter(
        (record) => !hasValue(record[newField])
    );

    console.log(
        `Loaded ${records.length} records; ${pendingRecords.length} need backfilling.`
    );

    // Back up the CSV before changing it
    if (pendingRecords.length > 0) {
        const backupFile = `${outputFile}.before-summary-shooting-backfill.csv`;

        if (!fs.existsSync(backupFile)) {
            fs.copyFileSync(outputFile, backupFile);
            console.log(`Backup saved: ${backupFile}`);
        }
    }

    let updated = 0;
    let failed = 0;

    for (const record of pendingRecords) {
        try {
            const stats = await getSkaterStats(
                record.playerId,
                record.season,
                "summaryshooting"
            );

            const iceTime = stats?.timeOnIcePerGame5v5;

            if (!Number.isFinite(iceTime) || iceTime <= 0) {
                throw new Error("Missing or invalid five-on-five ice time");
            }

            // Change only the new field on this existing record
            record[newField] = iceTime;

            const columns = [
                ...new Set(records.flatMap((saved) => Object.keys(saved)))
            ];

            const csvOutput = stringify(records, {
                header: true,
                columns
            });

            fs.writeFileSync(outputFile, csvOutput);
            updated++;

            console.log(
                `Updated ${record.player} (${record.season}): ${iceTime} seconds/game`
            );
        } catch (error) {
            failed++;

            console.log(
                `Failed ${record.player} (${record.season}): ${error.message}`
            );

            // Stop rather than continue if saving or fetching failed.
            throw error;
        }
    }

    console.log(
        `Backfill finished: ${updated} updated; ${failed} failed.`
    );
}

main().catch(console.error);