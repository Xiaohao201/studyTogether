// AMap (高德地图) global type declarations

interface AMapSecurityConfig {
  securityJsCode: string
}

declare global {
  interface Window {
    _AMapSecurityConfig?: AMapSecurityConfig
    AMap?: any
  }
}

export {}
