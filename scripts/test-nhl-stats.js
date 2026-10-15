async function main() {
    const url =
        "https://api.nhle.com/stats/rest/en/skater/summaryshooting" +
        "?isAggregate=false" +
        "&isGame=false" +
        "&cayenneExp=playerId=8475745 and seasonId=20242025 and gameTypeId=2" +
        "&limit=20";

    const response = await fetch(encodeURI(url));

    if (!response.ok) {
        throw new Error(`NHL API request failed: ${response.status}`);
    }

    const data = await response.json();

    console.log("\nNHL Statistics API Response:");
    console.dir(data.data, { depth: null });
}

main().catch(console.error);