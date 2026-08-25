# Data Sources Configuration

Tradeflow relies on market data to provide analysis and generate option chains. To protect the repository and its users, we do not hardcode links to external scraping sites.

You must configure the data sources in the **Settings page** of the Tradeflow application.

## NSE Base URL

For GIFT Nifty and Option Chain data, Tradeflow currently uses the public NSE India API. 

Copy and paste the following URL into the **NSE Base URL** field in the Settings page:

```text
https://www.nseindia.com
```

### Endpoints Used Internally
Once the base URL is configured, Tradeflow constructs the following endpoints internally:
- **GIFT Nifty:** `/api/marketStatus`
- **Option Chain Contract Info:** `/api/option-chain-contract-info`
- **Option Chain Live Data:** `/api/option-chain-v3`
- **Premium Charts:** `/api/chart-databyindex`
- **Cookie Warmup:** `/option-chain`

## Global Indices Base URL

Global indices (NASDAQ, S&P 500, Nikkei, VIX, DXY, Crude, US 10Y) are fetched via `yfinance` / Yahoo Finance API endpoints. You can configure a custom base endpoint or proxy URL in the **Global Indices Base URL** field on the Settings page:

```text
https://query1.finance.yahoo.com
```

## Future Brokers
Integration with official broker APIs (Upstox, Zerodha Kite) is planned for a future release. Once available, you will be able to input your API keys directly into the Settings page instead of using public endpoints.
