import { AnyId, PostWithAllDetails, PostStruct, ProfileStruct, SpaceStruct } from '@subsocial/types/dto'
import { FlatSubsocialApi } from '@subsocial/api/flat-subsocial'
import { AnySpaceId } from '@subsocial/types'
import { bnsToIds } from '@subsocial/utils'
import SubsocialApiService from '~/services/subsocial-api.service'
import { TransformPostWithAllDetails } from '~/types/transform-dto'
import { Content } from '~/types/content'
import { config } from '~/config/config'
import { convertToBNArray } from '~/utils/utils'

const subsocialApiService = new SubsocialApiService()
const suggestedSpaceIds = config.recommendedSpaceIds

export default class PostService {
  async getApi (): Promise<FlatSubsocialApi> {
    return await subsocialApiService.initSubsocialApi()
  }

  async getPosts (ids: string[]): Promise<TransformPostWithAllDetails> {
    const postData = await subsocialApiService.api?.findPublicPostsWithAllDetails(ids)
    return this.splitPostWithAllDataByEntity(postData)
  }

  async findPostsWithAllDetails (ids: string[]): Promise<TransformPostWithAllDetails> {
    const postData = await subsocialApiService.api?.findPostsWithAllDetails({
      ids: convertToBNArray(ids)
    })
    return this.splitPostWithAllDataByEntity(postData, true)
  }

  async getPost (id: AnyId): Promise<TransformPostWithAllDetails> {
    const postData: PostWithAllDetails[] = []
    postData.push(await subsocialApiService.api?.findPostWithAllDetails(id) as PostWithAllDetails)
    return this.splitPostWithAllDataByEntity(postData)
  }

  async getSuggestedPostsIds (spaceIds: string[] = [], isAccount: boolean = false) {
    const ids: string[] = isAccount ? spaceIds : suggestedSpaceIds
    const suggestedPostIds: string[] = []

    const suggestedPostIdsPromises = ids.map(async (spaceId) => {
      return (await this.getApi()).subsocial.substrate.postIdsBySpaceId(spaceId as unknown as AnySpaceId)
    })

    const suggestedPostIdsArray = await Promise.all(suggestedPostIdsPromises)

    suggestedPostIds.push(...bnsToIds(suggestedPostIdsArray.flat().sort((a, b) => b.sub(a).toNumber())))

    return suggestedPostIds
  }

  async getPostsIds (spaceId: AnySpaceId) {
    const suggestedPostIds: string[] = []
    const postsIds = await (await this.getApi()).subsocial.substrate.postIdsBySpaceId(spaceId as unknown as AnySpaceId)
    suggestedPostIds.push(...bnsToIds(postsIds.flat().sort((a, b) => b.sub(a).toNumber())))
    return suggestedPostIds
  }

  splitPostWithAllDataByEntity (
    postsAllData: PostWithAllDetails[],
    hidden: boolean = false
  ): TransformPostWithAllDetails {
    const posts: PostStruct[] = []
    const spaces: SpaceStruct[] = []
    const profiles: ProfileStruct[] = []
    const contents: Content[] = []
    postsAllData.forEach((postAllData) => {
      const post: any = postAllData.post
      const { space, owner } = postAllData
      if (post?.content && (space?.content || hidden)) {
        post.struct.isComment ? posts.push({ ...post.struct, ...{ spaceId: space.struct.id }, ...{ rootPostId: post.struct.rootPostId } }) : posts.push(post.struct)
        if (!hidden) {
          spaces.push(space.struct)
        }
        profiles.push(owner ? owner.struct : {
          id: post.struct.ownerId,
          contentId: post.struct.ownerId
        } as ProfileStruct)

        const postContent = post.content as Content
        postContent.id = post.struct.contentId!

        const spaceContent = space?.content as Content || {} as Content
        if (!hidden) {
          spaceContent.id = space.struct.contentId!
        }

        const profileContent = owner && owner.content
          ? owner.content as Content
          : { name: post.struct.ownerId } as Content

        profileContent.id = owner ? owner.struct.contentId! : post.struct.ownerId
        contents.push(postContent, spaceContent, profileContent)
      }
    })

    return { posts, contents, profiles, spaces }
  }
}
