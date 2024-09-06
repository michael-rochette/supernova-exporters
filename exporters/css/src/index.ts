import { Supernova, PulsarContext, RemoteVersionIdentifier, AnyOutputFile, TokenType, Token, Brand, TokenGroup } from "@supernovaio/sdk-exporters"
import { ExporterConfiguration } from "../config"
import { indexOutputFile } from "./files/index-file"
import { styleOutputFile } from "./files/style-file"
import { FileHelper } from "@supernovaio/export-helpers"

/** Exporter configuration. Adheres to the `ExporterConfiguration` interface and its content comes from the resolved default configuration + user overrides of various configuration keys */
export const exportConfiguration = Pulsar.exportConfig<ExporterConfiguration>()


type StructuredTokens = Record<string, {
  name: {
    brand: string,
    brandMode: string,
    category: string,
    rawName: string,
    type: string
  },
  values: Record<string, string>,
  usage: string
}>

/**
 * Export entrypoint.
 * When running `export` through extensions or pipelines, this function will be called.
 * Context contains information about the design system and version that is currently being exported.
 */
Pulsar.export(async (sdk: Supernova, context: PulsarContext): Promise<Array<AnyOutputFile>> => {
  // Fetch data from design system that is currently being exported (context)
  const remoteVersionIdentifier: RemoteVersionIdentifier = {
    designSystemId: context.dsId,
    versionId: context.versionId,
  }

  // Fetch the necessary data
  let tokens = (await sdk.tokens.getTokens(remoteVersionIdentifier)).sort((a,b) => a.parentGroupId < b.parentGroupId ? -1 : 1)
  let tokenGroups = await sdk.tokens.getTokenGroups(remoteVersionIdentifier)
  const brands:Brand[] = await sdk.brands.getBrands(remoteVersionIdentifier)

  const structuredTokens: StructuredTokens = getStructuredTokens(tokenGroups, tokens, brands)

  const content = formatForContent(structuredTokens)


  

  return [FileHelper.createTextFile({
    relativePath: './',
    fileName: 'test.md',
    content
  })
  ]
})


function getStructuredTokens (tokenGroups: TokenGroup[], tokens: Token[], brands: Brand[]) {
  const result = {}

  tokens.forEach(token => {
    const group = getGroupById(tokenGroups, token.parentGroupId)
    if (!group) {
      return
    }

    const {tokenGroup, name} = getRootGroupAndName(tokenGroups, group, token.name)

    const rootGroupName = tokenGroup.name

    if (!result[rootGroupName]) {
      result[rootGroupName] = []
    }

    const [category,] = name.split("__")

    result[rootGroupName].push({
      name: {
        brand: getBrandNameById(brands, token.brandId),
        brandMode: "default",
        category,
        platform: token.propertyValues.platform || '',
        rawName: token.propertyValues.variable,
        type: rootGroupName
      },
      values: token.propertyValues,
      usage: token.description
    })
  })

  return result
  
}

function getRootGroupAndName(tokenGroups: TokenGroup[], tokenGroup: TokenGroup, name: string) {
  const parentGroup = tokenGroup?.parentGroupId && getGroupById(tokenGroups, tokenGroup.parentGroupId)

  if (parentGroup && parentGroup.id !== tokenGroup.id) {
    name = `${parentGroup.name}__${name}`

    const result = getRootGroupAndName(tokenGroups, parentGroup, name)

    tokenGroup = result.tokenGroup
  }

  return {
    tokenGroup,
    name
  }
}

function getGroupById (tokenGroups: TokenGroup[], groupId:string) {
  return tokenGroups.find(({id}) => groupId === id)
}

function formatForContent (structuredTokens: StructuredTokens) {
  return JSON.stringify(structuredTokens)
}

function getBrandNameById(brands: Brand[], brandId: string) {
  return brands.find(({id}) => brandId === id)?.name
}