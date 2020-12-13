/* @flow */

import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'

const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

const buildRegex = cached(delimiters => {
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

type TextParseResult = {
  expression: string,
  tokens: Array<string | { '@binding': string }>
}

// 处理文本内容， 例如输入'aaa{{bb}}cc'输出 {expression:`"aaa"+_s({{bb}})+"cc"`, tokens: ['aaa', { '@binding': '{{bb}}'}, 'cc']}
export function parseText (
  text: string,
  delimiters?: [string, string]
): TextParseResult | void {
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  // TODO 这里没有看懂为什么没匹配到类似 {{name}}这种文本时直接返回
  if (!tagRE.test(text)) {
    return
  }
  const tokens = []
  const rawTokens = []
  let lastIndex = tagRE.lastIndex = 0
  let match, index, tokenValue
  while ((match = tagRE.exec(text))) {
    index = match.index
    // push text token
    if (index > lastIndex) {
      // 将非{{sss}}这种格式的文本直接存入rawTokens数组中，例如 'aaa{{b}}', rawTokens会存入'aaa'
      rawTokens.push(tokenValue = text.slice(lastIndex, index))
      // tokens中存的比rawTokens的多两个引号如 '"aaa"'
      tokens.push(JSON.stringify(tokenValue))
    }
    // tag token
    // 将{{aaa}}这种类型的转化为表达式形式
    const exp = parseFilters(match[1].trim())
    tokens.push(`_s(${exp})`)
    rawTokens.push({ '@binding': exp })
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) {
    rawTokens.push(tokenValue = text.slice(lastIndex))
    tokens.push(JSON.stringify(tokenValue))
  }
  return {
    expression: tokens.join('+'),
    tokens: rawTokens
  }
}
