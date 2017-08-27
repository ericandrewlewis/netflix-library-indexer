const {Builder, By, until} = require('selenium-webdriver');
const fs = require('fs');
const slug = require('slug');
var uniqueArray = require('array-unique');

// Set process.env based on values in .env file
require('dotenv').config()

const driver = new Builder()
    .forBrowser('chrome')
    .build();

const allMovies = {};

const devMode = process.argv[2] === '--dev' ? true : false;

const sortTitleInfo = (a, b) => {
  if (a.title > b.title) {
    return 1;
  }
  if (a.title < b.title) {
    return -1;
  }
  return 0;
};

const logInToFacebook = () => {
  console.log('Logging into Facebook...')
  return driver.get('https://www.facebook.com/')
    .then(_ => driver.findElement(By.css('#email')).sendKeys(process.env.FACEBOOK_EMAIL))
    .then(_ => driver.findElement(By.css('#pass')).sendKeys(process.env.FACEBOOK_PASSWORD))
    .then(_ => driver.findElement(By.css('#login_form input[type="submit"]')).click())
    .then(_ => driver.sleep(1000));
}

const logInToNetflixViaFacebook = () => {
  console.log('Logging into Netflix...')
  return driver.get('https://www.netflix.com/login')
    .then(_ => driver.wait(until.elementLocated(By.css('.facebookForm button'))))
    .then(_ => driver.sleep(750))
    .then(_ => driver.findElement(By.css('.facebookForm button')).click())
    .then(_ => driver.sleep(750));
}

const getNetflixGenrePagesToIndex = () => {
  console.log('Getting list of genre pages...');
  if (devMode) {
    // International movies (1064)
    // return [
    //   'https://www.netflix.com/browse/genre/78367',
    //   'https://www.netflix.com/browse/genre/12339'
    // ];
    // return ['https://www.netflix.com/browse/genre/83'];
    // return ['https://www.netflix.com/browse/genre/4370'];
    // Baseball movies (very few like 20)
    return ['https://www.netflix.com/browse/genre/12339'];
  }
  return driver.wait(until.elementLocated(By.css('[role="navigation"] .browse')))
    .then(_ => driver.sleep(5000))
    .then(_ => driver.findElement(By.css('[role="navigation"] .browse')).click())
    .then(_ => driver.sleep(1000))
    .then(_ => driver.findElements(By.css('.sub-menu .sub-menu-link')))
    .then(elements => Promise.all(elements.map((element) => element.getAttribute('href'))))
    .then(pageUrls => {
      pageUrls = pageUrls.filter((url) => url.indexOf('genre') > 0 );
      pageUrls.push('https://www.netflix.com/browse/originals');
      return pageUrls;
    });
}

const timeSince = (startTime) => {
  const endTime = new Date();
  const elapsedTime = endTime - startTime;
  return elapsedTime + 'ms';
}

const getAllTitleUrlsInPage = () => {
  const idRegex = /watch\/(.*)\?/;
  return driver.findElements(By.css('.title_card'))
    .then(elements => {
      return Promise.all(
        elements.map(
          element => element.getAttribute('href')
        )
      )
        .then(hrefs => hrefs.map(href => href.match(idRegex)[1]))
    })
    .then(ids => ids.map(id => `https://www.netflix.com/title/${id}`));
}

const scrollToBottomOfPage = () => driver.executeAsyncScript(() => {
  // The last argument is to resolve the script.
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
      }, 1500);
    }))
      .then(scrollUntilAtPageBottom);
  }
  return scrollUntilAtPageBottom()
    .then(callback);
});

