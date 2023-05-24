import { Hono } from 'hono'
import { html } from 'hono/html'
import { serveStatic } from 'hono/cloudflare-workers'
import puppeteer, { BrowserWorker } from '@cloudflare/puppeteer'

type Bindings = {
  MY_BROWSER: BrowserWorker
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/static/*', serveStatic({ root: './' }))

app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const end = Date.now()
  c.res.headers.set('X-Response-Time', `${end - start}`)
})

app.get('/evaluate', async (c) => {
  const url = new URL('/static/page.html', c.req.url).toString()

  console.log(url)

  const browser = await puppeteer.launch(c.env.MY_BROWSER)
  const page = await browser.newPage()

  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 0
  })

  // Remove the head tag
  await page.evaluate(() => {
    document.querySelector('head')?.remove()
  })

  const result = (await page.content()) as string

  await browser.close()

  return c.json({
    content: result
  })
})

app.get('/', (c) => {
  return c.html(html`<html>
    <body>
      <ul>
      <li><a href="/evaluate">/evaluate (HTMLから<code>head</code>タグを除去します)</li>
      <li><a href="/static/page.html">/static/page.html (対象のHTMLです)</li>
      </ul>
    </body>
  </html>`)
})

app.onError((e, c) => {
  return c.text(e.message)
})

export default app
