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
export function getDrizzleDatabaseCredentials(databaseUrl, useSsl) {
    const url = new URL(databaseUrl);
    const sslMode = url.searchParams.get("sslmode");
    const ssl = useSsl
        ? "require"
        : sslMode === "disable"
            ? false
            : sslMode === "verify-full"
                ? "verify-full"
                : sslMode !== null
                    ? "require"
                    : false;
    return {
        host: url.hostname,
        port: Number(url.port || 5432),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: decodeURIComponent(url.pathname.slice(1)),
        ssl,
    };
}
