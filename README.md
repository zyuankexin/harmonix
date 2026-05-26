# vercel-study
为了学习vercel部署而建的练习项目

## Supabase 集成

本项目使用 Supabase 作为歌曲列表的数据源，凭据通过**环境变量**注入，不硬编码在源码中。

### 环境变量配置

| 变量名 | 说明 |
|--------|------|
| `SUPABASE_URL` | Supabase 项目 URL，如 `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |

**本地开发：**
1. 复制 `.env.example` 为 `.env`，填入真实值
2. 运行 `bash build.sh` 生成 `js/env.js`
3. 打开 `index.html` 即可

**Vercel 部署：**
在 Vercel 项目 Settings → Environment Variables 中添加上述两个变量，构建时会自动执行 `build.sh` 生成 `js/env.js`。

### 数据库表结构

在 Supabase SQL Editor 中执行以下建表语句：

```sql
CREATE TABLE songs (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title      TEXT    NOT NULL DEFAULT '未知曲目',
  artist     TEXT    NOT NULL DEFAULT '未知艺术家',
  duration   TEXT    DEFAULT '--:--',
  color      TEXT    DEFAULT '#1a1a3e',
  cover_url  TEXT,
  src        TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 开启 RLS 并允许匿名读取
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "允许公开读取歌曲"
  ON songs FOR SELECT
  USING (true);
```

### 查询语句

核心查询位于 `js/script.js` 的 `fetchSongs()` 函数：

```js
const { data, error } = await supabaseClient.from('songs').select('*');
```

当 Supabase 未配置或查询失败时，会自动回退到本地备用数据。
