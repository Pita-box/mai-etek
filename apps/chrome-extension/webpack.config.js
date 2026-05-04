const fs = require("node:fs")
const path = require("node:path")
const webpack = require("webpack")
const CopyWebpackPlugin = require("copy-webpack-plugin")

function parseEnvValue(value) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).replace(/\\n/g, "\n")
  }
  return trimmed
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const values = {}
  const content = fs.readFileSync(filePath, "utf8")

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const separatorIndex = line.indexOf("=")
    if (separatorIndex === -1) continue
    const key = line.slice(0, separatorIndex).trim()
    if (!/^[A-Z0-9_]+$/.test(key)) continue
    values[key] = parseEnvValue(line.slice(separatorIndex + 1))
  }

  return values
}

function getEnv() {
  const root = path.resolve(__dirname, "../..")
  const web = path.join(root, "apps/web")
  return {
    ...readEnvFile(path.join(root, ".env")),
    ...readEnvFile(path.join(root, ".env.local")),
    ...readEnvFile(path.join(web, ".env")),
    ...readEnvFile(path.join(web, ".env.local")),
    ...readEnvFile(path.join(__dirname, ".env")),
    ...readEnvFile(path.join(__dirname, ".env.local")),
    ...process.env,
  }
}

function addApiPath(value) {
  const normalized = value.trim().replace(/\/+$/, "")
  if (!normalized) return ""
  return normalized.endsWith("/api") ? normalized : `${normalized}/api`
}

function getApiConfig() {
  const env = getEnv()
  const apiBaseUrl = env.EXTENSION_API_BASE_URL
    ? env.EXTENSION_API_BASE_URL.trim().replace(/\/+$/, "")
    : addApiPath(
        env.NEXT_PUBLIC_APP_URL ||
          env.NEXT_PUBLIC_SITE_URL ||
          env.SITE_URL ||
          env.WEB_URL ||
          "",
      )

  if (!apiBaseUrl) {
    throw new Error(
      "EXTENSION_API_BASE_URL nebo SITE_URL/NEXT_PUBLIC_APP_URL chybí.",
    )
  }

  const url = new URL(apiBaseUrl)
  return {
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ""),
    apiOrigin: url.origin,
  }
}

const apiConfig = getApiConfig()
const packageJson = require("./package.json")

module.exports = {
  entry: {
    background: "./src/background/service-worker.ts",
    popup: "./src/popup/popup.ts",
    content: "./src/content/index.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        type: "asset/source",
      },
    ],
  },
  optimization: {
    minimize: false,
  },
  devtool: false,
  mode: process.env.NODE_ENV === "production" ? "production" : "development",
  experiments: {
    topLevelAwait: true,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "public/manifest.json",
          to: "manifest.json",
          transform(content) {
            return content
              .toString()
              .replaceAll("__VERSION__", packageJson.version)
              .replaceAll("__API_ORIGIN__", apiConfig.apiOrigin)
          },
        },
        {
          from: "src/popup/popup.html",
          to: "popup.html",
        },
        {
          from: "src/popup/popup.css",
          to: "popup.css",
        },
      ],
    }),
    new webpack.DefinePlugin({
      __API_BASE_URL__: JSON.stringify(apiConfig.apiBaseUrl),
      __EXTENSION_VERSION__: JSON.stringify(packageJson.version),
    }),
  ],
}
