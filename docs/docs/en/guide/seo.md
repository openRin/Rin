# SEO Optimization
:::tip
Some search engines support dynamic rendering (e.g., Google), so SEO optimization is less critical for them. However, for search engines that do not support dynamic rendering, SEO optimization is still essential.
:::

## Introduction
Due to the adoption of a front-end and back-end separation technology, search engines cannot directly retrieve page content. Therefore, SEO optimization is necessary to improve the search engine indexing effect. This document will introduce the principles and configuration guide for SEO implementation in this project.

## Principles
The SEO optimization solution adopted by this project involves prerendering via GitHub Actions, uploading the prerendered pages to an S3 bucket, and using Cloudflare Workers to proxy requests for SEO optimization.

Prerendering is a simple crawler. Starting from the provided SEO_BASE_URL, it requests a page at a time, uploads the rendered HTML content to the S3 bucket for caching, and extracts all the links on the page. If the link starts with SEO_BASE_URL or contains the SEO_CONTAINS_KEY keyword, the crawler will request and prerender the link until no new links are found.

## Configuration Guide
### Environment Variables
When deploying the backend, you need to configure the following environment variables in GitHub (plain text):
```ini
SEO_BASE_URL=<SEO base URL for SEO indexing, defaults to FRONTEND_URL>
SEO_CONTAINS_KEY=<SEO indexing only includes links starting with SEO_BASE_URL or containing the SEO_CONTAINS_KEY keyword, defaults to empty>
S3_FOLDER=<Folder for storing S3 image resources, defaults to 'images/'>
S3_CACHE_FOLDER=<S3 cache folder (for SEO and high-frequency request caching), defaults to 'cache/'>
S3_BUCKET=<Name of the S3 bucket>
S3_REGION=<Region of the S3 bucket, use 'auto' if using Cloudflare R2>
S3_ENDPOINT=<S3 bucket endpoint address>
S3_ACCESS_HOST=<S3 bucket access address>
```

And the following environment variables (encrypted):
```ini
S3_ACCESS_KEY_ID=<Your S3AccessKeyID>
S3_SECRET_ACCESS_KEY=<Your S3SecretAccessKey>
```

Due to the large number of these environment variables, covering a significant part of the complete environment variable list, it is recommended to add these environment variables directly in GitHub during deployment for `v0.2.0` and later versions, rather than through the Cloudflare panel. This can reduce the time cost of configuration to some extent.

### Deployment
After configuring the environment variables, you can manually trigger a Workflow in GitHub Actions. If everything is correct, the deployment will be completed quickly.

### Configure Workers Routes
In the Cloudflare Workers panel, open the details page of your domain, click `Workers Routes`, and add a new route. The route should be:
```
<frontend domain>/seo/*
```
For example:
```
xeu.life/seo/*
```
![Image](https://github.com/OXeu/Rin/assets/36541432/ed0ecc72-f61f-4460-8ede-4475ca54ffcb)

Select the Worker you deployed, and click save.

Then, click the sidebar menu > `Rules` > `Transform Rules` > `URL Rewrite` > `Create Rule`. The rule name can be anything, and the custom filter expression is:

:::note
This filter expression is optimized only for Google's indexing. For other search engines, please find their respective crawler UAs and fill them in.
:::

```
(http.host eq "<frontend domain, e.g., xeu.life>" and http.user_agent contains "Googlebot")
```
Set the rewrite path to `Dynamic`, with the value:
```
concat("/seo",http.request.uri.path)
```
Select `Preserve query`.

Reference configuration screenshot:
![Transform Rules](https://github.com/OXeu/Rin/assets/36541432/657e9546-1dc0-4390-9bfc-5d3eb725e792)

Click deploy to complete the SEO configuration.