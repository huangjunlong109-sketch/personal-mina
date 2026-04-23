/// <reference types="miniprogram-api-typings" />

interface IAppOption {
  globalData: {
    cycleStartDay: number
    categoriesLoaded: boolean
    pendingBillRecordMonth: string
  }
  initUser(): void
}
