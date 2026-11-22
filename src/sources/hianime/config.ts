export const hianimeConfig = {
  hostPattern: /^(www\.)?hianime\.[a-z]{2,}$/i,
  animePath: /^\/(?:watch\/)?([a-z0-9-]+-\d+)\/?$/i,
  episodeListApi: (siteUrl: string, numericId: string) => `${siteUrl}/api/theme/episode/list/${numericId}`,
  serversApi: (siteUrl: string, episodeId: string) => `${siteUrl}/api/theme/episode/servers?episodeId=${episodeId}`,
};
