const {Builder, By, until} = require('selenium-webdriver');
const fs = require('fs');
const slug = require('slug');

// Set process.env based on values in .env file
require('dotenv').config()

const driver = new Builder()
    .forBrowser('firefox')
    .build();

const allMovies = new Set();

console.log('Logging into Netflix...');
driver.get('https://www.facebook.com/')
  .then(_ => driver.findElement(By.css('#email')).sendKeys(process.env.FACEBOOK_EMAIL))
  .then(_ => driver.findElement(By.css('#pass')).sendKeys(process.env.FACEBOOK_PASSWORD))
  .then(_ => driver.findElement(By.css('#login_form input[type="submit"]')).click())
  .then(_ => driver.wait(until.titleIs('Facebook'), 5000))
  .then(_ => driver.get('https://www.netflix.com/login'))
  .then(_ => driver.wait(until.elementLocated(By.css('.facebookForm button'))))
  // Netflix's login page JS takes a second to load, add a timed wait.
  .then(_ => driver.sleep(500))
  .then(_ => driver.findElement(By.css('.facebookForm button')).click())
  .then(_ => {
    console.log('Getting list of genre pages...');
    return true;
  })
  .then(_ => driver.wait(until.elementLocated(By.css('[role="navigation"] .browse'))))
  .then(_ => driver.sleep(5000))
  .then(_ => driver.findElement(By.css('[role="navigation"] .browse')).click())
  .then(_ => driver.sleep(1000))
  .then(_ => driver.findElements(By.css('.sub-menu .sub-menu-link')))
  .then(elements => Promise.all(elements.map((element) => element.getAttribute('href'))))
  .then(pageUrls => {
    pageUrls = pageUrls.filter((url) => url.indexOf('genre') > 0 );
    pageUrls.push('https://www.netflix.com/browse/originals')
    return pageUrls;
  })
  .then(pageUrls => {
    console.log('Crawling pages: ');
    console.log(pageUrls.join('\n'));
    return pageUrls;
  })
  .then(pageUrls => {
    const crawlGenrePages = (pageUrls) => {
      let index = 0;
      const crawlGenrePage = () => {
        const pageUrl = pageUrls[index];
        let pageTitle = '';
        return driver.get(pageUrl)
          .then(_ => driver.wait(until.elementLocated(By.css('.title'))))
          .then(_ => driver.findElement(By.css('.title')))
          .then(element => element.getText())
          .then(_pageTitle => {
            pageTitle = slug(_pageTitle);
            return true;
          })
          .then(_ => {
            console.log(`Crawling page ${pageTitle} (${pageUrl})`);
            console.log(`Scrolling to bottom of infinite page...`);
            return true;
          })
          .then(_ => driver.executeScript(() => {
            var callback = arguments[arguments.length - 1];
            const atPageBottom = () => {
              const scrolled = (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;
              const documentHeightMinusOneViewport =
              document.body.scrollHeight - Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
              return Math.abs( documentHeightMinusOneViewport - scrolled ) < 3;
            }
            const spinnerExists = () => {
              return document.querySelector('.icon-spinner') !== null;
            }
            const scrollUntilAtPageBottom = () => {
              if (atPageBottom() && !spinnerExists()) {
                return Promise.resolve(true);
              }
              window.scrollTo(0, document.body.scrollHeight);
              return (new Promise((resolve, reject) => {
                setTimeout(() => {
                  resolve(true);
                }, 1500)
              }))
                .then(scrollUntilAtPageBottom);
            }
            return scrollUntilAtPageBottom()
              .then(callback);
          }))
          .then(_ => driver.sleep(1000))
          .then(_ => driver.findElements(By.js(function() {
              return document.querySelectorAll('.slider-item');
            })))
          .then(_ => {
            console.log(`Finding all titles in page...`);
            return _;
          })
          .then(elements => {
            return Promise.all(
              elements.map(
                element => element.getText()
                  .then(text => {
                    // console.log(text);
                    return text;
                  }))
            )
          })
          .then(titles => {
            titles.sort();
            const fileName = `${__dirname}/output/${pageTitle}`;
            fs.writeFile(fileName, titles.join('\n'), function(err) {
              if(err) {
                return console.log(err);
              }
              console.log(`Wrote ${titles.length} titles for ${pageTitle} to file ${fileName}`);
            });
            return titles;
          })
          .then(titles => {
            if (pageTitle !== 'TV-Shows') {
              titles.forEach(title => {
                allMovies.add(title);
              });
            }
          })
          .then(() => {
            if (index < pageUrls.length - 1) {
              index++;
              return crawlGenrePage();
            } else {
              return true;
            }
          })
      }
      return crawlGenrePage();
    }
    return crawlGenrePages(pageUrls);
  })
  .then(_ => {
    const fileName = `${__dirname}/output/All-Movies`;
    const allMoviesArray = Array.from(allMovies);
    allMoviesArray.sort();
    fs.writeFile(fileName, allMoviesArray.join('\n'), function(err) {
      if(err) {
        return console.log(err);
      }
      console.log(`Wrote all ${allMoviesArray.length} movie titles to file ${fileName}`);
    });
  })
  .then(_ => {
    console.log('Completed crawling.')
    return true;
  })
  .then(_ => driver.quit());
