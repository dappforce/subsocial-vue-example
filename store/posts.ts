import { Commit, Dispatch } from 'vuex/types/index'
import { PostContent, ProfileContent, SpaceContent, PostStruct, SharedPostStruct, SpaceStruct } from '@subsocial/types/dto'
import { environment } from '~/environments/environment'
import { PostListItemData } from '~/models/post/post-list-item.model'
import PostService from '~/services/post.service'
import SubsocialApiService from '~/services/subsocial-api.service'
import { KeyValuePair } from '~/models/key-value-pair.model'
import { Content } from '~/types/content'
import { getPostLink, selectPostStructByIds } from '~/utils/utils'
import { config } from '~/config/config'

const UPDATE_POSTS = 'UPDATE_POSTS'
const SET_LOADING_POSTS = 'SET_LOADING_POSTS'
const SET_SUGGESTED_POST_IDS = 'SET_SUGGESTED_POST_IDS'
const SET_LOADING_POST_IDS = 'SET_LOADING_POST_IDS'
const SET_SELECTED_POSTS = 'SET_SELECTED_POSTS'
const CLEAR_SELECTED_POSTS = 'CLEAR_SELECTED_POSTS'
const SET_SELECTED_SPACE_POSTS = 'SET_SELECTED_SPACE_POSTS'
const SET_LOADING_POST_ID = 'SET_LOADING_POST_ID'
const SET_ACCOUNT_POSTS_IDS = 'SET_ACCOUNT_POSTS_IDS'
const SET_POSTS_COMMENT = 'SET_POSTS_COMMENT'
const NEW_POSTS_ABSENT = 'NEW_POSTS_ABSENT'
const UPDATE_POST_REACTION_COUNT = 'UPDATE_POST_REACTION_COUNT'
const UPDATE_POST_HIDDEN_STATE = 'UPDATE_POST_HIDDEN_STATE'

const postService = new PostService()
const subsocialApiService = new SubsocialApiService()
const stepNumber = config.infinityScrollOffset

export interface UpdateReactionModel {
  type: string,
  isActive: boolean,
  postId: string,
  isNew: boolean
}

export interface PostModel {
  list: SharedPostStruct[],
  postsIds: string[],
  isLoadingPosts: boolean,
  loadingPostId: string,
  isLoadingPostsIds: boolean,
  selectedPost: [],
  spacePostsIds: string[],
  postComments: [],
  accountPostsIds: string[],
  newPostsAbsent: boolean
}

export const state = (): PostModel => ({
  list: [],
  isLoadingPosts: false,
  isLoadingPostsIds: false,
  loadingPostId: '',
  postsIds: [],
  selectedPost: [],
  spacePostsIds: [],
  postComments: [],
  accountPostsIds: [],
  newPostsAbsent: false
})

export const mutations = {
  [UPDATE_POSTS] (state: PostModel, posts: []) {
    state.list = [...new Map(state.list.concat(posts).map((item: SharedPostStruct) =>
      [item.id, item])).values()]
  },
  [UPDATE_POST_HIDDEN_STATE] (state: PostModel, payload: {id: string, state: boolean}) {
    state.list.find(i => i.id === payload.id)!.hidden = !payload.state
  },
  [SET_LOADING_POST_IDS] (state: PostModel, loading: boolean) {
    state.isLoadingPostsIds = loading
  },
  [SET_LOADING_POSTS] (state: PostModel, loading: boolean) {
    state.isLoadingPosts = loading
  },
  [SET_LOADING_POST_ID] (state: PostModel, loading: string) {
    state.loadingPostId = loading
  },
  [SET_SUGGESTED_POST_IDS] (state: PostModel, ids: string[]) {
    state.postsIds = ids
  },
  [SET_SELECTED_SPACE_POSTS] (state: PostModel, ids: string[]) {
    state.spacePostsIds = ids
  },
  [SET_SELECTED_POSTS] (state: PostModel, posts: {}) {
    state.selectedPost = { ...state.selectedPost, ...posts }
  },
  [SET_POSTS_COMMENT] (state: PostModel, posts: []) {
    state.postComments = { ...state.postComments, ...posts }
  },
  [CLEAR_SELECTED_POSTS] (state: PostModel) {
    state.selectedPost = []
  },
  [SET_ACCOUNT_POSTS_IDS] (state: PostModel, ids: string[]) {
    state.accountPostsIds = ids
  },
  [NEW_POSTS_ABSENT] (state: PostModel, payload: boolean) {
    state.newPostsAbsent = payload
  },
  [UPDATE_POST_REACTION_COUNT] (state: PostModel, payload: UpdateReactionModel) {
    state.list.map((i) => {
      if (i.id === payload.postId) {
        i.downvotesCount = payload.type === 'downvote' && payload.isActive
          ? ++i.downvotesCount
          : payload.type === 'downvote' && !payload.isActive ? --i.downvotesCount : i.downvotesCount
        i.upvotesCount = payload.type === 'upvote' && payload.isActive
          ? ++i.upvotesCount
          : payload.type === 'upvote' && !payload.isActive ? --i.upvotesCount : i.upvotesCount
        return i
      }
    })
  }
}

