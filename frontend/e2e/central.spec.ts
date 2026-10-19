import { expect, test, type Page } from '@playwright/test'

async function assertLayout(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true)
}
async function createEquipment(page: Page, serial: string) {
  await page.getByRole('button', { name: 'Inventário', exact: true }).click()
  await page.getByRole('button', { name: '+ Novo equipamento', exact: true }).click()
  const dialog = page.getByRole('dialog')
  for (const [label, value] of Object.entries({
    'Número de série': serial,
    Marca: 'Fênix Mobilidade',
    Modelo: 'Sentinela de teste',
    'Órgão responsável': 'Trânsito',
    CEP: '17500000',
    Rua: 'Avenida Integração',
    Referência: 'Praça Central',
    Bairro: 'Centro',
    Região: 'Central',
  }))
    await dialog.getByLabel(label, { exact: true }).fill(value)
  await dialog.getByRole('button', { name: 'Salvar cadastro', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText(serial, { exact: true })).toBeVisible()
}
test('demonstração: navegação, cadastro, persistência e layout', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Uma cidade capaz/ })).toBeVisible()
  await assertLayout(page)
  await page.screenshot({ path: testInfo.outputPath('inicio.png'), fullPage: false, scale: 'css' })
  for (const [tab, title] of [
    ['Inventário', 'Inventário da cidade'],
    ['Operação', 'Central de operações'],
    ['Prevenção', 'Prevenção e atenção'],
  ]) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await assertLayout(page)
    await page.screenshot({
      path: testInfo.outputPath(`${tab}.png`),
      fullPage: false,
      scale: 'css',
    })
    if (tab === 'Operação') {
      await page
        .locator('.map-panel')
        .screenshot({ path: testInfo.outputPath('mapa.png'), scale: 'css' })
      await page
        .getByRole('heading', { name: 'Histórico de eventos', exact: true })
        .scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath('historico.png'), scale: 'css' })
      await page.evaluate(() => window.scrollTo(0, 0))
    }
  }
  const serial = 'CAM-NAVEGADOR-001'
  await createEquipment(page, serial)
  await page.reload()
  await page.getByRole('button', { name: 'Inventário', exact: true }).click()
  await expect(page.getByText(serial, { exact: true })).toBeVisible()
})
test('servidor: sessão, CRUD, evento e CSV via PHP-FPM', async ({ page }, testInfo) => {
  await page.goto('/')
  const token = await (await page.request.get('/api/session/')).json()
  const login = await page.request.post('/api/session/', {
    headers: { 'X-CSRFToken': token.csrf, Origin: new URL(page.url()).origin, Referer: page.url() },
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
  await page.reload()
  await expect(page.getByRole('status')).toHaveText('Servidor conectado')
  const serial = `CAM-E2E-${testInfo.project.name.toUpperCase()}`
  await createEquipment(page, serial)
  const row = page.getByRole('row').filter({ has: page.getByText(serial, { exact: true }) })
  await row.getByRole('button', { name: 'Ver detalhes' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Simular falha', exact: true }).click()
  await expect(row.getByText('Mau funcionamento', { exact: true })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV · PHP', exact: true }).click()
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  expect(Buffer.concat(chunks).toString()).toContain(serial)
  await row.getByRole('button', { name: 'Ver detalhes' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Excluir do inventário', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar exclusão', exact: true })
    .click()
  await expect(page.getByText(serial, { exact: true })).toHaveCount(0)
})
