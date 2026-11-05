export function getDatabaseConnectionOptions(databaseUrl, useSsl) {
    const url = new URL(databaseUrl);
    const sslMode = url.searchParams.get("sslmode");
    url.searchParams.delete("sslmode");
    return {
        connectionString: url.toString(),
        ssl: useSsl || (sslMode !== null && sslMode !== "disable")
            ? sslMode === "verify-full" || sslMode === "verify-ca"
                ? true
                : { rejectUnauthorized: false }
            : false,
    };
}