const crawlGenrePages = (genrePageUrls) => {
  let index = 0;
  let urls = [];
  const crawlGenrePage = () => {
    const pageUrl = genrePageUrls[index];
    let pageTitle = '';
    return driver.manage().timeouts().setScriptTimeout(600000)
      .then(_ => driver.get(pageUrl))
      .then(_ => driver.wait(until.elementLocated(By.css('.title'))))
      .then(_ => driver.findElement(By.css('.title')))
      .then(element => element.getText())
      .then(_pageTitle => {
        pageTitle = slug(_pageTitle);
        return true;
      })
      .then(scrollToBottomOfPage)
      .then(getAllTitleUrlsInPage)
      .then(_urls => {
        console.log(`Found ${_urls.length} ${pageTitle} titles to index`);
        urls = urls.concat(_urls);
        if (index < genrePageUrls.length - 1) {
          index++;
          return crawlGenrePage();
        } else {
          return uniqueArray(urls);
        }
      });
  };
  return crawlGenrePage();
        //
        //   let lastFailed = false;
        //   const getNextTitleInPage = () => {
        //     const titleInfo = {};
        //     process.stdout.write('Scrolling for more items...');
        //     let startTime = new Date();
        //     return scrollForMoreItems()
        //       .then(_ => {
        //         process.stdout.write(`Done scrolling in ${timeSince(startTime)}\n`);
        //         startTime = new Date();
        //       })
        //       .then(_ => driver.findElements(By.js(function() {
        //         return document.querySelectorAll('.slider-item');
        //       })))
        //       .then(elements => {
        //         console.log(`Queried all .slider-item elements in ${timeSince(startTime)}`);
        //         startTime = new Date();
        //         return elements;
        //       })
        //       .then(elements => {
        //         console.log(`Current titleIndex: ${titleIndex} and total slider-items: ${elements.length}`)
        //         if (titleIndex >= elements.length) {
        //           console.log(`Completed a titleIndex: ${titleIndex} and total slider-items: ${elements.length}`)
        //           return titles;
        //         }
        //         const element = elements[titleIndex];
        //         return element.getText()
        //           .then(text => {
        //             console.log(`title getText() in ${timeSince(startTime)}`);
        //             titleInfo.title = text;
        //             if (!lastFailed) {
        //               element.click();
        //             } else {
        //               lastFailed = false;
        //             }
        //           })
        //           .then(_ => driver.sleep(1000))
        //           .then(_ => startTime = new Date())
                  // .then(_ => driver.findElement(By.className('year')))
        //           .then(element => {
        //             console.log(`Found .year in ${timeSince(startTime)}`);
        //             startTime = new Date();
        //             return element;
        //           })
        //           .then(element => element.getText())
        //           .then(text => {
        //             console.log(`year .getText in ${timeSince(startTime)}`);
        //             startTime = new Date();
        //             return text;
        //           })
        //           .then(text => {
        //             if (!text) {
        //               throw new Error('Year is empty');
        //             }
        //             titleInfo.year = text
        //             startTime = new Date();
        //           })
        //           .then(_ => driver.findElement(By.className('duration')))
        //           .then(element => {
        //             console.log(`Found .duration in ${timeSince(startTime)}`);
        //             startTime = new Date();
        //             return element;
        //           })
        //           .then(element => element.getText())
        //           .then(text => {
        //             console.log(`duration .getText in ${timeSince(startTime)}`);
        //             startTime = new Date();
        //             return text;
        //           })
        //           .then(text => {
        //             if (!text) {
        //               throw new Error('Duration is empty');
        //             }
        //             titleInfo.duration = text;
        //           })
        //           .then(_ => {
        //             titleIndex++;
        //             const endTime = new Date();
        //             const elapsedTime = endTime - startTime;
        //             console.log(`Indexed ${titles.length}: ${titleInfo.title} (${titleInfo.year}) ${titleInfo.duration} in ${timeSince(startTime)}`);
        //             titles.push(titleInfo);
        //           })
        //           .catch((error) => {
        //             lastFailed = true;
        //             console.error('Something went wrong. ' + error + '. Retrying...');
        //           })
        //           .then(getNextTitleInPage);
        //       });
        //   }
        //   return getNextTitleInPage();
        // }
        // return getAllTitlesInPage();
      // })
      // .then(titleInfos => {
      //   titleInfos.sort(sortTitleInfo);
      //   const fileName = `${__dirname}/output/${pageTitle}`;
      //   const output = titleInfos.reduce((accumulator, titleInfo) => {
      //     return `${accumulator}${titleInfo.title}\t${titleInfo.year}\t${titleInfo.duration}\n`;
      //   }, '');
      //   return new Promise((resolve, reject) => {
      //     fs.writeFile(fileName, output, function(err) {
      //       if(err) {
      //         return reject(err);
      //       }
      //       console.log(`Wrote ${titleInfos.length} titles for ${pageTitle} to file ${fileName}`);
      //       resolve(titleInfos);
      //     });
      //   })
      // })
      // .then(titleInfos => {
      //   if (pageTitle !== 'TV-Shows') {
      //     titleInfos.forEach(titleInfo => {
      //       allMovies[`${titleInfo.title} (${titleInfo.year})`] = titleInfo;
      //     });
      //   }
      // })
      // .then(() => {
      //   if (index < genrePageUrls.length - 1) {
      //     index++;
      //     return crawlGenrePage();
      //   } else {
      //     return true;
      //   }
      // })
  // }
}