export const actions = {
  async getSuggestedPostIds ({ dispatch, commit }: {dispatch: Dispatch, commit: Commit}) {
    commit(SET_LOADING_POST_IDS, true)
    await subsocialApiService.initSubsocialApi().then(() => {
      postService.getSuggestedPostsIds().then((ids: string[]) => {
        commit(SET_SUGGESTED_POST_IDS, ids)
        commit(SET_LOADING_POST_IDS, false)
      })
    })
  },

  async getPostsByIds ({ commit }: {commit: Commit}, payload: { ids: string[], type: string }) {
    await new Promise((resolve) => {
      if (payload.type === 'public') {
        resolve(postService.getPosts(payload.ids))
      } else {
        resolve(postService.findPostsWithAllDetails(payload.ids))
      }
    }).then((postsData: any) => {
      if (!postsData.posts.length) {
        commit(NEW_POSTS_ABSENT, true)
      }
      commit(SET_LOADING_POSTS, true)
      commit(UPDATE_POSTS, postsData.posts)
      commit('content/SET_CONTENT', postsData.contents, { root: true })
      commit('profiles/UPDATE_PROFILES', postsData.profiles, { root: true })
      commit('space/UPDATE_SPACE', postsData.spaces, { root: true })
      commit(SET_LOADING_POSTS, false)
    })
  },

  async getPostById ({ commit }: {commit: Commit}, payload: string) {
    await postService.getPost(payload).then((postData: any) => {
      commit(SET_LOADING_POSTS, true)
      commit(UPDATE_POSTS, postData.posts)
      commit('content/SET_CONTENT', postData.contents, { root: true })
      commit('profiles/UPDATE_PROFILES', postData.profiles, { root: true })
      commit('space/UPDATE_SPACE', postData.spaces, { root: true })
      commit(SET_LOADING_POSTS, false)
      commit(SET_LOADING_POST_ID, postData?.posts.length ? postData.posts[0].id : null)
    })
  },

  async getPostsWithData ({ commit, getters }: {commit: Commit, getters: any}, payload: { ids: string[], commitName: string, isComment?: boolean }) {
    await new Promise((resolve, reject) => {
      payload.isComment
        ? resolve(getters.selectComments(payload.ids, payload.isComment))
        : resolve(getters.selectPostsWithAllDetailsByIds(payload.ids))
    }).then((data) => {
      commit(payload.commitName, data)
      return data
    })
  },

  async getPostsBySpace ({ dispatch, commit }: {dispatch: Dispatch, commit: Commit}, payload: string[]) {
    await postService.getSuggestedPostsIds(payload, true).then((ids: string[]) => {
      commit(SET_SELECTED_SPACE_POSTS, ids)
      commit(SET_LOADING_POST_IDS, false)
      dispatch('getPostsByIds', { ids: ids.slice(0, stepNumber), type: 'public' })
    })
  },

  async getAccountPosts ({ dispatch, commit }: {dispatch: Dispatch, commit: Commit}, payload: string[]) {
    commit(SET_LOADING_POST_IDS, true)
    await postService.getSuggestedPostsIds(payload, true).then((ids: string[]) => {
      commit(SET_ACCOUNT_POSTS_IDS, ids)
      dispatch('getPostsByIds', { ids: ids.slice(0, stepNumber), type: 'public' })
      commit(SET_LOADING_POST_IDS, false)
    })
  },

  updatePostReaction ({ commit }: {commit: Commit}, payload: {type: string, isActive: boolean, postId: string, isNew: boolean}) {
    commit(UPDATE_POST_REACTION_COUNT, payload)
  },

  updateHiddenState ({ commit } : {commit: Commit}, payload : {id: string, state: boolean}) {
    commit(UPDATE_POST_HIDDEN_STATE, payload)
  }
}

