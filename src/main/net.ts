import { networkInterfaces } from 'node:os'

function isPrivateAddress(address: string): boolean {
  if (address.startsWith('10.')) return true
  if (address.startsWith('192.168.')) return true
  if (address.startsWith('169.254.')) return false
  const match = /^172\.(\d{1,3})\./.exec(address)
  if (match) {
    const second = Number(match[1])
    return second >= 16 && second <= 31
  }
  return false
}

/**
 * Адреса, по которым приложение доступно с телефона или другого компьютера
 * в той же сети. Виртуальные и служебные интерфейсы отбрасываются.
 */
export function lanAddresses(): string[] {
  const out: string[] = []
  for (const [name, infos] of Object.entries(networkInterfaces())) {
    if (!infos) continue
    if (/^(lo|docker|br-|veth|virbr|tun|tap|utun|zt|wg)/.test(name)) continue
    for (const info of infos) {
      if (info.family !== 'IPv4' || info.internal) continue
      if (!isPrivateAddress(info.address)) continue
      if (!out.includes(info.address)) out.push(info.address)
    }
  }
  return out
}

export function lanUrls(port: number): string[] {
  return lanAddresses().map((address) => `http://${address}:${port}`)
}

export function localUrl(port: number): string {
  return `http://127.0.0.1:${port}`
}
