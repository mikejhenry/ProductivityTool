import { TimeBlock } from '../types'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useNotifications(_blocks: TimeBlock[]) {
  return {
    requestPermission: async () => {},
    supported: false,
  }
}
