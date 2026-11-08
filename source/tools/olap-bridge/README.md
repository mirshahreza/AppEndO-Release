# OLAP Bridge (reference)

Optional ASP.NET Core (.NET 8) service that wraps AMO/ADOMD.NET for on-prem or Azure Analysis Services.

AppEndO CI and install **never** build this project. Operators who need SSAS compile and host it themselves on Windows.

## Endpoints

| Method | Path |
|---|---|
| GET | `/health` |
| GET | `/catalogs` |
| GET | `/catalogs/:catalog/cubes` |
| GET | `/catalogs/:catalog/cubes/:cube/metadata` |
| POST | `/catalogs/:catalog/query` |

All calls require `X-Bridge-Api-Key`. Store that key in the AppEndO Data Source password/secret field.

## Configure

```
Bridge:ApiKey
Bridge:XmlaConnectionString
```

or environment `OLAP_BRIDGE_API_KEY` / `OLAP_XMLA_CONNECTION`.

License: MIT.
