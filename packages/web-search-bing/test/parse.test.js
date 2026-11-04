import test from 'node:test'
import assert from 'node:assert/strict'
import { parseResults } from '../index.js'

const wrapped = (url) => `https://cn.bing.com/ck/a?!&&p=abc&u=a1${Buffer.from(url).toString('base64url')}&ntb=1`

const HTML = `
<ol id="b_results">
  <li class="b_algo">
    <h2><a href="https://example.com/one">第一条 &amp; 标题</a></h2>
    <p>第一段的摘要 &lt;不是标签&gt;</p>
  </li>
  <li class="b_algo">
    <h2><a href="${wrapped('https://example.com/two')}">第二条</a></h2>
    <div class="b_caption"><p>第二段摘要</p></div>
  </li>
  <li class="b_algo">
    <h2><a href="https://example.com/one">重复的地址</a></h2>
    <p>应该被去重</p>
  </li>
</ol>`

test('从必应结果页取出标题、真实地址、摘要，并去重', () => {
  const rows = parseResults(HTML)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], { url: 'https://example.com/one', title: '第一条 & 标题', snippet: '第一段的摘要 <不是标签>' })
  assert.equal(rows[1].url, 'https://example.com/two')
  assert.equal(rows[1].snippet, '第二段摘要')
})

test('页面结构变了就返回空，不编造', () => {
  assert.deepEqual(parseResults('<html><body>换了版</body></html>'), [])
})
