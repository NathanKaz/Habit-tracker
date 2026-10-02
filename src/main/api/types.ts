/** Список адресов, по которым доступен интерфейс из локальной сети. */
export type LanUrlProvider = (port: number) => string[]