export const getters = {
  selectPostsWithAllDetailsByIds: (state: PostModel, getters: any, rootState: any) => (ids: string[]) => {
    const postArray = selectPostStructByIds(ids, state.list)
    const contentEntities = rootState.content.contents
    const profileEntity = rootState.profiles.list
    const spaceEntity = [...rootState.space.spaces, rootState.space.currentSpace]
    const postListItemDataArray: KeyValuePair<PostListItemData> = {}
    postArray.map((postStruct: any) => {
      const profile = profileEntity.find((i: PostStruct) => i?.id === postStruct.ownerId)
     
      if (postStruct.contentId) {
        const spaceStruct = spaceEntity.find((i: SpaceStruct) => i?.id === postStruct.spaceId)
        const postContent = contentEntities.find((i: Content) => i?.id === postStruct.contentId) as PostContent
        const profileContent = contentEntities.find((i: Content) => i?.id === profile.contentId) as ProfileContent
        const spaceContent = contentEntities.find((i: Content) => i?.id === spaceStruct?.contentId) as SpaceContent
     
        if (postContent && spaceStruct) {
          const postListItemData: PostListItemData = {
            id: postStruct.id,
            ownerId: postStruct.ownerId,
            ownerImageUrl: profileContent?.avatar || '',
            spaceName: spaceContent.name!,
            title: postContent.title,
            summary: postContent.summary,
            imageUrl: postContent.image || '',
            createdAtTime: postStruct.createdAtTime,
            repliesCount: postStruct.repliesCount,
            hiddenRepliesCount: postStruct.hiddenRepliesCount,
            visibleRepliesCount: postStruct.visibleRepliesCount,
            sharesCount: postStruct.sharesCount,
            upvotesCount: postStruct.upvotesCount,
            downvotesCount: postStruct.downvotesCount,
            isSharedPost: postStruct.isSharedPost,
            isComment: postStruct.isComment,
            isShowMore: postContent.isShowMore,
            ownerName: profileContent?.name || '',
            postLink: getPostLink(
                spaceStruct?.handle! || spaceStruct.id,
                postContent.title || postContent.summary.slice(0, 50) || spaceContent.name,
                postStruct.id,
                !!spaceStruct.handle
            ),
            body: postContent.body,
            tags: postContent.tags,
            spaceId: spaceStruct.id,
            handle: spaceStruct.handle,
            link: postContent.link,
            sharedPostId: postStruct.sharedPostId,
            hidden: postStruct.hidden,
            hiddenSpace: spaceStruct.hidden,
            contentId: postStruct.contentId,
            rootPostId: postStruct.rootPostId
          }
          postListItemDataArray[postStruct.id] = postListItemData
        }
      }
    })
    return postListItemDataArray
  },

  getPostInfo: (state: PostModel, getters: any) => (id: string) => {
    const postData = getters.selectPostsWithAllDetailsByIds([id])
    return postData[id]
  },

  selectComments: (state: PostModel, getters: any, rootState: any) => (ids: string[], isComment: boolean = false) => {
    const postArray = selectPostStructByIds(ids.flat(1), state.list)
    const contentEntities = rootState.content.contents
    const profileEntity = rootState.profiles.list
    const spaceEntity = [...rootState.space.spaces, rootState.space.currentSpace]
    const postListItemDataArray: KeyValuePair<PostListItemData> = {}
    postArray.map((postStruct: any) => {
      const profile = profileEntity.find((i: PostStruct) => i?.id === postStruct.ownerId)
      if (postStruct.contentId && profile.contentId) {
        const spaceStruct = spaceEntity.find((i: SpaceStruct) => i?.id === postStruct.spaceId)
        const postContent = contentEntities.find((i: Content) => i?.id === postStruct.contentId) as PostContent
        const profileContent = contentEntities.find((i: Content) => i?.id === profile.contentId) as ProfileContent

        if (postContent && profileContent) {
          const postListItemData: PostListItemData = {
            id: postStruct.id,
            ownerId: postStruct.ownerId,
            ownerImageUrl: profileContent.avatar || '',
            title: postContent.title,
            summary: postContent.summary,
            imageUrl: postContent.image
              ? environment.ipfsUrl + postContent.image
              : '',
            createdAtTime: postStruct.createdAtTime,
            repliesCount: postStruct.repliesCount,
            hiddenRepliesCount: postStruct.hiddenRepliesCount,
            visibleRepliesCount: postStruct.visibleRepliesCount,
            sharesCount: postStruct.sharesCount,
            upvotesCount: postStruct.upvotesCount,
            downvotesCount: postStruct.downvotesCount,
            isSharedPost: postStruct.isSharedPost,
            isComment: postStruct.isComment,
            isShowMore: postContent.isShowMore,
            ownerName: profileContent?.name || '',
            body: postContent.body,
            tags: postContent.tags,
            link: postContent.link,
            rootPostId: postStruct.rootPostId,
            hidden: postStruct.hidden,
            contentId: postStruct.contentId,
            postLink: getPostLink(
              spaceStruct.handle! || spaceStruct.id,
              postContent.title || postContent.summary.slice(0, 50),
              postStruct.id,
              !!spaceStruct.handle
            )
          }
          postListItemDataArray[postStruct.id] = postListItemData
        }
      }
    })

    return postListItemDataArray
  },

  getCommentInfo: (state: PostModel, getters: any) => (id: string) => {
    const postData = getters.selectComments([id])
    return postData[id]
  }
}
