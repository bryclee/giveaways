const puppeteer = require('puppeteer');
const path = require('path');
const {
  GIVEAWAY,
  GIVEAWAY_LINK,
  HIDDEN,
  CLICKED,
  CLICK_GIVEAWAY_TARGET,
  CLICK_GIVEAWAY_RESULT,
} = require('./lib/selectors');
const { delay } = require('./lib/utils');

const getVisibleGiveawayId = async page => {
  return page.evaluate(
    (_GIVEAWAY, _HIDDEN, _CLICKED) => {
      const giveaways = Array.from(document.querySelectorAll(_GIVEAWAY));

      const firstVisible = giveaways.find(
        el => !el.matches(_HIDDEN) && !el.matches(_CLICKED),
      );

      return firstVisible && firstVisible.id;
    },
    GIVEAWAY,
    HIDDEN,
    CLICKED,
  );
};

const giveawaySel = id => `${GIVEAWAY}#${id}`;
const giveawayLinkSel = id => `${giveawaySel(id)} ${GIVEAWAY_LINK}`;

const getGiveawayTitle = async (page, id) => {
  return page.$eval(giveawayLinkSel(id), el => el.text);
};

const clickGiveaway = async (page, id) => {
  // For some reason, using page.click is not very reliable in headful mode
  await page.evaluate(sel => {
    document.querySelector(sel).click();
  }, giveawayLinkSel(id));

  console.log('Clicked on giveaway', giveawayLinkSel(id));
  return;
};

const handleSubmitGiveaway = async page => {};

// Create path to screenshot dir for filename
const screenshotPath = path => `./screenshot/${path}.png`;

const openGiveaway = async ({ browser, page, id }) => {
  const title = await getGiveawayTitle(page, id);

  console.log('TITLE:', title);

  const newPagePromise = Promise.race([
    new Promise(resolve =>
      browser.on('targetcreated', target => resolve(target.page())),
    ),
    page.waitForNavigation(),
  ]);

  await clickGiveaway(page, id);

  const giveawayPage = await newPagePromise;

  if (!giveawayPage) {
    return;
  }

  await giveawayPage.screenshot({ path: screenshotPath(id) });

  return giveawayPage;
};

const handleGiveaway = async ({ browser, page, id }) => {
  const pageClosed = new Promise(resolve =>
    browser.on('targetdestroyed', target => {
      resolve();
    }),
  );

  if (await page.$(CLICK_GIVEAWAY_TARGET)) {
    console.log('Handling "click" giveaway');
    // Wait for box animation? May not be necessary
    await delay(500);
    await page.click(CLICK_GIVEAWAY_TARGET);

    await page.waitFor(CLICK_GIVEAWAY_RESULT);
    await page.screenshot(screenshotPath(`${id}-result`));

    const result = await page.evaluate(
      resultSel => document.querySelector(resultSel).innerText,
      CLICK_GIVEAWAY_RESULT,
    );

    const lose = result.includes(`you didn't win`);

    // I've never seen a win, so I don't know what that looks like
    console.log(`> ${id}: [${lose ? 'LOSE' : '?'}] (${result})`);

    // await page.close();
  }

  // do stuff, close page
  await pageClosed;
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath:
      '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    headless: false,
    userDataDir: './.puppeteer',
  });
  const page = await browser.newPage();

  await page.goto('https://giveaway.city/', {
    waitUntil: 'networkidle2',
  });

  while (true) {
    const giveaway = await getVisibleGiveawayId(page);
    console.log('GIVEAWAY:', giveaway);

    const giveawayPage = await openGiveaway({ browser, page, id: giveaway });

    await handleGiveaway({ browser, page: giveawayPage, id: giveaway });
  }

  // await browser.close();
})();
