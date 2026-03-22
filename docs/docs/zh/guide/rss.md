# RSS 配置

Rin 支持 RSS、Atom、Json 三种订阅格式

## 环境变量

RSS 本身不需要太多的配置，默认是开箱即用的。但是你可以通过以下环境变量修改其默认配置：

```ini
RSS_TITLE=<RSS 标题，默认为你的用户名>
RSS_DESCRIPTION=<RSS 描述，默认为 Feed from Rin>
```

以上环境变量通过在 Github 的 `Settings` > `Secrets and Variables` > `Actions` > `Variables` > `New repository variable` 中添加即可。

## 使用

RSS 现在不需要额外配置 Workers 路由，部署完成后即可直接访问订阅地址。

:::note
注意：RSS 订阅地址已经从 `/sub/` 路径迁移到根路径，旧的 `/sub/` 路径仍然可用以保持向后兼容。
:::

RSS 的订阅地址为：

```
<前端域名>/rss.xml
```

Atom 的订阅地址为：

```
<前端域名>/atom.xml
```

Json 的订阅地址为：

```
<前端域名>/rss.json
```
