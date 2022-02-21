import { asAccountId } from '@subsocial/api'
import { FlatSubsocialApi } from '@subsocial/api/flat-subsocial'
import SubsocialApiService from '~/services/subsocial-api.service'
import { AccountData, AccountRawData, Balance, PolkadotAccountWithMeta } from '~/types/account.types'
import PostService from '~/services/post.service'

const subsocialApiService = new SubsocialApiService()
const postService = new PostService()

export interface Registry {
  token: string,
  decimals: number
}

export default class AccountService {
  async getApi (): Promise<FlatSubsocialApi> {
    return await subsocialApiService.initSubsocialApi()
  }

  async getAccountsData (accounts: PolkadotAccountWithMeta[], registry: Registry): Promise<AccountData[]> {
    const suggestedPostIdsPromises = accounts.map(async (account: PolkadotAccountWithMeta) => {
      return await this.getBalance(account.address)
    })

    const balances = await Promise.all(suggestedPostIdsPromises)
    const profiles = await this.loadProfilesByPolkadotAccount(accounts)
    const accountsData = this.extractAccountData({ accounts, balances, profiles }, registry)
    return accountsData
  }

  extractAccountData (accountRawData: AccountRawData, registry: Registry) {
    return accountRawData.accounts.map((account) => {
      const id = asAccountId(account.address)!.toString()
      const profile = accountRawData.profiles.find(
        profile => profile.id === id
      )

      const balance = accountRawData.balances.find(
        balance => balance.accountId.toString() === id
      )!

      return {
        id,
        name: profile?.content?.name || account.meta.name,
        balance: this.getFormattedBalance(balance, { token: registry.token, decimals: registry.decimals }),
        avatar: profile?.content?.avatar
      } as unknown as AccountData
    })
  }

  async loadProfilesByPolkadotAccount (polkadotAccounts: PolkadotAccountWithMeta[]) {
    const ids = polkadotAccounts.map(account => account.address)
    return await (await this.getApi()).findProfiles(ids)
  }

  async getBalance (address: string) {
    const api = await (await this.getApi()).subsocial.substrate.api
    return await api.derive.balances.all(address)
  }

  async transferMoney (fromAcc: string, toAcc: string, amount: number, signer: any) {
    const api = await (await this.getApi()).subsocial.substrate.api
    const result = await api.tx.balances
      .transfer(toAcc, amount)
      .signAndSend(fromAcc, { signer }, (status) => {
        console.log(status)
      })
    return result
  }

  async setBalance (address: string, registry: Registry) {
    const balance = await this.getBalance(address)
    return this.getFormattedBalance(balance, registry)
  }

  async getFormattedBalance (balance: Balance | undefined, registry: Registry) {
    const { formatBalance } = await import('@polkadot/util')
    const { decimals, token: unit } = registry
    formatBalance.setDefaults({ decimals, unit })
    const [prefix, postfix] = balance
      ? formatBalance(balance.freeBalance, {
        forceUnit: '-',
        withSi: false
      }).split('.')
      : ['0', undefined]

    return prefix + '.' + (postfix || '0000')
  }

  async getAccountFeedIds (id: string) {
    const spaceIds = await (await this.getApi()).subsocial.substrate.spaceIdsFollowedByAccount(id)
    const postIds = await postService.getSuggestedPostsIds(spaceIds.map(id => id.toString()), true)
    return postIds
  }
}
