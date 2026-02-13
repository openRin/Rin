# RSS Support and Configuration

Rin supports RSS, Atom, and Json subscription formats

## Configuration

### Environment Variables

RSS itself does not require much configuration and is ready to use by default. However, you can modify its default settings through the following environment variables:

```ini
RSS_TITLE=<RSS title, defaults to your username>
RSS_DESCRIPTION=<RSS description, defaults to Feed from Rin>
```

You can add these environment variables in GitHub under `Settings` > `Secrets and Variables` > `Actions` > `Variables` > `New repository variable`.

### Workers Routes

In the Cloudflare Workers panel, open the details page of your domain, click `Workers Routes`, and add a new route. The route should be:

```
<frontend domain>/*
```

For example:

```
xeu.life/*
```

:::note
Note: RSS subscription paths have been moved from `/sub/` to the root path. The old `/sub/` paths remain available for backward compatibility.
:::

Select the Worker you deployed, and click save.

:::note
If you have also configured domestic CDN acceleration, you will need to set the Workers route for the origin domain in the same way as described above.
:::

## Usage

The subscription address for RSS is:

```
<frontend domain>/rss.xml
```

The subscription address for Atom is:

```
<frontend domain>/atom.xml
```

The subscription address for Json is:

```
<frontend domain>/rss.json
```