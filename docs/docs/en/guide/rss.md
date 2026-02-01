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
<frontend domain>/sub/*
```

For example:

```
xeu.life/sub/*
```

Select the Worker you deployed, and click save.

:::note
If you have also configured domestic CDN acceleration, you will need to set the Workers route for the origin domain in the same way as described above.
:::

## Usage

The subscription address for RSS is:

```
<frontend domain>/sub/rss.xml
```

The subscription address for Atom is:

```
<frontend domain>/sub/atom.xml
```

The subscription address for Json is:

```
<frontend domain>/sub/rss.json
```