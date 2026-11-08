using Microsoft.AnalysisServices.AdomdClient;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
var app = builder.Build();

var apiKey = builder.Configuration["Bridge:ApiKey"] ?? Environment.GetEnvironmentVariable("OLAP_BRIDGE_API_KEY") ?? "";
var connectionString = builder.Configuration["Bridge:XmlaConnectionString"] ?? Environment.GetEnvironmentVariable("OLAP_XMLA_CONNECTION") ?? "";

app.Use(async (context, next) =>
{
    var presented = context.Request.Headers["X-Bridge-Api-Key"].ToString();
    if (string.IsNullOrWhiteSpace(apiKey) || presented != apiKey)
    {
        context.Response.StatusCode = 401;
        await context.Response.WriteAsJsonAsync(new { error = "Invalid bridge API key." });
        return;
    }
    await next();
});

app.MapGet("/health", () => Results.Json(new
{
    status = "ok",
    version = "1.0.0",
    supportedLanguages = new[] { "MDX", "DAX" }
}));

app.MapGet("/catalogs", () =>
{
    using var connection = Open();
    return Results.Json(Discover(connection, "DBSCHEMA_CATALOGS"));
});

app.MapGet("/catalogs/{catalog}/cubes", (string catalog) =>
{
    using var connection = Open(catalog);
    return Results.Json(Discover(connection, "MDSCHEMA_CUBES"));
});

app.MapGet("/catalogs/{catalog}/cubes/{cube}/metadata", (string catalog, string cube) =>
{
    using var connection = Open(catalog);
    return Results.Json(new
    {
        catalog,
        cube,
        language = "MDX",
        dimensions = Discover(connection, "MDSCHEMA_DIMENSIONS"),
        hierarchies = Discover(connection, "MDSCHEMA_HIERARCHIES"),
        levels = Discover(connection, "MDSCHEMA_LEVELS"),
        measures = Discover(connection, "MDSCHEMA_MEASURES")
    });
});

app.MapPost("/catalogs/{catalog}/query", async (string catalog, HttpRequest request) =>
{
    using var document = await JsonDocument.ParseAsync(request.Body);
    var language = document.RootElement.TryGetProperty("language", out var langEl) ? langEl.GetString() ?? "MDX" : "MDX";
    var statement = document.RootElement.TryGetProperty("statement", out var stmtEl) ? stmtEl.GetString() ?? "" : "";
    if (string.IsNullOrWhiteSpace(statement))
    {
        return Results.BadRequest(new { error = "statement is required." });
    }

    using var connection = Open(catalog);
    using var command = new AdomdCommand(statement, connection);
    command.CommandTimeout = 30;
    using var reader = command.ExecuteReader();
    var columns = new List<object>();
    for (var i = 0; i < reader.FieldCount; i++)
    {
        columns.Add(new { name = reader.GetName(i), type = reader.GetFieldType(i).Name });
    }
    var rows = new List<object[]>();
    while (reader.Read())
    {
        var row = new object[reader.FieldCount];
        for (var i = 0; i < reader.FieldCount; i++)
        {
            row[i] = reader.IsDBNull(i) ? null! : reader.GetValue(i);
        }
        rows.Add(row);
        if (rows.Count > 10000)
        {
            return Results.Json(new { error = "Result exceeded the cell cap of 10000." }, statusCode: 413);
        }
    }
    return Results.Json(new { language, columns, rows });
});

app.Run();

AdomdConnection Open(string? catalog = null)
{
    var connection = new AdomdConnection(connectionString);
    connection.Open();
    if (!string.IsNullOrWhiteSpace(catalog))
    {
        connection.ChangeDatabase(catalog);
    }
    return connection;
}

List<Dictionary<string, object?>> Discover(AdomdConnection connection, string schema)
{
    using var restriction = new AdomdRestrictionCollection();
    using var reader = connection.GetSchemaDataSet(schema, restriction).Tables[0].CreateDataReader();
    var rows = new List<Dictionary<string, object?>>();
    while (reader.Read())
    {
        var row = new Dictionary<string, object?>();
        for (var i = 0; i < reader.FieldCount; i++)
        {
            row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
        }
        rows.Add(row);
    }
    return rows;
}