logInToFacebook()
  .then(logInToNetflixViaFacebook)
  .then(getNetflixGenrePagesToIndex)
  .then(crawlGenrePages)
  .then(urls => {
    console.log(`Will index ${urls.length} title pages`);
    return urls;
  })
  .then(urls => {
    const titleInfos = [];
    let index = 0;
    let lastFailed = false;
    let failedOnThisPage = 0;
    const indexTitlePage = () => {
      let url = urls[index];
      const titleInfo = {};
      return (() => {
          if (lastFailed) {
            lastFailed = false;
            return Promise.resolve(true);
          }
          return driver.get(url);
        })()
        .then(_ => {
          return driver.findElement(By.css('.title'))
            .then(element => {
              return element.getText()
                .then(text => {
                  if (text) {
                    return text;
                  } else {
                    return driver.findElement(By.css('.title .logo'))
                      .then(element => element.getAttribute('alt'))
                      .then(title => {
                        return title;
                      });
                  }
                })
            })
            .then(title => {
              titleInfo.title = title
            })
        })
        .then(_ => driver.findElement(By.css('.Overview')).click())
        .then(_ => driver.findElement(By.className('year')))
        .then(element => element.getText())
        .then(year => titleInfo.year = year)
        .then(_ => driver.findElement(By.className('duration')))
        .then(element => element.getText())
        .then(duration => titleInfo.duration = duration)
        .then(_ => driver.findElement(By.css('.ShowDetails')).click())
        .then(_ => driver.sleep(300))
        .then(_ => driver.findElement(By.className('detailsTags')))
        .then(element => element.getText())
        .then(tags => {
          debugger;
          let splitTags;
          if (tags.search(/This (show|movie) is/) > -1) {
            splitTags = tags.replace(/This (show|movie) is/, '###')
              .split('###');
          } else {
              splitTags = [
              tags,
              ''
            ];
          }

          const genres = splitTags[0].trim().replace('Genres\n', '').replace(/\n/g, ',');
          const _tags = splitTags[1].trim().replace(/\n/g, ',');
          titleInfo.genres = genres;
          titleInfo.tags = _tags;
        })
        .then(_ => {
          if (!titleInfo.title) {
            lastFailed = true; failedOnThisPage++;
            throw new Error('title empty');
          }
          if (!titleInfo.year) {
            lastFailed = true; failedOnThisPage++;
            throw new Error('year empty');
          }
          if (!titleInfo.duration) {
            lastFailed = true; failedOnThisPage++;
            throw new Error('year empty');
          }
          if (!titleInfo.genres) {
            lastFailed = true; failedOnThisPage++;
            throw new Error('genre empty');
          }
          console.log(`Indexed: ${titleInfo.title} (${titleInfo.year}) ${titleInfo.duration} ${titleInfo.genres} ${titleInfo.tags}`);
          titleInfos.push(titleInfo);
        })
        // Sleep to avoid hitting Netflix too often
        .then(_ => driver.sleep(1000))
        .then(_ => {
          failedOnThisPage = 0;
          if (index < urls.length - 1) {
            index++;
            return indexTitlePage();
          } else {
            return titleInfos;
          }
        })
        .catch((error) => {
          if (failedOnThisPage > 10) {
            throw new Error('Something went really wrong on ' + url);
          }
          console.log('Something went wrong:' + error)
          return indexTitlePage();
        });
    };
    return indexTitlePage();
  })
  .then(titleInfos => {
    const fileName = `${__dirname}/output/All`;
    const output = titleInfos.reduce((accumulator, titleInfo) => {
      return `${accumulator}${titleInfo.title}\t${titleInfo.year}\t${titleInfo.duration}\t${titleInfo.genres}\t${titleInfo.tags}\n`;
    }, '');
    fs.writeFile(fileName, output, function(err) {
      if(err) {
        return console.log(err);
      }
      console.log(`Wrote all ${titleInfos.length} movie titles to file ${fileName}`);
    });
  })
  .then(_ => {
    console.log('Completed crawling.')
    return true;
  })
  .then(_ => driver.quit());
