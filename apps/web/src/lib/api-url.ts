const missingApiUrlMessage = "Chybí NEXT_PUBLIC_API_URL."

export function getApiBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim()

  if (!apiUrl) {
    throw new Error(missingApiUrlMessage)
  }

  const normalizedUrl = apiUrl.replace(/\/+$/, "")
  return normalizedUrl.endsWith("/api") ? normalizedUrl : `${normalizedUrl}/api`
}

export function getSocketBaseUrl() {
  return getApiBaseUrl().replace(/\/api$/, "")
}
