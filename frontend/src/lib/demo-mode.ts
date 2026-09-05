// 只有显式启用时才使用预置演示媒体；默认连接真实生成服务。
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
}
