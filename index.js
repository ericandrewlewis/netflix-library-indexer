require('dotenv').config();
const puppeteer = require('puppeteer');

const logIntoFacebook = async (page) => {
  await page.goto('https://facebook.com', {waitUntil: 'networkidle2'});
  const navigationPromise = page.waitForNavigation();
  await page.evaluate((email, password) => {
    document.querySelector('#email').value = email;
    document.querySelector('#pass').value = password;
    document.querySelector('#login_form input[type="submit"]').click();
  }, process.env.FACEBOOK_EMAIL, process.env.FACEBOOK_PASSWORD);
  return await navigationPromise;
};

const logIntoNetflix = async (page) => {
  await page.goto('https://www.netflix.com/login', {waitUntil: 'networkidle2'});
  const navigationPromise = page.waitForNavigation();
  await page.click('.facebookForm button');
  return navigationPromise;
}

const getMovieUrls = async (page) => {
  const navigationPromise = page.waitForNavigation();
  await page.click('.tabbed-primary-navigation .navigation-tab:nth-child(4) a');
  await navigationPromise;
  await page.waitForSelector('.subgenres [role="button"]');
  await page.click('.subgenres [role="button"]');
  const urls = await page.evaluate(() => {
    const linkElements = document.querySelectorAll('.subgenres .sub-menu a');
    const urls = [];
    for (i = 0; i < linkElements.length; i++) {
      urls.push(linkElements[i].getAttribute('href'))
    };
    return urls;
  })
  return urls;
}

(async() => {
  const browser = await puppeteer.launch({
    headless: false
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 800 }) 
  await logIntoFacebook(page);
  await logIntoNetflix(page);
  const movieUrls = await getMovieUrls(page);
  console.log(movieUrls)
  // await browser.close();
})();
