# RSS 支持与配置

支持 RSS、Atom、Json 三种订阅格式

## 配置

## 环境变量

RSS 本身不需要太多的配置，默认是开箱即用的。但是你可以通过以下环境变量修改其默认配置：

```ini
RSS_TITLE=<RSS 标题，默认为你的用户名>
RSS_DESCRIPTION=<RSS 描述，默认为 Feed from Rin>
```

以上环境变量通过在 Github 的 `Settings` > `Secrets and Variables` > `Actions` > `Variables` > `New repository variable` 中添加即可。

## Workers 路由

在 Cloudflare Workers 面板中打开自己的域名详情页，点击 `Workers 路由`，添加一个新路由，路由填写为：

```
<前端域名>/sub/*
```

如：

```
xeu.life/sub/*
```

Worker 选择为部署的 Worker，点击保存。

> [!NOTE]
> 如果你还配置了国内 CDN 加速，还需要将回源域名按上述同样的方式设置 Workers 路由。


## 使用

RSS 的订阅地址为：

```
<前端域名>/sub/rss.xml
```

Atom 的订阅地址为：

```
<前端域名>/sub/atom.xml
```

Json 的订阅地址为：

```
<前端域名>/sub/rss.json
```
