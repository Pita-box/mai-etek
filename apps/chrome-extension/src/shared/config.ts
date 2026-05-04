declare const __API_BASE_URL__: string
declare const __EXTENSION_VERSION__: string

export const API_BASE_URL = __API_BASE_URL__.replace(/\/+$/, "")
export const EXTENSION_VERSION = __EXTENSION_VERSION__
export const HEARTBEAT_ALARM_NAME = "mmm-heartbeat"
